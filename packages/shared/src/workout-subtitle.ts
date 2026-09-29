// The summary's line under the headline: which workout this was, with an
// emoji. Deterministic by the finished-workout number, so the same workout
// reads the same wherever it appears.

import { proseOrdinal } from "./copy-numbers";

/** The rotation for workouts that are not milestones. */
export const WORKOUT_EMOJI = ["💪", "🔥", "⚡️", "🙌", "👏", "🎯", "✅", "🚀", "😤", "🦾"] as const;

type Milestone = { line: string; emoji: string };

const MILESTONES: Record<number, Milestone> = {
  1: { line: "You finished your first workout", emoji: "💪" },
  5: { line: "Your fifth workout", emoji: "🙌" },
  10: { line: "Your 10th workout. Double digits", emoji: "🔥" },
  25: { line: "Your 25th workout", emoji: "🏅" },
  50: { line: "Your 50th workout. Halfway to 100", emoji: "🎉" },
  100: { line: "Your 100th workout", emoji: "💯" },
};

function milestone(n: number): Milestone | null {
  if (MILESTONES[n]) return MILESTONES[n];
  // Every multiple of 100 after the first.
  if (n > 100 && n % 100 === 0) return { line: `Your ${proseOrdinal(n)} workout`, emoji: "🏆" };
  return null;
}

/** Milestone workouts always get the confetti. */
export function isMilestoneWorkout(n: number): boolean {
  return milestone(n) != null;
}

/**
 * Where a non-milestone looks in the rotation: its own slot first, then
 * half the pool away and outward. A jump of one would land on the next
 * workout's own slot and push the clash along; half the pool away lands
 * clear of both neighbors' own slots.
 */
const OFFSETS = [0, 5, 6, 4, 7, 3, 8, 2, 9, 1];

/** The emoji for workout `n`, never the same as workout n - 1 or n + 1. */
export function workoutEmoji(n: number): string {
  const m = milestone(n);
  if (m) return m.emoji;
  const len = WORKOUT_EMOJI.length;
  const base = ((n % len) + len) % len;
  // A neighbor's emoji: a milestone's own, else its slot in the rotation.
  // A non-milestone neighbor only leaves its slot beside a milestone, and
  // then by half the pool, which never lands on this workout's choice.
  const taken = new Set<string>();
  for (const k of [n - 1, n + 1]) {
    const mk = k >= 1 ? milestone(k) : null;
    taken.add(mk ? mk.emoji : WORKOUT_EMOJI[((k % len) + len) % len]);
  }
  for (const off of OFFSETS) {
    const e = WORKOUT_EMOJI[(base + off) % len];
    if (!taken.has(e)) return e;
  }
  return WORKOUT_EMOJI[base];
}

/** "You finished your first workout 💪", "Your 17th workout 😤". */
export function workoutSubtitle(n: number): string {
  const count = Math.max(1, Math.floor(n));
  const m = milestone(count);
  return m ? `${m.line} ${m.emoji}` : `Your ${proseOrdinal(count)} workout ${workoutEmoji(count)}`;
}
