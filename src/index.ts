#!/usr/bin/env node
import { GitHubClient, fetchUserData, fetchAllRepositories } from './fetchers/github.js';
import { buildStatsData, extractTopLanguageColors, aggregateContributors } from './fetchers/aggregator.js';
import { generateDynamicPalette, buildGradientsFromPalette } from './utils/color.js';
import { FileCache, withCache } from './utils/cache.js';
import { renderStatsCard2D } from './cards/stats-2d.js';
import { renderLangCardByCommit, renderLangCardByRepo } from './cards/lang-card.js';
import { renderStatsCard3D } from './cards/topo-3d.js';
import { renderStreakCard } from './cards/streak-card.js';
import { renderOrgCard } from './cards/org-card.js';
import { renderContributorCard } from './cards/contributor-card.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================
// Config from environment
// ============================================================
const CONFIG = {
  token:     process.env.GITHUB_TOKEN ?? '',
  username:  process.env.GITHUB_USERNAME ?? '',
  outputDir: process.env.OUTPUT_DIR ?? 'output',
  cacheDir:  process.env.CACHE_DIR ?? '.cache',
  cacheTTL:  parseInt(process.env.CACHE_TTL ?? '120'),
  animated:  process.env.ANIMATED !== 'false',
  topRepo:   process.env.TOP_REPO ?? '',
};

// ============================================================
// Write helper
// ============================================================
async function writeSVG(name: string, svg: string, outDir: string): Promise<void> {
  if (!svg) { console.warn(`  ⚠ Skipped ${name} (empty output)`); return; }
  const path = join(outDir, name);
  await fs.writeFile(path, svg, 'utf-8');
  const kb = (Buffer.byteLength(svg, 'utf-8') / 1024).toFixed(1);
  console.log(`  ✓ ${name} (${kb} KB)`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    GitHub Stats SVG Generator  v1.0      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!CONFIG.token)    throw new Error('GITHUB_TOKEN env variable is required');
  if (!CONFIG.username) throw new Error('GITHUB_USERNAME env variable is required');

  const cache = new FileCache(CONFIG.cacheDir, CONFIG.cacheTTL);
  await cache.init();
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const client = new GitHubClient(CONFIG.token);

  // ── Fetch ──────────────────────────────────────────────────
  console.log(`📡 Fetching GitHub data for @${CONFIG.username}...\n`);

  const [user, repositories] = await Promise.all([
    withCache(cache, `user:${CONFIG.username}`, () =>
      fetchUserData(client, CONFIG.username)),
    withCache(cache, `repos:${CONFIG.username}`, () =>
      fetchAllRepositories(client, CONFIG.username)),
  ]);

  console.log(`\n✅ @${user.login} (${user.name})`);
  console.log(`   Repos: ${repositories.length}  |  Followers: ${user.followers.totalCount}`);
  console.log(`   Contributions: ${user.contributionsCollection.contributionCalendar.totalContributions}`);

  // ── Aggregate ──────────────────────────────────────────────
  console.log('\n⚙️  Processing...');
  const stats = buildStatsData(user, repositories);

  // ── Theme ──────────────────────────────────────────────────
  const topColors = extractTopLanguageColors(stats.languageStats, 3);
  const palette   = generateDynamicPalette(topColors, 'dark');
  const gradients = buildGradientsFromPalette(palette, CONFIG.animated);
  const grads     = { 'grad-bg': gradients.bg, 'grad-accent': gradients.accent,
                      'grad-chart': gradients.chart, 'grad-glow': gradients.glow };

  console.log(`\n🎨 Palette: ${palette.primary} → ${palette.secondary} → ${palette.tertiary}`);

  const fullStats = { ...stats, topContributors: new Map() };

  // ── Render all cards ───────────────────────────────────────
  console.log('\n🖼️  Rendering SVG cards...');

  await writeSVG('stats-2d.svg',
    renderStatsCard2D(fullStats, palette, grads, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('stats-3d.svg',
    renderStatsCard3D(fullStats, palette, grads, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('langs-commit.svg',
    renderLangCardByCommit(fullStats, palette, grads, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('langs-repo.svg',
    renderLangCardByRepo(fullStats, palette, grads, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('streak.svg',
    renderStreakCard(fullStats, palette, grads, CONFIG.animated),
    CONFIG.outputDir);

  if (user.organizations.nodes.length > 0) {
    await writeSVG('orgs.svg',
      renderOrgCard(fullStats, palette, grads, CONFIG.animated),
      CONFIG.outputDir);
  }

  // Contributor card (top starred repo)
  const topRepo = CONFIG.topRepo
    ? repositories.find((r) => r.name === CONFIG.topRepo)
    : repositories.sort((a, b) => b.stargazerCount - a.stargazerCount)[0];

  if (topRepo) {
    console.log(`  · Contributor card for: ${topRepo.nameWithOwner}`);
    // Mock contributors from REST (real fetch needs auth scope)
    const mockContribs = aggregateContributors(
      [{ login: user.login, name: user.name, avatarUrl: user.avatarUrl,
         url: `https://github.com/${user.login}`, contributions: totalCommits(stats) }],
      undefined
    );
    await writeSVG('contributors.svg',
      renderContributorCard(topRepo.nameWithOwner, mockContribs, palette, grads, CONFIG.animated),
      CONFIG.outputDir);
  }

  // ── Save JSON snapshot ─────────────────────────────────────
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    username: user.login,
    palette,
    streak: stats.streak,
    langCount: stats.languageStats.length,
    repoCount: repositories.length,
    topLanguages: stats.languageStats.slice(0, 5).map((l) => ({ name: l.name, color: l.color, pct: l.commitPercent })),
  };
  await fs.writeFile(join(CONFIG.outputDir, 'meta.json'), JSON.stringify(snapshot, null, 2));

  // ── Rate limit summary ─────────────────────────────────────
  const rl = client.getRateLimit();
  if (rl) {
    console.log(`\n📊 API rate limit: ${rl.remaining}/${rl.limit} remaining`);
  }

  console.log('\n✨ All done!\n');
  console.log('Add to your README:');
  console.log('```markdown');
  console.log(`![Stats](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/stats-2d.svg)`);
  console.log(`![3D](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/stats-3d.svg)`);
  console.log(`![Langs](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/langs-commit.svg)`);
  console.log('```\n');
}

function totalCommits(stats: ReturnType<typeof buildStatsData>): number {
  const c = stats.user.contributionsCollection;
  return c.totalCommitContributions + c.restrictedContributionsCount;
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
