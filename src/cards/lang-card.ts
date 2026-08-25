import type { StatsData, LanguageStat } from '../types/index.js';
import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  svgRect, svgText, svgCircle,
  buildCardShell, escapeXml,
  type CardShellOptions,
} from '../renderers/base.js';

const W = 495;
const H_DONUT = 200;
const H_BARS  = 195;

// ============================================================
// Language Card — By Commit (3D Donut)
// ============================================================

export function renderLangCardByCommit(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true,
  topN = 8
): string {
  const langs = stats.languageStats
    .filter((l) => l.commitCount > 0)
    .slice(0, topN);

  if (!langs.length) return '';

  const body = buildDonutChart(langs, 'commit', palette, animated);

  const shellOpts: CardShellOptions = {
    width: W, height: H_DONUT,
    palette, gradients, animated,
    title: 'Most Used Languages',
    titleIcon: '◈',
    subtitle: 'by commit count · this year',
    footerText: `${langs.length} languages · ${langs.reduce((s, l) => s + l.commitCount, 0).toLocaleString()} total commits`,
  };

  return buildCardShell(shellOpts, body);
}

// ============================================================
// Language Card — By Repo (Horizontal Bars)
// ============================================================

export function renderLangCardByRepo(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true,
  topN = 8
): string {
  const langs = stats.languageStats
    .filter((l) => l.repoCount > 0)
    .sort((a, b) => b.repoCount - a.repoCount)
    .slice(0, topN);

  if (!langs.length) return '';

  const body = buildBarChart(langs, 'repo', palette, animated);

  const shellOpts: CardShellOptions = {
    width: W, height: H_BARS,
    palette, gradients, animated,
    title: 'Languages by Repository',
    titleIcon: '⊞',
    subtitle: 'primary language per repo',
    footerText: `${stats.repositories.filter((r) => !r.isFork).length} repos analysed`,
  };

  return buildCardShell(shellOpts, body);
}

// ============================================================
// Donut Chart (for commit distribution)
// ============================================================

function buildDonutChart(
  langs: LanguageStat[],
  mode: 'commit' | 'repo' | 'bytes',
  palette: DynamicPalette,
  animated: boolean
): string {
  const cx = 100;
  const cy = 65;
  const outerR = 60;
  const innerR = 38;

  // ── Compute slices ─────────────────────────────────────────
  const total = langs.reduce((s, l) =>
    s + (mode === 'commit' ? l.commitCount : mode === 'repo' ? l.repoCount : l.byteSize), 0
  );

  interface Slice {
    lang: LanguageStat;
    startAngle: number;
    endAngle: number;
    pct: number;
  }

  const slices: Slice[] = [];
  let angle = -Math.PI / 2; // Start at top

  for (const lang of langs) {
    const val = mode === 'commit' ? lang.commitCount : mode === 'repo' ? lang.repoCount : lang.byteSize;
    const pct = val / total;
    const span = pct * 2 * Math.PI;
    slices.push({
      lang,
      startAngle: angle,
      endAngle: angle + span,
      pct,
    });
    angle += span;
  }

  // ── Slice paths ────────────────────────────────────────────
  const slicePaths = slices.map((s, i) => {
    const path = arcPath(cx, cy, outerR, innerR, s.startAngle, s.endAngle);
    const delay = animated ? 0.05 * i : 0;

    // 3D-ish effect: extrude bottom slices slightly
    const depth = 4;
    const midAngle = (s.startAngle + s.endAngle) / 2;
    const isBottom = midAngle > 0 && midAngle < Math.PI;
    void (isBottom ? depth : 0); // extrudeY reserved for 3D depth

    const shadow = isBottom
      ? `<path d="${arcPath(cx, cy + depth, outerR, innerR, s.startAngle, s.endAngle)}"
            fill="${s.lang.color}" opacity="0.3"/>`
      : '';

    const fadeIn = animated
      ? `<animate attributeName="opacity" from="0" to="1"
          dur="0.4s" begin="${delay}s" fill="freeze"/>`
      : '';

    const hoverStyle = `
      style="cursor:pointer"
      onmouseenter="this.style.opacity='0.85'"
      onmouseleave="this.style.opacity='1'"`;

    return `
      <g opacity="${animated ? 0 : 1}">
        ${shadow}
        <path d="${path}" fill="${s.lang.color}" ${hoverStyle}>
          <title>${escapeXml(s.lang.name)}: ${(s.pct * 100).toFixed(1)}%</title>
          ${fadeIn}
        </path>
      </g>`;
  }).join('');

  // ── Center label ───────────────────────────────────────────
  const centerLabel = `
    ${svgText({ x: cx, y: cy - 8, text: langs[0]?.name ?? '', fontSize: 11, fontWeight: 700,
      fill: palette.text, anchor: 'middle', dominantBaseline: 'middle' })}
    ${svgText({ x: cx, y: cy + 8, text: `${((langs[0]?.commitPercent ?? 0)).toFixed(1)}%`, fontSize: 14,
      fontWeight: 700, fill: palette.primary, anchor: 'middle', dominantBaseline: 'middle' })}`;

  // ── Legend ─────────────────────────────────────────────────
  const legendStartX = 185;
  const legendStartY = 4;
  const legendColW = 150;
  const legendRowH = 18;
  const cols = 2;

  const legendItems = slices.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = legendStartX + col * legendColW;
    const ly = legendStartY + row * legendRowH;
    const delay = animated ? 0.3 + i * 0.05 : 0;

    const dot = svgCircle(lx + 6, ly + 7, 5, s.lang.color);
    const name = svgText({
      x: lx + 16, y: ly + 8,
      text: s.lang.name.slice(0, 14),
      fontSize: 11, fill: palette.text,
      dominantBaseline: 'middle',
    });
    const pctEl = svgText({
      x: lx + legendColW - 8, y: ly + 8,
      text: `${(s.pct * 100).toFixed(1)}%`,
      fontSize: 10, fill: palette.textMuted,
      anchor: 'end', dominantBaseline: 'middle',
    });

    const fadeIn = animated
      ? `<animate attributeName="opacity" from="0" to="1"
          dur="0.4s" begin="${delay}s" fill="freeze"/>`
      : '';

    return `<g opacity="${animated ? 0 : 1}">${dot}${name}${pctEl}${fadeIn}</g>`;
  }).join('');

  return `
    <g>${slicePaths}</g>
    <g>${centerLabel}</g>
    <g>${legendItems}</g>`;
}

// ============================================================
// Horizontal Bar Chart (for repo distribution)
// ============================================================

function buildBarChart(
  langs: LanguageStat[],
  mode: 'commit' | 'repo' | 'bytes',
  palette: DynamicPalette,
  animated: boolean
): string {
  const maxVal = Math.max(...langs.map((l) =>
    mode === 'commit' ? l.commitCount : mode === 'repo' ? l.repoCount : l.byteSize
  ));

  const barAreaW = W - 32 - 110 - 50; // pad - label - value
  const labelW = 110;
  const rowH = 20;
  const barH = 10;
  const startX = 16 + labelW;
  const startY = 4;

  const rows = langs.map((lang, i) => {
    const val = mode === 'commit' ? lang.commitCount : mode === 'repo' ? lang.repoCount : lang.byteSize;
    const pct = mode === 'commit' ? lang.commitPercent : mode === 'repo' ? lang.repoPercent : lang.bytePercent;
    const barW = Math.max(2, (val / maxVal) * barAreaW);
    const y = startY + i * rowH;
    const midY = y + rowH / 2;
    const delay = animated ? 0.1 + i * 0.06 : 0;

    // Language dot + name
    const dot = svgCircle(24, midY, 4, lang.color);
    const name = svgText({
      x: 34, y: midY,
      text: lang.name.slice(0, 14),
      fontSize: 11, fill: palette.text,
      dominantBaseline: 'middle',
    });

    // Track (background)
    const track = svgRect({
      x: startX, y: midY - barH / 2,
      w: barAreaW, h: barH,
      rx: barH / 2, fill: palette.surface,
      opacity: 0.5,
    });

    // Filled bar
    const bar = `
      <rect x="${startX}" y="${midY - barH / 2}" width="${animated ? 0 : barW}" height="${barH}"
        rx="${barH / 2}" fill="${lang.color}" opacity="0.9">
        ${animated ? `<animate attributeName="width" from="0" to="${barW}"
          dur="0.8s" begin="${delay}s" fill="freeze" calcMode="spline"
          keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>` : ''}
      </rect>`;

    // Glow on bar end
    const glow = `
      <circle cx="${startX + (animated ? 0 : barW)}" cy="${midY}" r="3"
        fill="${lang.color}" filter="url(#glow-filter)" opacity="0.8">
        ${animated ? `<animate attributeName="cx" from="${startX}" to="${startX + barW}"
          dur="0.8s" begin="${delay}s" fill="freeze" calcMode="spline"
          keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>
          <animate attributeName="opacity" from="0" to="0.8"
          dur="0.3s" begin="${delay + 0.5}s" fill="freeze"/>` : ''}
      </circle>`;

    // Percentage label
    const pctEl = svgText({
      x: startX + barAreaW + 8, y: midY,
      text: `${pct.toFixed(1)}%`,
      fontSize: 10, fill: palette.textMuted,
      dominantBaseline: 'middle',
    });

    const fadeIn = animated
      ? `<animate attributeName="opacity" from="0" to="1"
          dur="0.3s" begin="${delay}s" fill="freeze"/>`
      : '';

    return `
      <g opacity="${animated ? 0 : 1}">
        ${dot}${name}${track}${bar}${glow}${pctEl}
        ${fadeIn}
      </g>`;
  });

  return `<g>${rows.join('')}</g>`;
}

// ============================================================
// Arc path helper (donut segment)
// ============================================================

function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number
): string {
  const GAP = 0.02; // small gap between slices
  const sa = startAngle + GAP;
  const ea = endAngle - GAP;

  const x1o = cx + outerR * Math.cos(sa);
  const y1o = cy + outerR * Math.sin(sa);
  const x2o = cx + outerR * Math.cos(ea);
  const y2o = cy + outerR * Math.sin(ea);

  const x1i = cx + innerR * Math.cos(ea);
  const y1i = cy + innerR * Math.sin(ea);
  const x2i = cx + innerR * Math.cos(sa);
  const y2i = cy + innerR * Math.sin(sa);

  const largeArc = ea - sa > Math.PI ? 1 : 0;

  return [
    `M ${x1o} ${y1o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    'Z',
  ].join(' ');
}
