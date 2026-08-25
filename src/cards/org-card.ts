import type { StatsData, Organization } from '../types/index.js';
import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  svgRect, svgText, svgCircle,
  buildCardShell,
  type CardShellOptions,
} from '../renderers/base.js';
import { mix } from '../utils/color.js';

const W = 495;

// ============================================================
// Organization Card
// ============================================================

export function renderOrgCard(
  stats: StatsData,
  palette: DynamicPalette,
  gradients: Record<string, GradientConfig>,
  animated = true
): string {
  const orgs = stats.user.organizations.nodes;
  if (!orgs.length) return '';

  const cols = Math.min(orgs.length, 4);
  const rows = Math.ceil(orgs.length / cols);
  const H = 56 + rows * 78 + 24;

  const body = buildOrgGrid(orgs, cols, palette, animated);

  const shellOpts: CardShellOptions = {
    width: W, height: H,
    palette, gradients, animated,
    title: 'Organizations',
    titleIcon: '⊞',
    subtitle: `Member of ${stats.user.organizations.totalCount} organization${stats.user.organizations.totalCount !== 1 ? 's' : ''}`,
  };

  return buildCardShell(shellOpts, body);
}

// ── Org Badge Grid ────────────────────────────────────────────

function buildOrgGrid(
  orgs: Organization[],
  cols: number,
  palette: DynamicPalette,
  animated: boolean
): string {
  const cardW = (W - 32 - (cols - 1) * 10) / cols;
  const cardH = 66;

  return orgs.map((org, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 16 + col * (cardW + 10);
    const y = row * (cardH + 10);
    const delay = animated ? 0.1 + i * 0.08 : 0;

    return buildOrgBadge(org, x, y, cardW, cardH, palette, animated, delay);
  }).join('');
}

function buildOrgBadge(
  org: Organization,
  x: number, y: number,
  w: number, h: number,
  palette: DynamicPalette,
  animated: boolean,
  delay: number
): string {
  // Card background
  const bg = svgRect({
    x, y, w, h, rx: 8,
    fill: palette.surface,
    stroke: palette.border,
    strokeWidth: 0.5,
    opacity: 0.85,
  });

  // Hover glow border
  const hoverBorder = `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
      fill="none" stroke="url(#grad-accent)" stroke-width="1" opacity="0"
      style="cursor:pointer"
      onmouseenter="this.setAttribute('opacity','0.6')"
      onmouseleave="this.setAttribute('opacity','0')"/>`;

  // Avatar circle placeholder (color from org name hash)
  const avatarColor = stringToColor(org.login, palette);
  const avatarX = x + 12 + 18;
  const avatarY = y + h / 2;

  // Avatar background circle
  const avatarBg = svgCircle(avatarX, avatarY, 18, avatarColor, palette.border, 0.5);

  // Initials inside avatar
  const initials = (org.name || org.login).slice(0, 2).toUpperCase();
  const initialsEl = svgText({
    x: avatarX, y: avatarY,
    text: initials, fontSize: 12, fontWeight: 700,
    fill: '#ffffff', anchor: 'middle',
    dominantBaseline: 'middle',
  });

  // Org name
  const name = svgText({
    x: x + 12 + 18 + 22, y: y + 18,
    text: truncate(org.name || org.login, 14),
    fontSize: 12, fontWeight: 700,
    fill: palette.text,
    dominantBaseline: 'middle',
  });

  // Login handle
  const loginEl = svgText({
    x: x + 12 + 18 + 22, y: y + 33,
    text: `@${truncate(org.login, 14)}`,
    fontSize: 10, fill: palette.textMuted,
    dominantBaseline: 'middle',
  });

  // Description (if available)
  const desc = org.description
    ? svgText({
        x: x + 12 + 18 + 22, y: y + 48,
        text: truncate(org.description, 16),
        fontSize: 9, fill: palette.textMuted,
        dominantBaseline: 'middle', opacity: 0.7,
      })
    : '';

  const fadeIn = animated
    ? `<animate attributeName="opacity" from="0" to="1"
        dur="0.5s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
    : '';

  const slideUp = animated
    ? `<animateTransform attributeName="transform" type="translate"
        from="0 10" to="0 0"
        dur="0.5s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
    : '';

  return `
    <g opacity="${animated ? 0 : 1}">
      ${bg}${avatarBg}${initialsEl}${name}${loginEl}${desc}${hoverBorder}
      ${fadeIn}${slideUp}
    </g>`;
}

// ── Utility ───────────────────────────────────────────────────

function stringToColor(str: string, palette: DynamicPalette): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Pick from a set of palette-derived colors
  const options = [
    palette.primary, palette.secondary, palette.tertiary,
    mix(palette.primary, palette.secondary, 0.5),
  ];
  return options[Math.abs(hash) % options.length];
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
