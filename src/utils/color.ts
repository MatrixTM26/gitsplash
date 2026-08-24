import type { GradientConfig, GradientStop } from '../types/index.js';

// ============================================================
// Color Math Utilities
// ============================================================

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Darken a hex color by a percentage (0-100) */
export function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}

/** Lighten a hex color */
export function lighten(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + amount));
}

/** Shift hue by degrees */
export function hueShift(hex: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex((h + degrees + 360) % 360, s, l);
}

/** Mix two hex colors */
export function mix(a: string, b: string, ratio = 0.5): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio
  );
}

/** Ensure minimum contrast by adjusting lightness */
export function ensureReadable(bg: string, fg: string): string {
  const [, , bgL] = hexToHsl(bg);
  const [fgH, fgS, fgL] = hexToHsl(fg);

  const diff = Math.abs(bgL - fgL);
  if (diff < 40) {
    // Push fg to opposite side
    const newL = bgL > 50 ? Math.max(0, bgL - 50) : Math.min(100, bgL + 50);
    return hslToHex(fgH, fgS, newL);
  }
  return fg;
}

// ============================================================
// Dynamic Theme Generator (from top language colors)
// ============================================================

export interface DynamicPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  glow: string;
}

/**
 * Generate a full dark theme palette from 1-3 language colors.
 * Uses the dominant language color as the primary accent, then
 * derives complementary/analogous hues for visual depth.
 */
export function generateDynamicPalette(
  topColors: string[],
  style: 'dark' | 'light' = 'dark'
): DynamicPalette {
  const [raw1, raw2, raw3] = topColors.concat(['#6e7681', '#8b949e', '#adbac7']);
  const [h1, s1] = hexToHsl(raw1);

  // Ensure primary is vibrant enough
  const primary = hslToHex(h1, Math.max(s1, 65), style === 'dark' ? 65 : 45);

  // Secondary: 30° hue shift, slightly muted
  const [h2] = hexToHsl(raw2);
  const secondary = hslToHex(
    Math.abs(h2 - h1) > 20 ? h2 : (h1 + 30) % 360,
    60,
    style === 'dark' ? 60 : 50
  );

  // Tertiary: 60° shift from primary
  const [h3] = hexToHsl(raw3);
  const tertiary = hslToHex(
    Math.abs(h3 - h1) > 40 ? h3 : (h1 + 60) % 360,
    55,
    style === 'dark' ? 55 : 55
  );

  if (style === 'dark') {
    const bg = hslToHex(h1, 15, 8);       // Very dark, slight tint
    const surface = hslToHex(h1, 12, 13); // Card background
    const border = hslToHex(h1, 20, 22);
    const glow = hslToHex(h1, Math.max(s1, 70), 50) + '40'; // 25% opacity

    return {
      primary,
      secondary,
      tertiary,
      background: bg,
      surface,
      text: '#e6edf3',
      textMuted: hslToHex(h1, 15, 55),
      border,
      glow,
    };
  } else {
    const bg = hslToHex(h1, 15, 97);
    const surface = '#ffffff';
    const border = hslToHex(h1, 20, 85);
    const glow = hslToHex(h1, 70, 50) + '30';

    return {
      primary,
      secondary,
      tertiary,
      background: bg,
      surface,
      text: hslToHex(h1, 15, 15),
      textMuted: hslToHex(h1, 10, 45),
      border,
      glow,
    };
  }
}

// ============================================================
// SVG Gradient Definition Builders
// ============================================================

export function buildLinearGradientDef(cfg: GradientConfig): string {
  const angle = cfg.angle ?? 135;
  const rad = (angle * Math.PI) / 180;
  const x1 = Math.round((0.5 - Math.cos(rad) * 0.5) * 100) / 100;
  const y1 = Math.round((0.5 - Math.sin(rad) * 0.5) * 100) / 100;
  const x2 = Math.round((0.5 + Math.cos(rad) * 0.5) * 100) / 100;
  const y2 = Math.round((0.5 + Math.sin(rad) * 0.5) * 100) / 100;

  const stops = cfg.colors
    .map(
      (s) =>
        `<stop offset="${s.offset}%" stop-color="${s.color}"${
          s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ''
        }/>`
    )
    .join('');

  let animAttr = '';
  if (cfg.animated) {
    const dur = cfg.animationDuration ?? 6;
    // Animate gradient angle by shifting x1/y1/x2/y2
    animAttr = `
      <animateTransform
        attributeName="gradientTransform"
        type="rotate"
        values="0 0.5 0.5; 360 0.5 0.5"
        dur="${dur}s"
        repeatCount="indefinite"
      />`;
  }

  return `
    <linearGradient id="${cfg.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">
      ${stops}${animAttr}
    </linearGradient>`;
}

export function buildRadialGradientDef(cfg: GradientConfig): string {
  const cx = cfg.cx ?? 0.5;
  const cy = cfg.cy ?? 0.5;

  const stops = cfg.colors
    .map(
      (s) =>
        `<stop offset="${s.offset}%" stop-color="${s.color}"${
          s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ''
        }/>`
    )
    .join('');

  return `
    <radialGradient id="${cfg.id}" cx="${cx}" cy="${cy}" r="0.6" gradientUnits="objectBoundingBox">
      ${stops}
    </radialGradient>`;
}

/**
 * Build gradient configs from a dynamic palette.
 * Returns background, accent, and chart gradients.
 */
export function buildGradientsFromPalette(
  palette: DynamicPalette,
  animated = true
): {
  bg: GradientConfig;
  accent: GradientConfig;
  chart: GradientConfig;
  glow: GradientConfig;
} {
  const bgStops: GradientStop[] = [
    { color: palette.background, offset: 0 },
    { color: mix(palette.background, palette.primary, 0.08), offset: 50 },
    { color: mix(palette.background, palette.secondary, 0.06), offset: 100 },
  ];

  const accentStops: GradientStop[] = [
    { color: palette.primary, offset: 0 },
    { color: palette.secondary, offset: 50 },
    { color: palette.tertiary, offset: 100 },
  ];

  const chartStops: GradientStop[] = [
    { color: palette.primary, offset: 0, opacity: 0.9 },
    { color: palette.secondary, offset: 100, opacity: 0.7 },
  ];

  const glowStops: GradientStop[] = [
    { color: palette.primary, offset: 0, opacity: 0.3 },
    { color: palette.primary, offset: 100, opacity: 0 },
  ];

  return {
    bg: {
      id: 'grad-bg',
      type: 'linear',
      colors: bgStops,
      angle: 135,
      animated: animated,
      animationDuration: 12,
    },
    accent: {
      id: 'grad-accent',
      type: 'linear',
      colors: accentStops,
      angle: 90,
      animated: animated,
      animationDuration: 8,
    },
    chart: {
      id: 'grad-chart',
      type: 'linear',
      colors: chartStops,
      angle: 90,
    },
    glow: {
      id: 'grad-glow',
      type: 'radial',
      colors: glowStops,
      cx: 0.5,
      cy: 0.5,
    },
  };
}

// ============================================================
// SVG <defs> block builder
// ============================================================

export function buildDefsBlock(
  grads: GradientConfig[],
  _palette: DynamicPalette,
  cardWidth: number,
  cardHeight: number
): string {
  const gradDefs = grads.map((g) =>
    g.type === 'radial'
      ? buildRadialGradientDef(g)
      : buildLinearGradientDef(g)
  );

  // Drop shadow filter
  const shadow = `
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="2"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.4"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;

  // Glow filter for highlights
  const glow = `
    <filter id="glow-filter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;

  // Clip path for card rounding
  const clip = `
    <clipPath id="card-clip">
      <rect width="${cardWidth}" height="${cardHeight}" rx="12" ry="12"/>
    </clipPath>`;

  return `<defs>${gradDefs.join('')}${shadow}${glow}${clip}</defs>`;
}
