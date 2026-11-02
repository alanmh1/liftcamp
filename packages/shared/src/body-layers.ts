import { canonMuscle, MUSCLE_LABELS, type CanonicalMuscle } from "./muscle-vocab";
import type { BodyView } from "./body-diagram";

/**
 * The body diagram, mobile and web, drawn from pre-rendered layers. Each region has a primary and a secondary PNG with the blue
 * already painted into the clay, registered to base_front or base_back on
 * the same 1024 square (apps/mobile/assets/images/muscles). The diagram
 * stacks them on the base. The web draws the same layers, as WebP copies.
 * See docs/body-diagram.md.
 */

export const FRONT_REGIONS = [
  "front_chest",
  "front_delts",
  "front_biceps",
  "front_forearms",
  "front_abs",
  "front_quads",
  "front_adductors",
] as const;

export const BACK_REGIONS = [
  "back_traps",
  "back_rear_delts",
  "back_lats",
  "back_lower_back",
  "back_triceps",
  "back_forearms",
  "back_glutes",
  "back_abductors",
  "back_hamstrings",
  "back_calves",
] as const;

export type BodyRegion = (typeof FRONT_REGIONS)[number] | (typeof BACK_REGIONS)[number];

/**
 * Canonical muscle to the regions it lights. There is no upper back region:
 * "upper back" (which "middle back" canonicalizes to) lights traps and lats.
 * Neck lights nothing.
 */
export const MUSCLE_REGIONS: Readonly<Record<CanonicalMuscle, readonly BodyRegion[]>> = {
  chest: ["front_chest"],
  shoulders: ["front_delts", "back_rear_delts"],
  biceps: ["front_biceps"],
  forearms: ["front_forearms", "back_forearms"],
  abs: ["front_abs"],
  quads: ["front_quads"],
  adductors: ["front_adductors"],
  traps: ["back_traps"],
  "upper back": ["back_traps", "back_lats"],
  lats: ["back_lats"],
  "lower back": ["back_lower_back"],
  triceps: ["back_triceps"],
  glutes: ["back_glutes"],
  abductors: ["back_abductors"],
  hamstrings: ["back_hamstrings"],
  calves: ["back_calves"],
  neck: [],
};

export function regionView(region: BodyRegion): BodyView {
  return region.startsWith("front_") ? "anterior" : "posterior";
}

function canonTokens(raw: string | null | undefined): CanonicalMuscle[] {
  if (!raw) return [];
  const out: CanonicalMuscle[] = [];
  for (const part of raw.split("|")) {
    const key = canonMuscle(part) as CanonicalMuscle;
    if (MUSCLE_REGIONS[key] && !out.includes(key)) out.push(key);
  }
  return out;
}

export type BodyHighlights = {
  primary: BodyRegion[];
  secondary: BodyRegion[];
  /** The muscles behind them, for the spoken label. */
  primaryMuscles: CanonicalMuscle[];
  secondaryMuscles: CanonicalMuscle[];
};

type MuscleColumn = string | null | undefined;

/**
 * Regions to light for an exercise's pipe-delimited muscle columns. A region
 * in both lists lights as primary only. Unknown tokens light nothing.
 *
 * The primary can also be a list of columns in order of preference: the
 * first one with a known muscle is used. The web passes
 * [all_primary_muscles, primary_muscle]; the app passes primary_muscle.
 */
export function bodyHighlights(
  primaryRaw: MuscleColumn | readonly MuscleColumn[],
  secondaryRaw: MuscleColumn,
): BodyHighlights {
  const columns: readonly MuscleColumn[] = Array.isArray(primaryRaw) ? primaryRaw : [primaryRaw];
  const primaryMuscles = columns.map(canonTokens).find((ms) => ms.length > 0) ?? [];
  const secondaryMuscles = canonTokens(secondaryRaw).filter((m) => !primaryMuscles.includes(m));
  const primary = [...new Set(primaryMuscles.flatMap((m) => MUSCLE_REGIONS[m]))];
  const secondary = [...new Set(secondaryMuscles.flatMap((m) => MUSCLE_REGIONS[m]))].filter(
    (r) => !primary.includes(r),
  );
  return { primary, secondary, primaryMuscles, secondaryMuscles };
}

/** The same highlights narrowed to one view. */
export function highlightsForView(h: BodyHighlights, view: BodyView): BodyHighlights {
  const inView = (m: CanonicalMuscle) => MUSCLE_REGIONS[m].some((r) => regionView(r) === view);
  return {
    primary: h.primary.filter((r) => regionView(r) === view),
    secondary: h.secondary.filter((r) => regionView(r) === view),
    primaryMuscles: h.primaryMuscles.filter(inView),
    secondaryMuscles: h.secondaryMuscles.filter(inView),
  };
}

/**
 * One label for a figure, primary muscles then secondary, in words. The
 * layers underneath are hidden from screen readers.
 */
export function bodyHighlightsLabel(h: BodyHighlights): string {
  const words = (ms: readonly CanonicalMuscle[]) => ms.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(", ");
  const p = words(h.primaryMuscles);
  const s = words(h.secondaryMuscles);
  if (!p && !s) return "Body diagram, no muscles highlighted";
  return `Body diagram. Primary ${p || "none"}. Secondary ${s || "none"}`;
}

/** An alpha bounding box in source pixels: x0, y0, x1, y1, ends exclusive. */
export type LayerBox = readonly [number, number, number, number];

/** Padding around the highlighted muscles, in source pixels. */
export const CIRCLE_PADDING = 60;
/**
 * The smallest crop, in source pixels, which caps the zoom. At 360 a calf
 * or an abductor still shows the legs and hips around it.
 */
export const CIRCLE_MIN_DIAMETER = 360;

/**
 * The circle to crop from the 1024 square so every box shows: centred on
 * their union, with a diameter of the union's diagonal (so the corners fit
 * inside the circle, not just the square) plus padding, no smaller than
 * CIRCLE_MIN_DIAMETER and no larger than the canvas. The centre is clamped
 * so the circle stays on the canvas. Null when there are no boxes.
 */
export function circleCrop(
  boxes: readonly LayerBox[],
  source = 1024,
): { cx: number; cy: number; diameter: number } | null {
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const diameter = Math.min(
    source,
    Math.max(CIRCLE_MIN_DIAMETER, Math.hypot(x1 - x0, y1 - y0) + CIRCLE_PADDING * 2),
  );
  const clamp = (v: number) => Math.min(Math.max(v, diameter / 2), source - diameter / 2);
  return { cx: clamp((x0 + x1) / 2), cy: clamp((y0 + y1) / 2), diameter };
}
