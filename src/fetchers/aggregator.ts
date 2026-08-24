import type {
  GitHubUser,
  Repository,
  LanguageStat,
  ContributorStat,
  StatsData,
  StreakData,
  CommitContributionsByRepository,
  ContributionDay,
} from '../types/index.js';

// ============================================================
// Language Aggregation
// ============================================================

/**
 * Aggregate language stats from two sources:
 *  1. By COMMIT: uses contributionsByRepo (commit count per lang)
 *  2. By REPO: counts repos per language
 *  3. By BYTES: uses repository language edges (byte size)
 */
export function aggregateLanguages(
  repositories: Repository[],
  contributionsByRepo: CommitContributionsByRepository[]
): LanguageStat[] {
  const langMap = new Map<
    string,
    {
      name: string;
      color: string;
      commitCount: number;
      repoCount: number;
      byteSize: number;
    }
  >();

  // ── Pass 1: By commit (from contributions) ────────────────
  let totalCommits = 0;
  for (const contrib of contributionsByRepo) {
    const lang = contrib.repository.primaryLanguage;
    if (!lang) continue;

    const count = contrib.contributions.totalCount;
    totalCommits += count;

    const entry = langMap.get(lang.name) ?? {
      name: lang.name,
      color: lang.color ?? generateLangColor(lang.name),
      commitCount: 0,
      repoCount: 0,
      byteSize: 0,
    };
    entry.commitCount += count;
    langMap.set(lang.name, entry);
  }

  // ── Pass 2: By repo + byte size ───────────────────────────
  let totalBytes = 0;
  for (const repo of repositories) {
    if (repo.isFork) continue;

    // Primary language repo count
    if (repo.primaryLanguage) {
      const entry = langMap.get(repo.primaryLanguage.name) ?? {
        name: repo.primaryLanguage.name,
        color: repo.primaryLanguage.color ?? generateLangColor(repo.primaryLanguage.name),
        commitCount: 0,
        repoCount: 0,
        byteSize: 0,
      };
      entry.repoCount += 1;
      langMap.set(repo.primaryLanguage.name, entry);
    }

    // Byte size from all languages in repo
    if (repo.languages?.edges) {
      for (const edge of repo.languages.edges) {
        const { name, color } = edge.node;
        const entry = langMap.get(name) ?? {
          name,
          color: color ?? generateLangColor(name),
          commitCount: 0,
          repoCount: 0,
          byteSize: 0,
        };
        entry.byteSize += edge.size;
        totalBytes += edge.size;
        langMap.set(name, entry);
      }
    }
  }

  // ── Compute totals for repo count ─────────────────────────
  let totalRepos = 0;
  for (const [, entry] of langMap) {
    totalRepos += entry.repoCount;
  }

  // ── Build result with percentages ─────────────────────────
  const result: LanguageStat[] = [];
  for (const [, entry] of langMap) {
    result.push({
      name: entry.name,
      color: entry.color,
      commitCount: entry.commitCount,
      commitPercent: totalCommits > 0
        ? parseFloat(((entry.commitCount / totalCommits) * 100).toFixed(2))
        : 0,
      repoCount: entry.repoCount,
      repoPercent: totalRepos > 0
        ? parseFloat(((entry.repoCount / totalRepos) * 100).toFixed(2))
        : 0,
      byteSize: entry.byteSize,
      bytePercent: totalBytes > 0
        ? parseFloat(((entry.byteSize / totalBytes) * 100).toFixed(2))
        : 0,
    });
  }

  // Sort by commit count desc, then repo count
  return result
    .filter((l) => l.commitCount > 0 || l.repoCount > 0)
    .sort((a, b) => b.commitCount - a.commitCount || b.repoCount - a.repoCount)
    .slice(0, 15); // Top 15 languages
}

// ============================================================
// Streak Calculation
// ============================================================

export function calculateStreak(user: GitHubUser): StreakData {
  const weeks = user.contributionsCollection.contributionCalendar.weeks;
  const days: ContributionDay[] = weeks.flatMap((w) => w.contributionDays);

  // Sort by date ascending
  days.sort((a, b) => a.date.localeCompare(b.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let firstContribution: string | null = null;
  let lastContribution: string | null = null;

  const today = new Date().toISOString().split('T')[0];

  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];

    // Track first/last contribution
    if (day.contributionCount > 0) {
      if (!lastContribution) lastContribution = day.date;
      firstContribution = day.date;
    }
  }

  // Calculate current streak (from today backwards)
  let checking = true;
  for (let i = days.length - 1; i >= 0 && checking; i--) {
    const day = days[i];

    // Allow today to be 0 (day isn't done yet)
    if (day.date === today && day.contributionCount === 0) {
      continue;
    }

    if (day.contributionCount > 0) {
      currentStreak++;
    } else {
      checking = false;
    }
  }

  // Calculate longest streak
  for (const day of days) {
    if (day.contributionCount > 0) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalContributions: user.contributionsCollection.contributionCalendar.totalContributions,
    firstContribution,
    lastContribution,
  };
}

// ============================================================
// Contributor Stats Aggregation
// ============================================================

export function aggregateContributors(
  rawContributors: Array<{
    login: string;
    name: string;
    avatarUrl: string;
    url: string;
    contributions?: number;
  }>,
  excludeLogin?: string
): ContributorStat[] {
  const filtered = rawContributors.filter(
    (c) => c.login !== excludeLogin
  );

  const total = filtered.reduce((sum, c) => sum + (c.contributions ?? 0), 0);

  return filtered.map((c) => ({
    login: c.login,
    name: c.name || c.login,
    avatarUrl: c.avatarUrl,
    url: c.url,
    commitCount: c.contributions ?? 0,
    percent: total > 0
      ? parseFloat(((( c.contributions ?? 0) / total) * 100).toFixed(1))
      : 0,
  }));
}

// ============================================================
// Top Language Color Palette Extractor
// ============================================================

/**
 * Extract top N language colors to drive dynamic gradient generation.
 * Returns colors sorted by commit dominance.
 */
export function extractTopLanguageColors(
  langStats: LanguageStat[],
  topN = 3
): string[] {
  return langStats
    .slice(0, topN)
    .map((l) => l.color)
    .filter(Boolean) as string[];
}

// ============================================================
// Full Stats Builder
// ============================================================

export function buildStatsData(
  user: GitHubUser,
  repositories: Repository[]
): Omit<StatsData, 'topContributors'> {
  const languageStats = aggregateLanguages(
    repositories,
    user.contributionsCollection.commitContributionsByRepository
  );

  const streak = calculateStreak(user);

  return {
    user,
    repositories,
    languageStats,
    contributionsByRepo: user.contributionsCollection.commitContributionsByRepository,
    streak,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================
// Utility: Generate consistent color from language name
// (fallback when GitHub doesn't provide one)
// ============================================================

function generateLangColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a saturated, readable color in HSL
  const hue = Math.abs(hash) % 360;
  const sat = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
  const light = 45 + (Math.abs(hash >> 16) % 15); // 45-60%

  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
