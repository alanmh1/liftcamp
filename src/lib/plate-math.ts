import type { WeightUnit } from "@/lib/weight-unit";

/** Standard bar weights by unit. */
export const DEFAULT_BAR: Record<WeightUnit, number> = { lb: 45, kg: 20 };

/** Plate sizes a typical commercial gym stocks, largest first. */
export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** Pairs of each plate assumed available when the lifter hasn't customised. */
export const DEFAULT_PAIRS = 8;

/** plate size (as string key) -> number of PAIRS available. */
export type PlateInventory = Record<string, number>;

export function defaultInventory(unit: WeightUnit): PlateInventory {
  const inv: PlateInventory = {};
  for (const p of DEFAULT_PLATES[unit]) inv[String(p)] = DEFAULT_PAIRS;
  return inv;
}

/** Normalises a stored inventory, dropping junk and keeping descending order. */
export function inventoryPlates(inv: PlateInventory | null | undefined, unit: WeightUnit) {
  const source = inv && Object.keys(inv).length > 0 ? inv : defaultInventory(unit);
  return Object.entries(source)
    .map(([k, v]) => ({ size: Number(k), pairs: Math.max(0, Math.floor(Number(v) || 0)) }))
    .filter((p) => Number.isFinite(p.size) && p.size > 0 && p.pairs > 0)
    .sort((a, b) => b.size - a.size);
}

export type PlateStack = { size: number; count: number };

export type PlateSolution = {
  bar: number;
  target: number;
  /** Plates to hang on ONE side, largest first. */
  perSide: PlateStack[];
  /** Weight actually on the bar with these plates. */
  achieved: number;
  /** target - achieved, positive when the target can't be hit exactly. */
  shortBy: number;
  /** True when the target is below the bar itself. */
  belowBar: boolean;
};

/**
 * Greedy per-side plate loading. Greedy is optimal for the standard gym plate
 * sets (each size divides into the next up), and it's what a lifter does at
 * the rack anyway: biggest plate that still fits, repeat.
 */
export function solvePlates(
  target: number,
  bar: number,
  plates: { size: number; pairs: number }[],
): PlateSolution {
  const belowBar = target < bar - 1e-9;
  let remainingPerSide = Math.max(0, (target - bar) / 2);
  const perSide: PlateStack[] = [];

  for (const p of plates) {
    const fit = Math.min(p.pairs, Math.floor((remainingPerSide + 1e-6) / p.size));
    if (fit > 0) {
      perSide.push({ size: p.size, count: fit });
      remainingPerSide -= fit * p.size;
    }
  }

  const loaded = perSide.reduce((s, p) => s + p.size * p.count, 0);
  const achieved = bar + loaded * 2;
  return {
    bar,
    target,
    perSide,
    achieved: round2(achieved),
    shortBy: round2(Math.max(0, target - achieved)),
    belowBar,
  };
}

/** Smallest jump the bar can make with the available plates (both sides). */
export function smallestIncrement(plates: { size: number; pairs: number }[]): number {
  if (plates.length === 0) return 0;
  return round2(plates[plates.length - 1].size * 2);
}

/** Rounds a weight down to something actually loadable on this bar. */
export function roundToLoadable(
  weight: number,
  bar: number,
  plates: { size: number; pairs: number }[],
): number {
  if (weight <= bar) return bar;
  return solvePlates(weight, bar, plates).achieved;
}

export type WarmupStep = {
  /** Percentage of the working set this step targets. */
  pct: number;
  weight: number;
  reps: number;
  solution: PlateSolution;
};

/**
 * Classic ramp to a working set: empty bar, then a few rising sets with
 * dropping reps. Steps that land on the same loadable weight are collapsed,
 * so light working weights don't produce four identical warm-ups.
 */
export function warmupRamp(
  working: number,
  bar: number,
  plates: { size: number; pairs: number }[],
): WarmupStep[] {
  if (!Number.isFinite(working) || working <= bar) return [];

  const template: { pct: number; reps: number }[] = [
    { pct: 0, reps: 10 }, // empty bar
    { pct: 0.55, reps: 5 },
    { pct: 0.7, reps: 3 },
    { pct: 0.85, reps: 2 },
  ];

  const steps: WarmupStep[] = [];
  const seen = new Set<number>();
  for (const t of template) {
    const raw = t.pct === 0 ? bar : working * t.pct;
    const weight = roundToLoadable(raw, bar, plates);
    if (weight >= working - 1e-9) continue;
    if (seen.has(weight)) continue;
    seen.add(weight);
    steps.push({
      pct: t.pct,
      weight,
      reps: t.reps,
      solution: solvePlates(weight, bar, plates),
    });
  }
  return steps;
}

/** "45 · 25 · 10" style per-side summary. */
export function perSideLabel(sol: PlateSolution): string {
  if (sol.perSide.length === 0) return "empty bar";
  return sol.perSide
    .flatMap((p) => Array.from({ length: p.count }, () => trimNum(p.size)))
    .join(" · ");
}

export function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const BARBELL_EQUIPMENT = new Set(["barbell", "e-z curl bar", "smith machine"]);

/** Only barbell-style lifts get a plate calculator; dumbbells and machines don't. */
export function usesPlates(equipment: string | null | undefined): boolean {
  if (!equipment) return false;
  return BARBELL_EQUIPMENT.has(equipment.trim().toLowerCase());
}
