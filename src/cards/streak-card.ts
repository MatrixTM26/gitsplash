import type { StatsData, ContributionDay } from '../types/index.js';
import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  svgRect, svgText,
  animateFadeIn, buildCardShell, escapeXml,
  type CardShellOptions,
} from '../renderers/base.js';
import { mix, lighten } from '../utils/color.js';

const W = 495;
const H = 170;

// ============================================================
// Streak Card
// ============================================================

export function renderStreakCard(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true
): string {
  const { streak, user } = stats;
  const weeks = user.contributionsCollection.contributionCalendar.weeks;
  const days: ContributionDay[] = weeks.flatMap((w) => w.contributionDays);

  const body = [
    buildStreakCounters(streak, palette, animated),
    buildMiniHeatmap(days.slice(-91), palette, animated), // last 13 weeks
    buildFireAnimation(streak.currentStreak, palette, animated),
  ].join('');

  const shellOpts: CardShellOptions = {
    width: W, height: H,
    palette, gradients, animated,
    title: 'Contribution Streak',
    titleIcon: '🔥',
    subtitle: `First: ${streak.firstContribution ?? '—'} · Last: ${streak.lastContribution ?? '—'}`,
  };

  return buildCardShell(shellOpts, body);
}

// ── Three counter panels ─────────────────────────────────────

function buildStreakCounters(
  streak: StatsData['streak'],
  palette: DynamicPalette,
  animated: boolean
): string {
  const panels = [
    {
      label: 'Total Contributions',
      value: streak.totalContributions.toLocaleString(),
      icon: '◎',
      color: palette.secondary,
      delay: 0.1,
    },
    {
      label: 'Current Streak',
      value: `${streak.currentStreak} days`,
      icon: '⚑',
      color: palette.primary,
      delay: 0.2,
      highlight: true,
    },
    {
      label: 'Longest Streak',
      value: `${streak.longestStreak} days`,
      icon: '★',
      color: palette.tertiary,
      delay: 0.3,
    },
  ];

  const panelW = (W - 32 - 16) / 3;

  return panels.map((p, i) => {
    const x = 16 + i * (panelW + 8);
    const y = 4;

    const bg = svgRect({
      x, y, w: panelW, h: 64, rx: 8,
      fill: p.highlight ? mix(palette.surface, p.color, 0.12) : palette.surface,
      stroke: p.highlight ? p.color : palette.border,
      strokeWidth: p.highlight ? 1 : 0.5,
      opacity: 0.85,
    });

    const icon = svgText({
      x: x + panelW / 2, y: y + 16,
      text: p.icon, fontSize: 16,
      fill: p.color, anchor: 'middle',
      dominantBaseline: 'middle',
      filter: p.highlight ? 'glow-filter' : undefined,
    });

    const value = svgText({
      x: x + panelW / 2, y: y + 36,
      text: p.value,
      fontSize: p.highlight ? 16 : 14,
      fontWeight: 700,
      fill: p.highlight ? p.color : palette.text,
      anchor: 'middle', dominantBaseline: 'middle',
    });

    const label = svgText({
      x: x + panelW / 2, y: y + 53,
      text: p.label, fontSize: 9,
      fill: palette.textMuted, anchor: 'middle',
      letterSpacing: 0.2,
    });

    // Highlight glow ring
    const glowRing = p.highlight
      ? `<rect x="${x}" y="${y}" width="${panelW}" height="64" rx="8"
          fill="none" stroke="${p.color}" stroke-width="1" opacity="0">
          <animate attributeName="opacity" values="0;0.5;0"
            dur="2s" begin="${p.delay + 0.5}s" repeatCount="indefinite"/>
        </rect>`
      : '';

    const fadeIn = animated
      ? `<animate attributeName="opacity" from="0" to="1"
          dur="0.5s" begin="${p.delay}s" fill="freeze" calcMode="spline"
          keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
      : '';

    return `<g opacity="${animated ? 0 : 1}">${bg}${icon}${value}${label}${glowRing}${fadeIn}</g>`;
  }).join('');
}

// ── Mini heatmap (last 13 weeks) ─────────────────────────────

function buildMiniHeatmap(
  days: ContributionDay[],
  palette: DynamicPalette,
  animated: boolean
): string {
  const maxCount = Math.max(...days.map((d) => d.contributionCount), 1);
  const cellSize = 8;
  const gap = 2;
  const cols = 13;
  const rows = 7;
  const startX = 16;
  const startY = 82;

  const cells = days.slice(-(cols * rows)).map((day, idx) => {
    const col = Math.floor(idx / rows);
    const row = idx % rows;
    const x = startX + col * (cellSize + gap);
    const y = startY + row * (cellSize + gap);
    const t = day.contributionCount / maxCount;

    let fill: string;
    if (day.contributionCount === 0) {
      fill = mix(palette.background, palette.border, 0.4);
    } else if (t < 0.33) {
      fill = mix(palette.border, palette.primary, t * 3);
    } else if (t < 0.67) {
      fill = mix(palette.primary, palette.secondary, (t - 0.33) * 3);
    } else {
      fill = mix(palette.secondary, palette.tertiary, (t - 0.67) * 3);
    }

    const delay = animated ? 0.4 + col * 0.03 : 0;

    return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5"
      fill="${fill}" opacity="${animated ? 0 : 0.9}">
      <title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title>
      ${animated
        ? `<animate attributeName="opacity" from="0" to="0.9"
            dur="0.3s" begin="${delay}s" fill="freeze"/>
           <animate attributeName="height" from="0" to="${cellSize}"
            dur="0.3s" begin="${delay}s" fill="freeze"/>
           <animate attributeName="y" from="${y + cellSize}" to="${y}"
            dur="0.3s" begin="${delay}s" fill="freeze"/>`
        : ''}
    </rect>`;
  }).join('');

  // Day labels
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) =>
    svgText({
      x: startX - 8, y: startY + i * (cellSize + gap) + cellSize / 2,
      text: d, fontSize: 7,
      fill: palette.textMuted, anchor: 'middle',
      dominantBaseline: 'middle', opacity: 0.5,
    })
  ).join('');

  return `<g>${cells}${dayLabels}</g>`;
}

// ── Fire animation (right side) ──────────────────────────────

function buildFireAnimation(
  currentStreak: number,
  palette: DynamicPalette,
  animated: boolean
): string {
  if (currentStreak === 0) return '';

  const cx = W - 60;
  const cy = 85;

  // SVG fire made of layered ellipses with animations
  const flames = [
    { rx: 18, ry: 28, color: palette.primary, dur: '1.8s', begin: '0s' },
    { rx: 12, ry: 22, color: mix(palette.primary, palette.secondary, 0.5), dur: '1.4s', begin: '0.2s' },
    { rx: 7,  ry: 14, color: lighten(palette.secondary, 20), dur: '1.1s', begin: '0.1s' },
  ];

  const flameEls = flames.map(({ rx, ry, color, dur, begin }) => {
    const scaleAnim = animated
      ? `<animateTransform attributeName="transform" type="scale"
          values="1 1;1.05 1.1;0.97 0.95;1.03 1.08;1 1"
          dur="${dur}" begin="${begin}" repeatCount="indefinite"
          additive="sum" calcMode="spline"
          keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
          keyTimes="0;0.25;0.5;0.75;1"/>`
      : '';

    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
      fill="${color}" opacity="0.8" filter="url(#glow-filter)">
      ${scaleAnim}
    </ellipse>`;
  }).join('');

  // Streak number inside flame
  const streakNum = svgText({
    x: cx, y: cy,
    text: `${currentStreak}`,
    fontSize: 20, fontWeight: 700,
    fill: '#ffffff',
    anchor: 'middle', dominantBaseline: 'middle',
    filter: 'drop-shadow',
  });

  const streakLabel = svgText({
    x: cx, y: cy + 38,
    text: 'day streak',
    fontSize: 9, fill: palette.textMuted,
    anchor: 'middle', opacity: 0.8,
  });

  const fadeIn = animated ? animateFadeIn(0.5, 0.6) : '';

  return `
    <g opacity="${animated ? 0 : 1}">
      ${flameEls}
      ${streakNum}
      ${streakLabel}
      ${fadeIn}
    </g>`;
}
