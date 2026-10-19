// The week card's heat scale: the week warms from ice to ember as it fills.
// Pure, no React. The spec is docs/week-card-v2-spec.md ("Heat scale").
//
// The same colors in light and dark mode. Segment i of the target is
// heatColor(i / target) once i workouts are done, and the k-th training
// day of the week is heatColor(min(k, target) / target).

/** The stops, as a fraction of the target. Ice, then aqua, then sun, then ember. */
export const HEAT_STOPS: readonly { t: number; color: string }[] = [
  { t: 0, color: "#4FAEE8" },
  { t: 0.3, color: "#8DD3E0" },
  { t: 0.6, color: "#FFD166" },
  { t: 1, color: "#F2602B" },
];

/** Graphite, the ink on a light heat color. */
const DARK_INK = "#221F1B";
const LIGHT_INK = "#FFFFFF";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(channels: readonly number[]): string {
  return `#${channels.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * The heat color at `t`, 0 to 1 (clamped), as #RRGGBB: linear sRGB
 * interpolation between the two stops either side.
 */
export function heatColor(t: number): string {
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  for (let i = 1; i < HEAT_STOPS.length; i += 1) {
    const hi = HEAT_STOPS[i];
    if (x > hi.t) continue;
    const lo = HEAT_STOPS[i - 1];
    const f = (x - lo.t) / (hi.t - lo.t);
    const a = rgb(lo.color);
    const b = rgb(hi.color);
    return hex(a.map((v, j) => v + (b[j] - v) * f));
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].color;
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB color, 0 to 1. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = rgb(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The check glyph's color on a heat color: graphite on the light ones, white on the rest. */
export function heatInk(color: string): string {
  return relativeLuminance(color) > 0.45 ? DARK_INK : LIGHT_INK;
}
