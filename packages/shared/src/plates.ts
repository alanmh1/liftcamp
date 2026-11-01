import type { WeightUnit } from "./units";

/**
 * Bars and plates, for Pro: the plate calculator, and the bar weight that
 * starting weights (the empty-bar floor) and warm-up sets (the bar-share
 * tiers) build on.
 *
 * The user picks a bar and the plates their gym has in Settings. Both are
 * stored in the profile's unit (`user_profiles.bar_weight` and
 * `user_profiles.plate_inventory`, a JSON array of numbers); null, or a
 * value that is not one of the options, means the defaults.
 */

/** The bar weight chips, heaviest first. The first is the default. */
export const BAR_WEIGHT_OPTIONS: Record<WeightUnit, readonly number[]> = {
  lb: [45, 35, 15],
  kg: [20, 15, 10],
};

/** An EZ bar is lighter than a straight bar, and has no setting of its own. */
export const EZ_BAR_WEIGHT: Record<WeightUnit, number> = { lb: 25, kg: 10 };

/** Every plate the setting offers, heaviest first. */
export const PLATE_OPTIONS: Record<WeightUnit, readonly number[]> = {
  lb: [55, 45, 35, 25, 10, 5, 2.5, 1.25],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
};

/** The plates a gym usually has: every option except the heaviest and the smallest in lb, 25 and 0.5 in kg. */
export const DEFAULT_PLATES: Record<WeightUnit, readonly number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [20, 15, 10, 5, 2.5, 1.25],
};

/** The profile fields the bar and plates come from, in the profile's unit. */
export type PlatePrefs = {
  bar_weight?: number | null;
  plate_inventory?: unknown;
};

const EPS = 0.001;

function isOption(value: number, options: readonly number[]): boolean {
  return options.some((o) => Math.abs(o - value) < EPS);
}

/** The user's bar, or the default for the unit. */
export function barWeight(unit: WeightUnit, prefs: PlatePrefs | null | undefined): number {
  const v = prefs?.bar_weight;
  if (v != null && Number.isFinite(v) && isOption(v, BAR_WEIGHT_OPTIONS[unit])) return v;
  return BAR_WEIGHT_OPTIONS[unit][0];
}

/**
 * The checked plates, heaviest first. A stored
 * list that is not an array of offered plates, or is empty, gives the
 * defaults.
 */
export function availablePlates(unit: WeightUnit, prefs: PlatePrefs | null | undefined): number[] {
  const raw = prefs?.plate_inventory;
  if (Array.isArray(raw)) {
    const picked = PLATE_OPTIONS[unit].filter((o) =>
      raw.some((r) => typeof r === "number" && Math.abs(r - o) < EPS),
    );
    if (picked.length > 0) return picked;
  }
  return [...DEFAULT_PLATES[unit]];
}

/** Equipment loaded with plates on a bar. */
const BAR_EQUIPMENT: readonly string[] = ["barbell", "smith machine", "e-z curl bar"];

/** Whether an exercise is loaded with plates on a bar, so the plate calculator applies. */
export function usesBar(ex: { equipment: string | null }): boolean {
  return BAR_EQUIPMENT.includes((ex.equipment ?? "").trim().toLowerCase());
}

/**
 * The empty bar for an exercise: the user's bar for a barbell or Smith
 * machine, the EZ bar's own weight for an EZ bar, and null for anything
 * not on a bar. `userBar` is `barWeight(unit, prefs)`.
 */
export function barWeightFor(ex: { equipment: string | null }, unit: WeightUnit, userBar: number): number | null {
  const equipment = (ex.equipment ?? "").trim().toLowerCase();
  if (equipment === "e-z curl bar") return EZ_BAR_WEIGHT[unit];
  if (equipment === "barbell" || equipment === "smith machine") return userBar;
  return null;
}

/**
 * The stored bar after a unit change, in the same write: the chip at the
 * same place in the new unit's list (45 lb is 20 kg, 35 is 15, 15 is 10).
 * Null stays null, and so does anything that was not a chip. Plates go back
 * to null in that write, the new unit's defaults.
 */
export function barWeightForUnitChange(
  stored: number | null | undefined,
  from: WeightUnit,
  to: WeightUnit,
): number | null {
  if (stored == null || from === to) return stored ?? null;
  const i = BAR_WEIGHT_OPTIONS[from].findIndex((o) => Math.abs(o - stored) < EPS);
  return i < 0 ? null : BAR_WEIGHT_OPTIONS[to][i];
}

export type PlateLoad = {
  /** The plates on each side, heaviest first. Empty for the bar alone. */
  perSide: number[];
  /** True when the plates make `target` exactly. */
  exact: boolean;
  /** What the bar weighs with `perSide` on it: `target` when exact, else the nearest under it. */
  closest: number;
};

/**
 * The plates for each side of the bar to make `target`, heaviest first.
 * Plates go on in pairs, as many pairs of each size as it takes. Greedy,
 * largest first. A target the plates cannot make loads the nearest weight
 * under it that greedy reaches, never over; a target at or under the bar
 * is the bar alone.
 */
export function platesForWeight(target: number, bar: number, plates: readonly number[]): PlateLoad {
  // Hundredths keep 1.25 and 0.5 clear of float noise.
  const cents = (n: number) => Math.round(n * 100);
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  const perSide: number[] = [];
  let left = Math.floor((cents(target) - cents(bar)) / 2);
  if (left > 0) {
    for (const p of sorted) {
      while (cents(p) <= left) {
        perSide.push(p);
        left -= cents(p);
      }
    }
  }
  const closest = (cents(bar) + 2 * perSide.reduce((sum, p) => sum + cents(p), 0)) / 100;
  return { perSide, exact: cents(closest) === cents(target), closest };
}

/** "Per side 45, 25, 10", or "Just the bar". */
export function perSideLabel(load: PlateLoad): string {
  return load.perSide.length === 0 ? "Just the bar" : `Per side ${load.perSide.join(", ")}`;
}

/**
 * A plate's colour on the calculator, after the competition scheme: in lb
 * 55 red, 45 blue, 35 yellow, 25 green, 10 white, 5 red; in kg 25 red, 20
 * blue, 15 yellow, 10 green, 5 white, 2.5 red. Anything smaller is `small`
 * (the change plates). The screen maps each to a Chalk tone.
 */
export type PlateColor = "red" | "blue" | "yellow" | "green" | "white" | "small";

const PLATE_COLORS: Record<WeightUnit, [number, PlateColor][]> = {
  lb: [[55, "red"], [45, "blue"], [35, "yellow"], [25, "green"], [10, "white"], [5, "red"]],
  kg: [[25, "red"], [20, "blue"], [15, "yellow"], [10, "green"], [5, "white"], [2.5, "red"]],
};

export function plateColor(plate: number, unit: WeightUnit): PlateColor {
  return PLATE_COLORS[unit].find(([p]) => Math.abs(p - plate) < EPS)?.[1] ?? "small";
}

/** "Your plates can't make 137.5. Closest is 135", without the number styled; null when exact. */
export function plateShortfall(target: number, load: PlateLoad): { before: string; closest: number } | null {
  if (load.exact) return null;
  return { before: `Your plates can't make ${formatPlate(target)}. Closest is `, closest: load.closest };
}

/** A plate or bar weight as printed: 2.5, 1.25, 45. */
export function formatPlate(n: number): string {
  return String(Math.round(n * 100) / 100);
}
