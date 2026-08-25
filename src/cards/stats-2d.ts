import type { StatsData } from '../types/index.js';

import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  svgText, svgCircle,
  animateFadeIn,
  buildCardShell, fmtNum,
  type CardShellOptions,
} from '../renderers/base.js';

const W = 495;
const H = 195;

// ============================================================
// 2D Stats Card
// ============================================================

export function renderStatsCard2D(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true
): string {
  const { user, streak } = stats;
  const contrib = user.contributionsCollection;

  // ── Aggregate values ──────────────────────────────────────
  const totalCommits =
    contrib.totalCommitContributions + contrib.restrictedContributionsCount;
  const totalPRs = contrib.totalPullRequestContributions;
  const totalIssues = contrib.totalIssueContributions;
  const totalReviews = contrib.totalPullRequestReviewContributions;
  const totalStars = stats.repositories.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = stats.repositories.reduce((s, r) => s + r.forkCount, 0);

  // ── Layout ────────────────────────────────────────────────
  const body = [
    buildStatGrid(
      totalCommits, totalPRs, totalIssues,
      totalReviews, totalStars, totalForks,
      user.followers.totalCount,
      streak.currentStreak,
      palette, animated
    ),
    buildRankBadge(stats, palette, animated),
  ].join('');

  const shellOpts: CardShellOptions = {
    width: W, height: H,
    palette, gradients, animated,
    title: `${user.name ?? user.login}'s GitHub Stats`,
    titleIcon: '⚡',
    subtitle: `@${user.login} · ${new Date().getFullYear()} stats`,
    footerText: `Updated ${new Date().toUTCString()}`,
  };

  return buildCardShell(shellOpts, body);
}

// ── Stat Grid (2×4) ──────────────────────────────────────────

function buildStatGrid(
  commits: number, prs: number, issues: number, reviews: number,
  stars: number, forks: number, followers: number, streak: number,
  palette: DynamicPalette, animated: boolean
): string {
  type StatItem = { icon: string; label: string; value: number };
  const items: StatItem[] = [
    { icon: '◈', label: 'Commits', value: commits },
    { icon: '⌥', label: 'Pull Requests', value: prs },
    { icon: '◎', label: 'Issues', value: issues },
    { icon: '✦', label: 'Reviews', value: reviews },
    { icon: '★', label: 'Stars Earned', value: stars },
    { icon: '⊗', label: 'Forks', value: forks },
    { icon: '◉', label: 'Followers', value: followers },
    { icon: '⚑', label: 'Day Streak', value: streak },
  ];

  const cols = 4;
  const colW = (W - 32) / cols;
  const rowH = 55;
  const startY = 8;

  return items.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 16 + col * colW;
    const y = startY + row * rowH;
    const delay = animated ? 0.1 + i * 0.07 : 0;

    return buildStatItem(x, y, colW, item.icon, item.label, item.value, palette, animated, delay);
  }).join('');
}

function buildStatItem(
  x: number, y: number, w: number,
  icon: string, label: string, value: number,
  palette: DynamicPalette, animated: boolean, delay: number
): string {
  const cx = x + w / 2;

  // Icon
  const iconEl = svgText({
    x: cx, y: y + 14,
    text: icon, fontSize: 13,
    fill: palette.primary,
    anchor: 'middle',
    dominantBaseline: 'middle',
    filter: 'glow-filter',
  });

  // Value
  const valEl = svgText({
    x: cx, y: y + 30,
    text: fmtNum(value),
    fontSize: 18, fontWeight: 700,
    fill: palette.text,
    anchor: 'middle',
    dominantBaseline: 'middle',
  });

  // Label
  const labelEl = svgText({
    x: cx, y: y + 46,
    text: label, fontSize: 9,
    fill: palette.textMuted,
    anchor: 'middle',
    dominantBaseline: 'middle',
    letterSpacing: 0.3,
  });

  // Separator lines between columns rendered at grid level

  const fadeIn = animated
    ? `<animate attributeName="opacity" from="0" to="1"
        dur="0.5s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
    : '';

  return `<g opacity="${animated ? 0 : 1}">${iconEl}${valEl}${labelEl}${fadeIn}</g>`;
}

// ── Rank Badge (top-right corner) ────────────────────────────

function buildRankBadge(
  stats: StatsData, palette: DynamicPalette, animated: boolean
): string {
  const rank = calcRank(stats);
  const cx = W - 45;
  const cy = -24; // relative to body offset (title is 56px)

  // Rank ring
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const progress = rank.percentile / 100;
  const dashOffset = circumference * (1 - progress);

  const ringBg = svgCircle(cx, cy, radius, 'none', palette.border, 2);
  const ringFill = `
    <circle cx="${cx}" cy="${cy}" r="${radius}"
      fill="none" stroke="url(#grad-accent)" stroke-width="2.5"
      stroke-dasharray="${circumference.toFixed(2)}"
      stroke-dashoffset="${animated ? circumference.toFixed(2) : dashOffset.toFixed(2)}"
      stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})">
      ${animated
        ? `<animate attributeName="stroke-dashoffset"
            from="${circumference}" to="${dashOffset}"
            dur="1.5s" begin="0.3s" fill="freeze" calcMode="spline"
            keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
        : ''}
    </circle>`;

  const rankLabel = svgText({
    x: cx, y: cy - 6,
    text: rank.level,
    fontSize: 18, fontWeight: 700,
    fill: palette.primary,
    anchor: 'middle',
    filter: 'glow-filter',
  });

  const rankSub = svgText({
    x: cx, y: cy + 10,
    text: 'RANK',
    fontSize: 8,
    fill: palette.textMuted,
    anchor: 'middle',
    letterSpacing: 1,
  });

  const pctEl = svgText({
    x: cx, y: cy + 20,
    text: `Top ${rank.percentile}%`,
    fontSize: 8,
    fill: palette.textMuted,
    anchor: 'middle',
    opacity: 0.7,
  });

  const fadeIn = animated ? animateFadeIn(0.2, 0.6) : '';

  return `
    <g opacity="${animated ? 0 : 1}">
      ${ringBg}${ringFill}${rankLabel}${rankSub}${pctEl}
      ${fadeIn}
    </g>`;
}

// ── Rank Calculator ────────────────────────────────────────────

interface Rank {
  level: string;
  percentile: number;
  score: number;
}

function calcRank(stats: StatsData): Rank {
  const c = stats.user.contributionsCollection;
  const repos = stats.repositories;

  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = repos.reduce((s, r) => s + r.forkCount, 0);
  const commits = c.totalCommitContributions + c.restrictedContributionsCount;
  const prs = c.totalPullRequestContributions;
  const issues = c.totalIssueContributions;
  const reviews = c.totalPullRequestReviewContributions;
  const followers = stats.user.followers.totalCount;

  // Weighted exponential scoring (inspired by anuraghazra/github-readme-stats)
  const score =
    commits * 2 +
    prs * 3 +
    issues * 1 +
    reviews * 1 +
    totalStars * 4 +
    totalForks * 2 +
    followers * 1;

  // Percentile thresholds (lower = better)
  const thresholds = [
    { level: 'S+', max: 99.5, pct: 1 },
    { level: 'S',  max: 98,   pct: 2 },
    { level: 'A+', max: 90,   pct: 10 },
    { level: 'A',  max: 80,   pct: 20 },
    { level: 'A-', max: 65,   pct: 35 },
    { level: 'B+', max: 50,   pct: 50 },
    { level: 'B',  max: 35,   pct: 65 },
    { level: 'C',  max: 15,   pct: 85 },
  ];

  // Simple score-to-percentile mapping
  const normalised = Math.min(100, Math.log1p(score) / Math.log1p(50000) * 100);

  for (const t of thresholds) {
    if (normalised >= 100 - t.pct) {
      return { level: t.level, percentile: t.pct, score };
    }
  }

  return { level: 'C', percentile: 85, score };
}
