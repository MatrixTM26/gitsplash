// ============================================================
// GitHub Stats Types
// ============================================================

export interface GitHubUser {
  login: string;
  name: string;
  avatarUrl: string;
  bio: string;
  company: string;
  location: string;
  email: string;
  websiteUrl: string;
  twitterUsername: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: {
    totalCount: number;
    totalDiskUsage: number;
  };
  contributionsCollection: ContributionsCollection;
  organizations: {
    nodes: Organization[];
    totalCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContributionsCollection {
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  totalRepositoryContributions: number;
  restrictedContributionsCount: number;
  contributionCalendar: ContributionCalendar;
  commitContributionsByRepository: CommitContributionsByRepository[];
}

export interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionWeek[];
  colors: string[];
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
  firstDay: string;
}

export interface ContributionDay {
  contributionCount: number;
  contributionLevel: 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';
  date: string;
  color: string;
}

export interface CommitContributionsByRepository {
  repository: {
    name: string;
    nameWithOwner: string;
    primaryLanguage: Language | null;
  };
  contributions: {
    totalCount: number;
  };
}

export interface Organization {
  login: string;
  name: string;
  avatarUrl: string;
  description: string;
  url: string;
  membersWithRole?: { totalCount: number };
  repositories?: { totalCount: number };
}

export interface Repository {
  name: string;
  nameWithOwner: string;
  description: string;
  url: string;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: Language | null;
  languages: {
    edges: LanguageEdge[];
    totalSize: number;
  };
  collaborators?: {
    edges: CollaboratorEdge[];
    totalCount: number;
  };
  defaultBranchRef?: {
    target?: {
      history?: {
        totalCount: number;
        nodes?: CommitNode[];
      };
    };
  };
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface Language {
  name: string;
  color: string | null;
}

export interface LanguageEdge {
  size: number;
  node: Language;
}

export interface CollaboratorEdge {
  permission: string;
  node: {
    login: string;
    name: string;
    avatarUrl: string;
    url: string;
  };
}

export interface CommitNode {
  message: string;
  committedDate: string;
  author: {
    name: string;
    email: string;
  };
}

// ============================================================
// Processed / Aggregated Types
// ============================================================

export interface LanguageStat {
  name: string;
  color: string;
  // by commit
  commitCount: number;
  commitPercent: number;
  // by repo
  repoCount: number;
  repoPercent: number;
  // by byte size
  byteSize: number;
  bytePercent: number;
}

export interface ContributorStat {
  login: string;
  name: string;
  avatarUrl: string;
  url: string;
  commitCount: number;
  percent: number;
}

export interface StatsData {
  user: GitHubUser;
  repositories: Repository[];
  languageStats: LanguageStat[];
  contributionsByRepo: CommitContributionsByRepository[];
  topContributors: Map<string, ContributorStat[]>; // repoName -> contributors
  streak: StreakData;
  fetchedAt: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  firstContribution: string | null;
  lastContribution: string | null;
}

// ============================================================
// Renderer Config Types
// ============================================================

export interface GradientConfig {
  id: string;
  type: 'linear' | 'radial' | 'conic';
  colors: GradientStop[];
  angle?: number;          // for linear
  cx?: number; cy?: number; // for radial/conic (0-1)
  animated?: boolean;
  animationDuration?: number; // seconds
}

export interface GradientStop {
  color: string;
  offset: number; // 0-100
  opacity?: number;
}

export interface ThemeConfig {
  id: string;
  name: string;
  background: GradientConfig;
  foreground: string;
  accent: GradientConfig;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  card: {
    background: string;
    border: string;
    shadow: string;
  };
  chart: {
    gridColor: string;
    axisColor: string;
  };
}

export interface CardOptions {
  width?: number;
  height?: number;
  theme?: ThemeConfig;
  animated?: boolean;
  show3d?: boolean;
  title?: string;
  hideTitle?: boolean;
  hideBorder?: boolean;
  customColors?: string[];
  locale?: string;
}

export interface FetcherConfig {
  token: string;
  username: string;
  maxRepos?: number;
  includePrivate?: boolean;
  includeOrgs?: boolean;
  cacheDir?: string;
  cacheTTL?: number; // minutes
}

// ============================================================
// GraphQL Response Wrappers
// ============================================================

export interface GraphQLResponse<T> {
  data: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: Record<string, unknown>;
}

export interface UserQueryResponse {
  user: GitHubUser;
}

export interface ReposQueryResponse {
  user: {
    repositories: {
      nodes: Repository[];
      pageInfo: PageInfo;
    };
  };
}

export interface OrgReposQueryResponse {
  organization: {
    repositories: {
      nodes: Repository[];
      pageInfo: PageInfo;
    };
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}
