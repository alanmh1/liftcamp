import { oneRepMaxNumeric } from "./one-rep-max";
import { effectiveLoad } from "./set-weight";
import { isWarmupSet } from "./working-sets";

type SetLike = {
  id: string;
  weight: string | null;
  weight_value?: number | null;
  reps: number | null;
  created_at?: string | null;
  /** A warm-up row (`set_type` warmup) is never a PR and never raises the bar. */
  set_type?: string | null;
};

/**
 * One `workout_exercises` row's sets, in the order they were logged, for
 * `computePrSetIds`: by position, all stamped with the row's earliest
 * `created_at`, so its sort keeps them in position order. A generated
 * warm-up row is inserted after the rows below it, so its own `created_at`
 * is later than theirs; once it is switched to a working set it still comes
 * first, as it does on the workout screen.
 */
export function setsInLoggedOrder<T extends { position: number; created_at?: string | null }>(sets: readonly T[]): T[] {
  const stamps = sets.map((s) => s.created_at ?? "").filter((t) => t !== "");
  const first = stamps.length > 0 ? stamps.reduce((a, b) => (b < a ? b : a)) : null;
  return [...sets].sort((a, b) => a.position - b.position).map((s) => ({ ...s, created_at: first }));
}

export function computePrSetIds(
  sets: SetLike[],
  exercise?: { weight_type?: string | null } | null,
  bodyweight?: number | null,
): Set<string> {
  const sorted = [...sets].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  let max = -Infinity;
  const prs = new Set<string>();
  for (const s of sorted) {
    if (isWarmupSet(s)) continue;
    const w = effectiveLoad(
      { weight: s.weight, weight_value: s.weight_value ?? null },
      exercise ?? null,
      bodyweight ?? null,
    );
    const orm = oneRepMaxNumeric(w, s.reps);
    if (orm == null) continue;
    if (orm > max) {
      prs.add(s.id);
      max = orm;
    }
  }
  return prs;
}
