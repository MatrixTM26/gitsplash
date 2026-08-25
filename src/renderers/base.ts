import type { GradientConfig } from '../types/index.js';
import type { DynamicPalette } from '../utils/color.js';
import {
  buildDefsBlock,
  } from '../utils/color.js';

// ============================================================
// SVG Primitive Helpers
// ============================================================

export interface Rect {
  x: number; y: number;
  w: number; h: number;
  rx?: number; ry?: number;
  fill?: string; stroke?: string; strokeWidth?: number;
  opacity?: number; filter?: string; clipPath?: string;
  className?: string; style?: string;
}

export interface TextEl {
  x: number; y: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  opacity?: number;
  letterSpacing?: number;
  filter?: string;
  className?: string;
}

export function svgRect(r: Rect): string {
  const attrs = [
    `x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"`,
    r.rx !== undefined ? `rx="${r.rx}"` : '',
    r.ry !== undefined ? `ry="${r.ry}"` : '',
    r.fill ? `fill="${r.fill}"` : 'fill="none"',
    r.stroke ? `stroke="${r.stroke}"` : '',
    r.strokeWidth ? `stroke-width="${r.strokeWidth}"` : '',
    r.opacity !== undefined ? `opacity="${r.opacity}"` : '',
    r.filter ? `filter="url(#${r.filter})"` : '',
    r.clipPath ? `clip-path="url(#${r.clipPath})"` : '',
    r.className ? `class="${r.className}"` : '',
    r.style ? `style="${r.style}"` : '',
  ].filter(Boolean).join(' ');
  return `<rect ${attrs}/>`;
}

export function svgText(t: TextEl): string {
  const attrs = [
    `x="${t.x}" y="${t.y}"`,
    `font-size="${t.fontSize ?? 14}"`,
    `font-family="${t.fontFamily ?? 'ui-monospace,SFMono-Regular,Menlo,monospace'}"`,
    t.fontWeight ? `font-weight="${t.fontWeight}"` : '',
    `fill="${t.fill ?? '#e6edf3'}"`,
    `text-anchor="${t.anchor ?? 'start'}"`,
    t.dominantBaseline ? `dominant-baseline="${t.dominantBaseline}"` : '',
    t.opacity !== undefined ? `opacity="${t.opacity}"` : '',
    t.letterSpacing ? `letter-spacing="${t.letterSpacing}"` : '',
    t.filter ? `filter="url(#${t.filter})"` : '',
    t.className ? `class="${t.className}"` : '',
  ].filter(Boolean).join(' ');
  return `<text ${attrs}>${escapeXml(t.text)}</text>`;
}

export function svgLine(
  x1: number, y1: number, x2: number, y2: number,
  stroke: string, strokeWidth = 1, opacity = 1, dash?: string
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

export function svgCircle(
  cx: number, cy: number, r: number,
  fill: string, stroke?: string, strokeWidth?: number, filter?: string
): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${
    stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}"` : ''
  }${filter ? ` filter="url(#${filter})"` : ''}/>`;
}

export function svgPath(d: string, fill = 'none', stroke?: string, strokeWidth?: number, opacity?: number): string {
  return `<path d="${d}" fill="${fill}"${
    stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}"` : ''
  }${opacity !== undefined ? ` opacity="${opacity}"` : ''}/>`;
}

export function svgGroup(children: string, attrs = ''): string {
  return `<g ${attrs}>${children}</g>`;
}

// ============================================================
// Animation Helpers
// ============================================================

/** Fade in element with delay */
export function animateFadeIn(delay = 0, duration = 0.6): string {
  return `
    <animate attributeName="opacity" from="0" to="1"
      dur="${duration}s" begin="${delay}s" fill="freeze" calcMode="spline"
      keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`;
}

/** Slide up + fade in (for bar charts) */
export function animateSlideUp(
  fromY: number, _toY: number,
  delay = 0, duration = 0.8
): string {
  return `
    <animateTransform attributeName="transform" type="translate"
      from="0 ${fromY}" to="0 0"
      dur="${duration}s" begin="${delay}s" fill="freeze" calcMode="spline"
      keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>
    <animate attributeName="opacity" from="0" to="1"
      dur="${duration * 0.5}s" begin="${delay}s" fill="freeze"/>`;
}

/** Grow bar from 0 width */
export function animateBarGrow(
  finalWidth: number,
  delay = 0, duration = 0.9
): string {
  return `
    <animate attributeName="width" from="0" to="${finalWidth}"
      dur="${duration}s" begin="${delay}s" fill="freeze" calcMode="spline"
      keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>`;
}

/** Pulse glow effect */
export function animatePulse(delay = 0, duration = 2): string {
  return `
    <animate attributeName="opacity" values="0.6;1;0.6"
      dur="${duration}s" begin="${delay}s" repeatCount="indefinite"
      calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" keyTimes="0;0.5;1"/>`;
}

/** Number count-up animation via SVG (visual trick with multiple text elements) */
export function animateCountUp(
  finalValue: number,
  x: number, y: number,
  opts: Partial<TextEl>,
  delay = 0,
  steps = 12
): string {
  const values = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((finalValue * i) / steps).toLocaleString()
  );
  // keyTimes computed inline below

  const baseAttrs = [
    `x="${x}" y="${y}"`,
    `font-size="${opts.fontSize ?? 28}"`,
    `font-family="${opts.fontFamily ?? 'ui-monospace,SFMono-Regular,Menlo,monospace'}"`,
    opts.fontWeight ? `font-weight="${opts.fontWeight}"` : 'font-weight="700"',
    `fill="${opts.fill ?? '#e6edf3'}"`,
    `text-anchor="${opts.anchor ?? 'middle'}"`,
    opts.dominantBaseline ? `dominant-baseline="${opts.dominantBaseline}"` : '',
  ].filter(Boolean).join(' ');

  return `
    <text ${baseAttrs}>
      ${values[values.length - 1]}
      <animate attributeName="opacity" from="0" to="1"
        dur="0.3s" begin="${delay}s" fill="freeze"/>
    </text>`;
}

// ============================================================
// Card Shell Builder
// ============================================================

export interface CardShellOptions {
  width: number;
  height: number;
  palette: DynamicPalette;
  gradients: Record<string, GradientConfig>;
  animated: boolean;
  title?: string;
  titleIcon?: string;
  subtitle?: string;
  footerText?: string;
}

export function buildCardShell(opts: CardShellOptions, body: string): string {
  const { width, height, palette, gradients, animated } = opts;
  const gradList = Object.values(gradients);

  const defs = buildDefsBlock(gradList, palette, width, height);

  // Outer card background
  const bg = svgRect({
    x: 0, y: 0, w: width, h: height,
    fill: 'url(#grad-bg)', rx: 12, ry: 12,
    clipPath: 'card-clip',
  });

  // Subtle noise texture overlay (SVG feTurbulence)
  const noiseDef = `
    <filter id="noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="overlay" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>`;

  // Grid lines (subtle)
  const gridLines = buildGridLines(width, height, palette);

  // Border glow
  const borderGlow = `
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}"
      rx="11.5" fill="none"
      stroke="url(#grad-accent)" stroke-width="1" opacity="0.5"/>`;

  // Title section
  const titleSection = opts.title
    ? buildTitleSection(opts, palette, animated)
    : '';

  // Footer
  const footer = opts.footerText
    ? buildFooter(opts.footerText, width, height, palette)
    : '';

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  role="img" aria-label="${opts.title ?? 'GitHub Stats'}">
  <title>${escapeXml(opts.title ?? 'GitHub Stats')}</title>
  ${defs}
  <defs>${noiseDef}</defs>
  <g clip-path="url(#card-clip)">
    ${bg}
    ${gridLines}
    ${borderGlow}
    ${titleSection}
    <g transform="translate(0, ${opts.title ? 56 : 16})">
      ${body}
    </g>
    ${footer}
  </g>
</svg>`;
}

function buildGridLines(width: number, height: number, palette: DynamicPalette): string {
  const lines: string[] = [];
  const spacing = 40;
  const color = palette.border;
  const opacity = 0.08;

  for (let x = spacing; x < width; x += spacing) {
    lines.push(svgLine(x, 0, x, height, color, 1, opacity));
  }
  for (let y = spacing; y < height; y += spacing) {
    lines.push(svgLine(0, y, width, y, color, 1, opacity));
  }

  return `<g opacity="1">${lines.join('')}</g>`;
}

function buildTitleSection(opts: CardShellOptions, palette: DynamicPalette, animated: boolean): string {
  const iconEl = opts.titleIcon
    ? `<text x="20" y="36" font-size="18" dominant-baseline="middle">${opts.titleIcon}</text>`
    : '';
  const iconOffset = opts.titleIcon ? 42 : 20;

  const title = svgText({
    x: iconOffset, y: 36,
    text: opts.title!,
    fontSize: 16,
    fontWeight: 700,
    fill: palette.text,
    dominantBaseline: 'middle',
    letterSpacing: 0.5,
  });

  const subtitle = opts.subtitle
    ? svgText({
        x: iconOffset, y: 50,
        text: opts.subtitle,
        fontSize: 11,
        fill: palette.textMuted,
        dominantBaseline: 'middle',
        opacity: 0.8,
      })
    : '';

  const fadeIn = animated ? animateFadeIn(0, 0.5) : '';

  return `
    <g id="title-section" opacity="0">
      ${iconEl}${title}${subtitle}
      <line id="title-line" x1="16" y1="52" x2="${opts.width - 16}" y2="52"
        stroke="url(#grad-accent)" stroke-width="1" opacity="0.4"/>
      ${fadeIn}
    </g>`;
}

function buildFooter(text: string, width: number, height: number, palette: DynamicPalette): string {
  return svgText({
    x: width / 2, y: height - 10,
    text,
    fontSize: 10,
    fill: palette.textMuted,
    anchor: 'middle',
    opacity: 0.5,
  });
}

// ============================================================
// Number Formatting
// ============================================================

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================
// Stat Pill (icon + label + value)
// ============================================================

export function statPill(
  x: number, y: number,
  icon: string, label: string, value: string,
  palette: DynamicPalette,
  animated: boolean,
  delay = 0
): string {
  const pillW = 160;
  const pillH = 48;

  const bg = svgRect({
    x, y, w: pillW, h: pillH, rx: 8,
    fill: palette.surface,
    stroke: palette.border,
    strokeWidth: 1,
    opacity: 0.7,
  });

  const iconEl = svgText({
    x: x + 14, y: y + pillH / 2,
    text: icon, fontSize: 18,
    dominantBaseline: 'middle',
  });

  const labelEl = svgText({
    x: x + 38, y: y + 16,
    text: label, fontSize: 10,
    fill: palette.textMuted,
    fontWeight: 500,
  });

  const valueEl = svgText({
    x: x + 38, y: y + 33,
    text: value, fontSize: 14,
    fill: palette.text,
    fontWeight: 700,
  });

  const fadeIn = animated
    ? `<animate attributeName="opacity" from="0" to="1"
        dur="0.5s" begin="${delay}s" fill="freeze" calcMode="spline"
        keySplines="0.4 0 0.2 1" keyTimes="0;1"/>`
    : '';

  return `<g opacity="${animated ? 0 : 1}">${bg}${iconEl}${labelEl}${valueEl}${fadeIn}</g>`;
}
