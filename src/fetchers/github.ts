import {
  GraphQLResponse,
  UserQueryResponse,
  ReposQueryResponse,
  GraphQLError,
} from '../types/index.js';
import {
  USER_QUERY,
  REPOS_QUERY,
  ALL_YEARS_QUERY,
  YEAR_CONTRIBUTIONS_QUERY,
  ORG_DETAILS_QUERY,
  REPO_CONTRIBUTORS_QUERY,
} from './queries.js';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';

// ============================================================
// Rate Limit Tracker
// ============================================================
interface RateLimit {
  limit: number;
  remaining: number;
  resetAt: Date;
  used: number;
}

export class GitHubRateLimitError extends Error {
  public resetAt: Date;
  constructor(resetAt: Date) {
    super(`GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`);
    this.name = 'GitHubRateLimitError';
    this.resetAt = resetAt;
  }
}

export class GitHubFetchError extends Error {
  public errors?: GraphQLError[];
  constructor(message: string, errors?: GraphQLError[]) {
    super(message);
    this.name = 'GitHubFetchError';
    this.errors = errors;
  }
}

// ============================================================
// GitHub API Client
// ============================================================
export class GitHubClient {
  private token: string;
  private rateLimit: RateLimit | null = null;
  private requestCount = 0;

  constructor(token: string) {
    if (!token) throw new Error('GitHub token is required');
    this.token = token;
  }

  // ── Core GraphQL executor ──────────────────────────────────
  async graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
    retries = 3
  ): Promise<T> {
    this.requestCount++;

    // Proactive rate limit check
    if (this.rateLimit && this.rateLimit.remaining < 5) {
      const now = new Date();
      if (now < this.rateLimit.resetAt) {
        throw new GitHubRateLimitError(this.rateLimit.resetAt);
      }
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            Authorization: `bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'github-stats-svg/1.0',
          },
          body: JSON.stringify({ query, variables }),
        });

        // Update rate limit from headers
        this.updateRateLimit(response.headers);

        if (response.status === 401) {
          throw new GitHubFetchError('Invalid or expired GitHub token');
        }

        if (response.status === 403) {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          const resetAt = resetTime
            ? new Date(parseInt(resetTime) * 1000)
            : new Date(Date.now() + 60_000);
          throw new GitHubRateLimitError(resetAt);
        }

        if (!response.ok) {
          throw new GitHubFetchError(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result = await response.json() as GraphQLResponse<T>;

        if (result.errors && result.errors.length > 0) {
          const msg = result.errors.map((e: GraphQLError) => e.message).join('; ');

          // Not found is non-fatal for optional data
          interface ExtendedError extends GraphQLError { type?: string; }
          if (result.errors.some((e: ExtendedError) => e.type === 'NOT_FOUND')) {
            console.warn(`[GitHub] Not found: ${msg}`);
            return result.data;
          }

          throw new GitHubFetchError(`GraphQL errors: ${msg}`, result.errors);
        }

        return result.data;
      } catch (err) {
        if (
          err instanceof GitHubRateLimitError ||
          err instanceof GitHubFetchError
        ) {
          throw err; // Don't retry these
        }

        if (attempt === retries) throw err;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `[GitHub] Attempt ${attempt} failed, retrying in ${delay}ms...`,
          err
        );
        await sleep(delay);
      }
    }

    throw new GitHubFetchError('Max retries exceeded');
  }

  // ── REST fallback (for endpoints not in GraphQL) ───────────
  async rest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${GITHUB_REST_URL}${endpoint}`, {
      headers: {
        Authorization: `token ${this.token}`,
        'User-Agent': 'github-stats-svg/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new GitHubFetchError(`REST ${response.status}: ${endpoint}`);
    }

    return response.json() as Promise<T>;
  }

  private updateRateLimit(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    const used = headers.get('X-RateLimit-Used');

    if (limit && remaining && reset) {
      this.rateLimit = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        resetAt: new Date(parseInt(reset) * 1000),
        used: used ? parseInt(used) : 0,
      };
    }
  }

  getRateLimit() {
    return this.rateLimit;
  }

  getRequestCount() {
    return this.requestCount;
  }
}

// ============================================================
// Data Fetchers
// ============================================================

export async function fetchUserData(
  client: GitHubClient,
  username: string,
  year?: number
) {
  const now = new Date();
  const from = year
    ? new Date(`${year}-01-01T00:00:00Z`)
    : new Date(now.getFullYear(), 0, 1);
  const to = year ? new Date(`${year}-12-31T23:59:59Z`) : now;

  console.log(`[Fetcher] Fetching user data for @${username} (${from.getFullYear()})...`);

  const data = await client.graphql<UserQueryResponse>(USER_QUERY, {
    login: username,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  if (!data.user) {
    throw new GitHubFetchError(`User '${username}' not found`);
  }

  return data.user;
}

export async function fetchAllRepositories(
  client: GitHubClient,
  username: string
) {
  console.log(`[Fetcher] Fetching repositories for @${username}...`);

  const allRepos: Repository[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    page++;
    const data: ReposQueryResponse = await client.graphql<ReposQueryResponse>(REPOS_QUERY, {
      login: username,
      after: cursor,
    });

    const repos: ReposQueryResponse['user']['repositories'] | undefined = data.user?.repositories;
    if (!repos) break;

    allRepos.push(...repos.nodes);

    if (repos.pageInfo.hasNextPage) {
      cursor = repos.pageInfo.endCursor;
      // Respect secondary rate limits
      await sleep(100);
    } else {
      cursor = null;
    }
  } while (cursor);

  console.log(`[Fetcher] Found ${allRepos.length} repositories (${page} page(s))`);
  return allRepos;
}

export async function fetchContributionYears(
  client: GitHubClient,
  username: string
): Promise<number[]> {
  console.log(`[Fetcher] Fetching contribution years for @${username}...`);

  interface YearsResponse {
    user: {
      contributionsCollection: {
        contributionYears: number[];
      };
    };
  }

  const data = await client.graphql<YearsResponse>(ALL_YEARS_QUERY, {
    login: username,
  });

  return data.user?.contributionsCollection?.contributionYears ?? [];
}

export async function fetchYearContributions(
  client: GitHubClient,
  username: string,
  year: number
) {
  const from = new Date(`${year}-01-01T00:00:00Z`);
  const to = new Date(`${year}-12-31T23:59:59Z`);

  interface YearContribResponse {
    user: {
      contributionsCollection: {
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            firstDay: string;
            contributionDays: Array<{
              contributionCount: number;
              date: string;
            }>;
          }>;
        };
      };
    };
  }

  const data = await client.graphql<YearContribResponse>(
    YEAR_CONTRIBUTIONS_QUERY,
    { login: username, from: from.toISOString(), to: to.toISOString() }
  );

  return data.user?.contributionsCollection;
}

export async function fetchOrgDetails(
  client: GitHubClient,
  orgLogin: string
) {
  interface OrgResponse {
    organization: {
      login: string;
      name: string;
      avatarUrl: string;
      description: string;
      url: string;
      membersWithRole: { totalCount: number };
      repositories: { totalCount: number };
    };
  }

  try {
    const data = await client.graphql<OrgResponse>(ORG_DETAILS_QUERY, {
      login: orgLogin,
    });
    return data.organization;
  } catch {
    console.warn(`[Fetcher] Could not fetch org details for ${orgLogin}`);
    return null;
  }
}

export async function fetchRepoContributors(
  client: GitHubClient,
  owner: string,
  repoName: string
) {
  interface ContribResponse {
    repository: {
      collaborators: {
        totalCount: number;
        edges: Array<{
          permission: string;
          node: {
            login: string;
            name: string;
            avatarUrl: string;
            url: string;
          };
        }>;
      };
    };
  }

  try {
    const data = await client.graphql<ContribResponse>(
      REPO_CONTRIBUTORS_QUERY,
      { owner, name: repoName }
    );
    return data.repository?.collaborators ?? null;
  } catch {
    // REST fallback for commit-based contributor count
    try {
      const contributors = await client.rest<
        Array<{ login: string; contributions: number; avatar_url: string; html_url: string }>
      >(`/repos/${owner}/${repoName}/contributors?per_page=10&anon=0`);
      return {
        totalCount: contributors.length,
        edges: contributors.map((c) => ({
          permission: 'READ',
          node: {
            login: c.login,
            name: c.login,
            avatarUrl: c.avatar_url,
            url: c.html_url,
            contributions: c.contributions,
          },
        })),
      };
    } catch {
      console.warn(`[Fetcher] Could not fetch contributors for ${owner}/${repoName}`);
      return null;
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Type alias fix (Repository imported from types)
import type { Repository } from '../types/index.js';
