#!/usr/bin/env node
import {
  GitHubClient, fetchUserData, fetchAllRepositories,
  fetchOrganizationsDetailed,
} from './fetchers/github.js';
import { buildStatsData, extractTopLanguageColors } from './fetchers/aggregator.js';
import { generateDynamicPalette, buildGradientsFromPalette } from './utils/color.js';
import { FileCache, withCache } from './utils/cache.js';
import { renderStatsCard2D } from './cards/stats-2d.js';
import { renderLangCardByCommit, renderLangCardByRepo } from './cards/lang-card.js';
import { renderStatsCard3D } from './cards/topo-3d.js';
import { renderStreakCard } from './cards/streak-card.js';
import { renderOrgCard } from './cards/org-card.js';
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
  console.log('║    GitHub Stats SVG Generator  v1.1      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!CONFIG.token)    throw new Error('GITHUB_TOKEN env variable is required');
  if (!CONFIG.username) throw new Error('GITHUB_USERNAME env variable is required');

  const cache = new FileCache(CONFIG.cacheDir, CONFIG.cacheTTL);
  await cache.init();
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const client = new GitHubClient(CONFIG.token);

  // ── Fetch ──────────────────────────────────────────────────
  console.log(`📡 Fetching GitHub data for @${CONFIG.username}...\n`);

  const [user, repositories, orgsDetailed] = await Promise.all([
    withCache(cache, `user:${CONFIG.username}`, () =>
      fetchUserData(client, CONFIG.username)),
    withCache(cache, `repos:${CONFIG.username}`, () =>
      fetchAllRepositories(client, CONFIG.username)),
    withCache(cache, `orgs:${CONFIG.username}`, () =>
      fetchOrganizationsDetailed(client, CONFIG.username)),
  ]);

  console.log(`\n✅ @${user.login} (${user.name ?? 'no name'})`);
  console.log(`   Public repos: ${repositories.length}`);
  console.log(`   Followers: ${user.followers.totalCount} | Following: ${user.following.totalCount}`);
  console.log(`   Contributions this year: ${user.contributionsCollection.contributionCalendar.totalContributions}`);
  console.log(`   Organizations: ${orgsDetailed.length}`);

  // ── Merge org data: REST avatars override GraphQL placeholder ──
  // GraphQL gives org list user is member of; REST enriches with real avatarUrl
  const mergedOrgs = orgsDetailed.length > 0
    ? orgsDetailed
    : user.organizations.nodes.map((o) => ({
        login: o.login, name: o.name, avatarUrl: o.avatarUrl,
        description: o.description, url: o.url,
      }));

  // Patch user.organizations.nodes with real avatar data
  user.organizations.nodes = mergedOrgs.map((ro) => {
    const gql = user.organizations.nodes.find((g) => g.login === ro.login);
    return {
      login: ro.login,
      name: ro.name || gql?.name || ro.login,
      avatarUrl: ro.avatarUrl || gql?.avatarUrl || '',
      description: ro.description || gql?.description || '',
      url: ro.url || gql?.url || `https://github.com/${ro.login}`,
    };
  });
  user.organizations.totalCount = mergedOrgs.length;

  // ── Process ────────────────────────────────────────────────
  console.log('\n⚙️  Processing stats...');
  const stats = buildStatsData(user, repositories);
  const fullStats = { ...stats, topContributors: new Map() };

  console.log(`   Languages: ${stats.languageStats.length}`);
  console.log(`   Streak: ${stats.streak.currentStreak}d current / ${stats.streak.longestStreak}d longest`);

  // ── Dynamic Theme ──────────────────────────────────────────
  const topColors = extractTopLanguageColors(stats.languageStats, 3);
  const palette   = generateDynamicPalette(topColors, 'dark');
  const grads     = buildGradientsFromPalette(palette, CONFIG.animated);
  const gradMap   = {
    'grad-bg': grads.bg, 'grad-accent': grads.accent,
    'grad-chart': grads.chart, 'grad-glow': grads.glow,
  };

  console.log(`\n🎨 Palette from top languages:`);
  stats.languageStats.slice(0, 3).forEach((l) =>
    console.log(`   ${l.name}: ${l.color} (${l.commitPercent}% commits)`));

  // ── Render ─────────────────────────────────────────────────
  console.log('\n🖼️  Rendering SVG cards...');

  await writeSVG('stats-2d.svg',
    renderStatsCard2D(fullStats, palette, gradMap, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('stats-3d.svg',
    renderStatsCard3D(fullStats, palette, gradMap, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('langs-commit.svg',
    renderLangCardByCommit(fullStats, palette, gradMap, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('langs-repo.svg',
    renderLangCardByRepo(fullStats, palette, gradMap, CONFIG.animated),
    CONFIG.outputDir);

  await writeSVG('streak.svg',
    renderStreakCard(fullStats, palette, gradMap, CONFIG.animated),
    CONFIG.outputDir);

  if (mergedOrgs.length > 0) {
    await writeSVG('orgs.svg',
      renderOrgCard(fullStats, palette, gradMap, CONFIG.animated),
      CONFIG.outputDir);
  } else {
    console.log('  · orgs.svg skipped (no public orgs)');
  }

  // ── Rate limit summary ─────────────────────────────────────
  const rl = client.getRateLimit();
  if (rl) {
    const resetIn = Math.max(0, Math.round((rl.resetAt.getTime() - Date.now()) / 60000));
    console.log(`\n📊 Rate limit: ${rl.remaining}/${rl.limit} remaining (resets in ${resetIn}m)`);
  }

  // ── Snapshot JSON ──────────────────────────────────────────
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    username: user.login, name: user.name,
    palette,
    streak: stats.streak,
    topLanguages: stats.languageStats.slice(0, 8).map((l) => ({
      name: l.name, color: l.color,
      commitPct: l.commitPercent, repoPct: l.repoPercent,
    })),
    orgs: mergedOrgs.map((o) => o.login),
    repoCount: repositories.length,
    followers: user.followers.totalCount,
    following: user.following.totalCount,
  };
  await fs.writeFile(
    join(CONFIG.outputDir, 'meta.json'),
    JSON.stringify(snapshot, null, 2)
  );

  console.log('\n✨ Done!\n');
  console.log('Embed in README:');
  console.log('```markdown');
  console.log(`![Stats](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/stats-2d.svg)`);
  console.log(`![3D Contributions](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/stats-3d.svg)`);
  console.log(`![Languages](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/langs-commit.svg)`);
  console.log(`![Streak](https://raw.githubusercontent.com/${user.login}/${user.login}/main/output/streak.svg)`);
  console.log('```\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
