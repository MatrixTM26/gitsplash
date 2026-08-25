import type { StatsData, ContributionDay } from '../types/index.js';
import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import { svgText, buildCardShell, type CardShellOptions } from '../renderers/base.js';
import { mix, darken, lighten } from '../utils/color.js';

const W = 495;
const H = 280;

// ============================================================
// 3D Isometric Contribution Topography Card
// ============================================================

export function renderStatsCard3D(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true
): string {
  const weeks = stats.user.contributionsCollection.contributionCalendar.weeks;
  const days: ContributionDay[] = weeks.flatMap((w) => w.contributionDays);

  // ── Isometric grid config ─────────────────────────────────
  const cfg: IsoConfig = {
    cellW: 10,    // tile width in iso space
    cellH: 10,    // tile depth in iso space
    tileGap: 1,   // gap between tiles
    maxHeight: 30,  // max bar height px
    originX: W / 2, // iso origin x
    originY: 210,   // iso origin y
    cols: 53,
    rows: 7,
  };

  const maxCount = Math.max(...days.map((d) => d.contributionCount), 1);

  const body = [
    buildIsoGrid(days, weeks, cfg, maxCount, palette, animated),
    buildAxisLabels(weeks, cfg, palette),
    buildLegend(maxCount, palette, W),
    buildSummary(stats, palette, animated),
  ].join('');

  const shellOpts: CardShellOptions = {
    width: W, height: H,
    palette, gradients, animated,
    title: '3D Contribution Topography',
    titleIcon: '◈',
    subtitle: `${stats.streak.totalContributions.toLocaleString()} contributions · ${new Date().getFullYear()}`,
  };

  return buildCardShell(shellOpts, body);
}

// ============================================================
// Isometric Grid
// ============================================================

interface IsoConfig {
  cellW: number; cellH: number;
  tileGap: number; maxHeight: number;
  originX: number; originY: number;
  cols: number; rows: number;
}

/** Convert grid (col, row) to isometric screen coords */
function isoProject(col: number, row: number, cfg: IsoConfig): [number, number] {
  const { cellW, cellH, originX, originY } = cfg;
  const tileW = cellW - cfg.tileGap;
  const tileH = cellH - cfg.tileGap;

  const x = originX + (col - row) * (tileW / 2);
  const y = originY + (col + row) * (tileH / 4);
  return [x, y];
}

function buildIsoGrid(
  days: ContributionDay[],
  weeks: StatsData['user']['contributionsCollection']['contributionCalendar']['weeks'],
  cfg: IsoConfig,
  maxCount: number,
  palette: DynamicPalette,
  animated: boolean
): string {
  const tiles: string[] = [];

  // Build day map for quick lookup
  const dayMap = new Map<string, ContributionDay>();
  for (const d of days) {
    dayMap.set(d.date, d);
  }

  // Render back-to-front (painter's algorithm) — col+row ascending
  for (let row = 6; row >= 0; row--) {
    for (let col = 0; col < weeks.length; col++) {
      const week = weeks[col];
      if (!week) continue;

      const day = week.contributionDays[row];
      if (!day) continue;

      const count = day.contributionCount;
      const normalised = count / maxCount;

      // Height proportional to contribution count (min 1px for visibility)
      const barH = count === 0 ? 1 : Math.max(3, normalised * cfg.maxHeight);

      const [sx, sy] = isoProject(col, row, cfg);

      tiles.push(buildIsoTile(sx, sy, barH, count, normalised, palette, cfg, animated, col, row));
    }
  }

  return `<g>${tiles.join('')}</g>`;
}

function buildIsoTile(
  sx: number, sy: number,
  barH: number, count: number, normalised: number,
  palette: DynamicPalette,
  cfg: IsoConfig,
  animated: boolean,
  col: number, row: number
): string {
  const tw = (cfg.cellW - cfg.tileGap) / 2; // half-tile width
  const td = (cfg.cellH - cfg.tileGap) / 4; // quarter-tile depth

  // Color: interpolate from surface → primary → secondary based on intensity
  let tileColor: string;
  if (count === 0) {
    tileColor = mix(palette.background, palette.border, 0.5);
  } else if (normalised < 0.25) {
    tileColor = mix(palette.border, palette.primary, normalised * 4);
  } else if (normalised < 0.75) {
    tileColor = mix(palette.primary, palette.secondary, (normalised - 0.25) * 2);
  } else {
    tileColor = mix(palette.secondary, palette.tertiary, (normalised - 0.75) * 4);
  }

  const topColor = count === 0 ? tileColor : lighten(tileColor, 10);
  const leftColor = count === 0 ? tileColor : darken(tileColor, 15);
  const rightColor = count === 0 ? tileColor : darken(tileColor, 25);

  // Top face
  const topFace = isoFaceTop(sx, sy - barH, tw, td, topColor);
  // Left face (if has height)
  const leftFace = barH > 1 ? isoFaceLeft(sx, sy, sx, sy - barH, tw, td, barH, leftColor) : '';
  // Right face
  const rightFace = barH > 1 ? isoFaceRight(sx, sy, sx, sy - barH, tw, td, barH, rightColor) : '';

  // Glow on top-5% tiles
  const isHot = normalised > 0.85;
  const glowAttr = isHot
    ? `filter="url(#glow-filter)"`
    : '';

  const delay = animated ? (col * 0.015 + row * 0.01) : 0;

  const animAttr = animated
    ? `<animateTransform attributeName="transform" type="translate"
        from="0 ${barH}" to="0 0"
        dur="0.4s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>
       <animate attributeName="opacity" from="0" to="1"
        dur="0.3s" begin="${delay}s" fill="freeze"/>`
    : '';

  const tooltip = `<title>${count} contribution${count !== 1 ? 's' : ''}</title>`;

  return `
    <g opacity="${animated ? 0 : 1}" ${glowAttr} style="cursor:pointer">
      ${tooltip}
      ${rightFace}
      ${leftFace}
      ${topFace}
      ${animAttr}
    </g>`;
}

// ── Isometric face builders ────────────────────────────────────

function isoFaceTop(sx: number, sy: number, tw: number, td: number, fill: string): string {
  // Diamond top face
  const pts = [
    [sx, sy - td],          // top
    [sx + tw, sy],           // right
    [sx, sy + td],           // bottom
    [sx - tw, sy],           // left
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="0.3"/>`;
}

function isoFaceLeft(
  sx: number, sy: number,
  _sx2: number, sy2: number,
  tw: number, td: number, _barH: number,
  fill: string
): string {
  const pts = [
    [sx - tw, sy],            // bottom-left
    [sx, sy + td],            // bottom-right
    [sx, sy2 + td],           // top-right
    [sx - tw, sy2],           // top-left
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="0.3"/>`;
}

function isoFaceRight(
  sx: number, sy: number,
  _sx2: number, sy2: number,
  tw: number, td: number, _barH: number,
  fill: string
): string {
  const pts = [
    [sx, sy + td],            // bottom-left
    [sx + tw, sy],            // bottom-right
    [sx + tw, sy2],           // top-right
    [sx, sy2 + td],           // top-left
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="0.3"/>`;
}

// ============================================================
// Axis Labels (month names)
// ============================================================

function buildAxisLabels(
  weeks: StatsData['user']['contributionsCollection']['contributionCalendar']['weeks'],
  cfg: IsoConfig,
  palette: DynamicPalette
): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const labels: string[] = [];
  let lastMonth = -1;

  weeks.forEach((week, col) => {
    const firstDay = week.contributionDays[0];
    if (!firstDay) return;

    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      const [x, y] = isoProject(col, 0, cfg);

      labels.push(svgText({
        x: x - 4, y: y - 2,
        text: months[month],
        fontSize: 9,
        fill: palette.textMuted,
        anchor: 'middle',
        opacity: 0.7,
      }));
    }
  });

  return `<g>${labels.join('')}</g>`;
}

// ============================================================
// Legend Bar (contribution density scale)
// ============================================================

function buildLegend(maxCount: number, palette: DynamicPalette, cardW: number): string {
  const levels = 5;
  const cellSize = 10;
  const gap = 3;
  const legendW = levels * (cellSize + gap);
  const startX = cardW - 16 - legendW;
  const y = H - 42; // relative to body (no title offset applied here since shell handles it)

  const cells = Array.from({ length: levels }, (_, i) => {
    const t = i / (levels - 1);
    let color: string;
    if (t === 0) color = mix(palette.background, palette.border, 0.5);
    else if (t < 0.5) color = mix(palette.border, palette.primary, t * 2);
    else color = mix(palette.primary, palette.tertiary, (t - 0.5) * 2);

    return `<rect x="${startX + i * (cellSize + gap)}" y="${y}"
      width="${cellSize}" height="${cellSize}"
      rx="2" fill="${color}" opacity="0.9"/>`;
  }).join('');

  const labels = [
    svgText({ x: startX - 4, y: y + 5, text: 'Less', fontSize: 9,
      fill: palette.textMuted, anchor: 'end', dominantBaseline: 'middle' }),
    svgText({ x: startX + legendW + 4, y: y + 5, text: 'More', fontSize: 9,
      fill: palette.textMuted, anchor: 'start', dominantBaseline: 'middle' }),
    svgText({ x: startX + legendW / 2, y: y + 18, text: `max ${maxCount}/day`, fontSize: 8,
      fill: palette.textMuted, anchor: 'middle', opacity: 0.6 }),
  ].join('');

  return `<g transform="translate(0, -56)">${cells}${labels}</g>`;
}

// ============================================================
// Summary Stats (bottom-left corner)
// ============================================================

function buildSummary(stats: StatsData, palette: DynamicPalette, animated: boolean): string {
  const { streak, user } = stats;
  const total = user.contributionsCollection.contributionCalendar.totalContributions;

  const items = [
    { icon: '⚑', label: 'Current Streak', value: `${streak.currentStreak}d` },
    { icon: '◈', label: 'Longest Streak', value: `${streak.longestStreak}d` },
    { icon: '✦', label: 'Total', value: total.toLocaleString() },
  ];

  const startY = H - 80;

  return items.map((item, i) => {
    const x = 16 + i * 120;
    const delay = animated ? 0.6 + i * 0.1 : 0;

    const iconEl = svgText({ x, y: startY, text: item.icon, fontSize: 12,
      fill: palette.primary, filter: 'glow-filter' });
    const labelEl = svgText({ x: x + 18, y: startY, text: item.label, fontSize: 9,
      fill: palette.textMuted, dominantBaseline: 'middle' });
    const valEl = svgText({ x: x + 18, y: startY + 14, text: item.value, fontSize: 14,
      fontWeight: 700, fill: palette.text });

    const fadeIn = animated
      ? `<animate attributeName="opacity" from="0" to="1"
          dur="0.4s" begin="${delay}s" fill="freeze"/>`
      : '';

    return `<g transform="translate(0, -56)" opacity="${animated ? 0 : 1}">${iconEl}${labelEl}${valEl}${fadeIn}</g>`;
  }).join('');
}
