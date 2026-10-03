// The active workout's progress bar: how much of the workout is done, as
// the two layers the bar draws. Pure, no React. The spec is the progress
// bar section of docs/active-workout-spec.md.
//
// Only exercises with at least one set count, so an empty exercise card
// can never hold the bar short of full.

export type WorkoutProgress = {
  /** Exercises with at least one set. */
  total: number;
  /** Of those, the ones with every set checked. */
  done: number;
  /** Sum over those exercises of checked sets over sets: partial credit included. */
  setFraction: number;
};

export function workoutProgress(
  exercises: readonly { sets: readonly { completed: boolean }[] }[],
): WorkoutProgress {
  let total = 0;
  let done = 0;
  let setFraction = 0;
  for (const we of exercises) {
    if (we.sets.length === 0) continue;
    total += 1;
    const checked = we.sets.filter((s) => s.completed).length;
    if (checked === we.sets.length) done += 1;
    setFraction += checked / we.sets.length;
  }
  return { total, done, setFraction };
}

/**
 * The bar's two widths, 0 to 1: the solid layer for whole exercises done,
 * and the tint under it for every checked set. Both 0 with nothing to do.
 */
export function progressWidths(p: WorkoutProgress): { solid: number; tint: number } {
  if (p.total <= 0) return { solid: 0, tint: 0 };
  return { solid: p.done / p.total, tint: p.setFraction / p.total };
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * `from` moved `t` (0 to 1) of the way to `to`, by linear interpolation of
 * each RGB channel, as #RRGGBB in upper case. The bar's ramp, and the tint
 * as the solid color mixed half with the card surface.
 */
export function mixHex(from: string, to: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const a = channels(from);
  const b = channels(to);
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}
