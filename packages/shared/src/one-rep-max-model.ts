/**
 * A real 1RM estimate, not a single formula.
 *
 * Every rep-max formula is a curve fit, and they disagree by 5-10% once reps
 * climb. We average the five that are commonly used in strength research and
 * then correct for training age: newer lifters hold fewer reps at a given
 * percentage of their true max, so multi-rep formulas systematically
 * over-predict their 1RM. Experienced lifters sit close to the textbook curve.
 */

export type TrainedSet = {
  load: number;
  reps: number;
  date?: string | null;
};

export type OrmEstimate = {
  /** Adjusted, training-age aware estimate. */
  value: number;
  /** Raw multi-formula average before the training-age correction. */
  raw: number;
  /** Set the estimate came from. */
  from: TrainedSet;
  /** Spread across the formulas, as a fraction of the raw estimate. */
  spread: number;
  confidence: "high" | "medium" | "low";
};

export const MIN_TRAINING_AGE = 0;
export const MAX_TRAINING_AGE = 10;
export const DEFAULT_TRAINING_AGE = 1;

/** Individual formulas. All take load in the user's unit. */
export function formulaEstimates(load: number, reps: number): Record<string, number> {
  const r = Math.max(1, Math.round(reps));
  const out: Record<string, number> = {
    Epley: load * (1 + r / 30),
    "O'Conner": load * (1 + r / 40),
    Lombardi: load * Math.pow(r, 0.1),
    Wathan: (100 * load) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  };
  if (r < 37) out.Brzycki = (load * 36) / (37 - r);
  return out;
}

/**
 * How much the rep-based curve is trimmed per rep beyond the first.
 * ~0.6% per rep for a complete beginner, fading to 0 at five years of
 * consistent training. Capped so a 20-rep set never collapses the estimate.
 */
export function trainingAgeFactor(reps: number, trainingAge: number): number {
  const r = Math.max(1, Math.round(reps));
  if (r <= 1) return 1;
  const years = Math.min(Math.max(trainingAge, MIN_TRAINING_AGE), MAX_TRAINING_AGE);
  const perRep = 0.006 * Math.max(0, 1 - years / 5);
  return 1 - Math.min(0.12, perRep * (r - 1));
}

export function estimateFromSet(set: TrainedSet, trainingAge: number): OrmEstimate | null {
  if (!Number.isFinite(set.load) || set.load <= 0) return null;
  if (!Number.isFinite(set.reps) || set.reps <= 0) return null;
  const values = Object.values(formulaEstimates(set.load, set.reps));
  if (!values.length) return null;
  const raw = values.reduce((a, b) => a + b, 0) / values.length;
  const spread = raw > 0 ? (Math.max(...values) - Math.min(...values)) / raw : 0;
  const value = raw * trainingAgeFactor(set.reps, trainingAge);
  const reps = Math.round(set.reps);
  const confidence = reps <= 5 ? "high" : reps <= 10 ? "medium" : "low";
  return { value, raw, from: set, spread, confidence };
}

/**
 * Best estimate across a lift's logged sets. Heavy low-rep work wins ties,
 * because it needs the least extrapolation.
 */
export function estimateOneRepMax(sets: TrainedSet[], trainingAge: number): OrmEstimate | null {
  let best: OrmEstimate | null = null;
  for (const s of sets) {
    const e = estimateFromSet(s, trainingAge);
    if (!e) continue;
    if (!best || e.value > best.value || (e.value === best.value && e.from.reps < best.from.reps)) {
      best = e;
    }
  }
  return best;
}

/** Percentage-of-1RM training table, useful for turning an estimate into work. */
export function loadForReps(oneRm: number, reps: number): number {
  const r = Math.max(1, Math.round(reps));
  // Inverse Epley.
  return oneRm / (1 + r / 30);
}

export function trainingAgeLabel(years: number): string {
  if (years < 0.5) return "Brand new";
  if (years < 1) return "Under a year";
  if (years < 2) return "About a year";
  if (years < 5) return `${Math.round(years)} years in`;
  if (years < 10) return `${Math.round(years)}+ years`;
  return "10+ years";
}

export function roundLoad(n: number): number {
  return Math.round(n * 10) / 10;
}
