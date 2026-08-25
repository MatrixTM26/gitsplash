import type { ContributorStat } from '../types/index.js';
import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  svgRect, svgText, svgCircle,
  buildCardShell, fmtNum,
  type CardShellOptions,
} from '../renderers/base.js';
import { mix } from '../utils/color.js';

const W = 495;

// ============================================================
// Contributor Card
// ============================================================

export function renderContributorCard(
  repoName: string,
  contributors: ContributorStat[],
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true
): string {
  const top = contributors.slice(0, 6);
  const H = 56 + Math.ceil(top.length / 2) * 60 + 20;

  const body = buildContributorGrid(top, palette, animated);

  const shellOpts: CardShellOptions = {
    width: W, height: H,
    palette, gradients, animated,
    title: `Top Contributors`,
    titleIcon: '◉',
    subtitle: repoName,
  };

  return buildCardShell(shellOpts, body);
}

// ── Contributor Grid (2 columns) ──────────────────────────────

function buildContributorGrid(
  contributors: ContributorStat[],
  palette: DynamicPalette,
  animated: boolean
): string {
  const colW = (W - 32 - 10) / 2;
  const rowH = 56;

  return contributors.map((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 16 + col * (colW + 10);
    const y = row * (rowH + 6);
    const delay = animated ? 0.1 + i * 0.07 : 0;

    return buildContributorRow(c, i + 1, x, y, colW, palette, animated, delay);
  }).join('');
}

function buildContributorRow(
  c: ContributorStat,
  rank: number,
  x: number, y: number,
  w: number,
  palette: DynamicPalette,
  animated: boolean,
  delay: number
): string {
  const h = 52;
  const barAreaW = w - 70;
  const barH = 5;
  const barFill = Math.max(4, (c.percent / 100) * barAreaW);

  // Container
  const bg = svgRect({
    x, y, w, h, rx: 7,
    fill: palette.surface,
    stroke: rank === 1 ? palette.primary : palette.border,
    strokeWidth: rank === 1 ? 0.8 : 0.4,
    opacity: 0.8,
  });

  // Rank badge
  const rankBg = svgRect({
    x: x + 6, y: y + 6, w: 18, h: 18, rx: 4,
    fill: rank <= 3
      ? [palette.primary, palette.secondary, palette.tertiary][rank - 1]
      : mix(palette.surface, palette.border, 0.8),
    opacity: 0.9,
  });
  const rankEl = svgText({
    x: x + 15, y: y + 15,
    text: `${rank}`, fontSize: 10, fontWeight: 700,
    fill: rank <= 3 ? '#fff' : palette.textMuted,
    anchor: 'middle', dominantBaseline: 'middle',
  });

  // Avatar circle
  const avatarColor = stringToColor(c.login, palette);
  const avatarX = x + 32;
  const avatarY = y + 15;
  const avatarBg = svgCircle(avatarX, avatarY, 12, avatarColor, palette.border, 0.3);
  const initials = svgText({
    x: avatarX, y: avatarY,
    text: c.login.slice(0, 2).toUpperCase(),
    fontSize: 9, fontWeight: 700,
    fill: '#fff', anchor: 'middle', dominantBaseline: 'middle',
  });

  // Name + login
  const nameEl = svgText({
    x: x + 48, y: y + 11,
    text: truncate(c.name || c.login, 12),
    fontSize: 11, fontWeight: 600,
    fill: palette.text, dominantBaseline: 'middle',
  });

  const loginEl = svgText({
    x: x + 48, y: y + 23,
    text: `@${truncate(c.login, 12)}`,
    fontSize: 9, fill: palette.textMuted,
    dominantBaseline: 'middle',
  });

  // Commit count
  const commitsEl = svgText({
    x: x + w - 8, y: y + 17,
    text: fmtNum(c.commitCount),
    fontSize: 11, fontWeight: 700,
    fill: rank === 1 ? palette.primary : palette.text,
    anchor: 'end', dominantBaseline: 'middle',
  });

  const commitsLabel = svgText({
    x: x + w - 8, y: y + 29,
    text: 'commits',
    fontSize: 8, fill: palette.textMuted,
    anchor: 'end', opacity: 0.7,
  });

  // Progress bar
  const barY = y + h - 9;
  const barTrack = svgRect({
    x: x + 4, y: barY,
    w: w - 8, h: barH, rx: barH / 2,
    fill: palette.border, opacity: 0.3,
  });

  const barColor = rank <= 3
    ? [palette.primary, palette.secondary, palette.tertiary][rank - 1]
    : mix(palette.primary, palette.border, 0.5);

  const barFillEl = `
    <rect x="${x + 4}" y="${barY}" width="${animated ? 0 : barFill}" height="${barH}"
      rx="${barH / 2}" fill="${barColor}" opacity="0.8">
      <title>${c.login}: ${c.percent.toFixed(1)}%</title>
      ${animated
        ? `<animate attributeName="width" from="0" to="${barFill}"
            dur="0.7s" begin="${delay}s" fill="freeze" calcMode="spline"
            keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>`
        : ''}
    </rect>`;

  const fadeIn = animated
    ? `<animate attributeName="opacity" from="0" to="1"
        dur="0.4s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
    : '';

  return `
    <g opacity="${animated ? 0 : 1}">
      ${bg}${rankBg}${rankEl}${avatarBg}${initials}
      ${nameEl}${loginEl}${commitsEl}${commitsLabel}
      ${barTrack}${barFillEl}
      ${fadeIn}
    </g>`;
}

// ── Utility ───────────────────────────────────────────────────

function stringToColor(str: string, palette: DynamicPalette): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const opts = [palette.primary, palette.secondary, palette.tertiary];
  return opts[Math.abs(hash) % opts.length];
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
