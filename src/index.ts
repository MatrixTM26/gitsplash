#!/usr/bin/env node
import { GitHubClient, fetchUserData, fetchAllRepositories } from './fetchers/github.js';
import { buildStatsData, extractTopLanguageColors } from './fetchers/aggregator.js';
import { generateDynamicPalette, buildGradientsFromPalette } from './utils/color.js';
import { FileCache, withCache } from './utils/cache.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================
// Config from environment
// ============================================================
const CONFIG = {
  token: process.env.GITHUB_TOKEN ?? '',
  username: process.env.GITHUB_USERNAME ?? '',
  outputDir: process.env.OUTPUT_DIR ?? 'output',
  cacheDir: process.env.CACHE_DIR ?? '.cache',
  cacheTTL: parseInt(process.env.CACHE_TTL ?? '120'), // 2 hours
  animated: process.env.ANIMATED !== 'false',
  theme: (process.env.THEME ?? 'dynamic') as 'dynamic' | 'dark' | 'light',
};

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     GitHub Stats SVG Generator        ║');
  console.log('╚══════════════════════════════════════╝\n');

  if (!CONFIG.token) throw new Error('GITHUB_TOKEN env variable is required');
  if (!CONFIG.username) throw new Error('GITHUB_USERNAME env variable is required');

  // ── Setup ──────────────────────────────────────────────────
  const cache = new FileCache(CONFIG.cacheDir, CONFIG.cacheTTL);
  await cache.init();
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const client = new GitHubClient(CONFIG.token);

  // ── Fetch Data ─────────────────────────────────────────────
  console.log(`\n📡 Fetching data for @${CONFIG.username}...\n`);

  const [user, repositories] = await Promise.all([
    withCache(cache, `user:${CONFIG.username}`, () =>
      fetchUserData(client, CONFIG.username)
    ),
    withCache(cache, `repos:${CONFIG.username}`, () =>
      fetchAllRepositories(client, CONFIG.username)
    ),
  ]);

  console.log(`\n✅ Fetched: ${user.name} (@${user.login})`);
  console.log(`   Repos: ${repositories.length}`);
  console.log(`   Followers: ${user.followers.totalCount}`);
  console.log(
    `   Total contributions: ${user.contributionsCollection.contributionCalendar.totalContributions}`
  );

  // ── Process Data ───────────────────────────────────────────
  console.log('\n⚙️  Processing stats...');
  const stats = buildStatsData(user, repositories);

  console.log(`   Languages detected: ${stats.languageStats.length}`);
  console.log(`   Current streak: ${stats.streak.currentStreak} days`);
  console.log(`   Longest streak: ${stats.streak.longestStreak} days`);

  // ── Generate Dynamic Theme ─────────────────────────────────
  const topColors = extractTopLanguageColors(stats.languageStats, 3);
  console.log(`\n🎨 Top language colors: ${topColors.join(', ')}`);

  const palette = generateDynamicPalette(topColors, 'dark');
  const gradients = buildGradientsFromPalette(palette, CONFIG.animated);

  console.log(`   Primary: ${palette.primary}`);
  console.log(`   Secondary: ${palette.secondary}`);
  console.log(`   Tertiary: ${palette.tertiary}`);

  // ── Rate Limit Summary ─────────────────────────────────────
  const rl = client.getRateLimit();
  if (rl) {
    console.log(
      `\n📊 Rate limit: ${rl.remaining}/${rl.limit} remaining (resets ${rl.resetAt.toLocaleTimeString()})`
    );
  }
  console.log(`   API requests made: ${client.getRequestCount()}`);

  // ── Save processed stats as JSON (for renderers) ──────────
  const statsPath = join(CONFIG.outputDir, 'stats.json');
  await fs.writeFile(
    statsPath,
    JSON.stringify(
      {
        ...stats,
        palette,
        gradients,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`\n💾 Stats saved to ${statsPath}`);

  // ── Placeholder for card renderers (next phase) ───────────
  console.log('\n🖼️  Card rendering: (renderers not yet loaded — coming next)');
  console.log('   Will generate:');
  console.log('   · stats-2d.svg     — Commits, PRs, issues overview');
  console.log('   · stats-3d.svg     — 3D contribution topography');
  console.log('   · langs-commit.svg — Language breakdown by commits');
  console.log('   · langs-repo.svg   — Language breakdown by repos');
  console.log('   · orgs.svg         — Organization badges');
  console.log('   · streak.svg       — Contribution streak card');

  console.log('\n✨ Done!\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
