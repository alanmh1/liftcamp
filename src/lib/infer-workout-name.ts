// Infer a workout name from the exercises actually logged.
//
// Workouts are created with a time-based placeholder ("Afternoon Workout").
// That is fine while training but useless in history, where every entry looks
// the same. This reads the primary muscles of the logged exercises and names
// the session after what was trained.
//
// Pure functions only — no DB access, no React — so this stays trivially
// testable and can be called from anywhere.

export const TIME_DEFAULT_NAMES = [
  "Morning Workout",
  "Afternoon Workout",
  "Evening Workout",
  "Night Workout",
] as const;

// Only ever replace a name the user has not chosen. If someone has typed their
// own name, inference must never overwrite it.
export function isDefaultWorkoutName(name: string | null | undefined): boolean {
  if (!name) return true;
  return (TIME_DEFAULT_NAMES as readonly string[]).includes(name.trim());
}

type Group = "push" | "pull" | "legs" | "core";

// The catalog carries two muscle vocabularies simultaneously: free-exercise-db
// seed rows were bulk-renamed to short names (quads / abs / upper back) while
// roughly ten hand-added rows use the canonical long names (quadriceps /
// abdominals / middle back). Both spellings are mapped here deliberately.
const MUSCLE_GROUP: Record<string, Group> = {
  chest: "push",
  shoulders: "push",
  triceps: "push",

  lats: "pull",
  "upper back": "pull",
  "middle back": "pull",
  "lower back": "pull",
  traps: "pull",
  biceps: "pull",
  forearms: "pull",
  neck: "pull",

  quads: "legs",
  quadriceps: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",

  abs: "core",
  abdominals: "core",
};

// Display labels for single-muscle sessions, normalising the two vocabularies
// onto one readable form.
const MUSCLE_LABEL: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulder",
  triceps: "Tricep",
  biceps: "Bicep",
  lats: "Back",
  "upper back": "Back",
  "middle back": "Back",
  "lower back": "Back",
  traps: "Trap",
  forearms: "Forearm",
  quads: "Leg",
  quadriceps: "Leg",
  hamstrings: "Hamstring",
  glutes: "Glute",
  calves: "Calf",
  abs: "Core",
  abdominals: "Core",
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Given the primary muscles of every exercise in a workout (one entry per
 * exercise, duplicates fine), return a name — or null when there is nothing
 * confident to say, in which case the caller keeps the existing name.
 */
export function inferWorkoutName(
  primaryMuscles: (string | null | undefined)[],
): string | null {
  const muscles = primaryMuscles.map(norm).filter(Boolean);
  if (muscles.length === 0) return null;

  const groupCount: Record<Group, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  const muscleCount = new Map<string, number>();
  let classified = 0;

  for (const m of muscles) {
    const g = MUSCLE_GROUP[m];
    if (!g) continue;
    groupCount[g]++;
    classified++;
    muscleCount.set(m, (muscleCount.get(m) ?? 0) + 1);
  }

  // Nothing recognised (an all-custom-exercise session, say): say nothing
  // rather than guess.
  if (classified === 0) return null;

  // Core is treated as an accessory rather than a split of its own: almost
  // every session ends with abs, and that should not make it "Core Day".
  const structural = groupCount.push + groupCount.pull + groupCount.legs;
  if (structural === 0) return "Core";

  const share = (g: Group) => groupCount[g] / structural;

  // A single muscle carrying most of the session gets named for itself, which
  // is more useful than the split label: "Chest Day" beats "Push Day" when
  // every exercise was a press or a fly. This also covers the one-exercise
  // session, where a split label would badly overstate what happened.
  const [topMuscle, topMuscleN] = [...muscleCount.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (topMuscleN / classified >= 0.75) {
    const label = MUSCLE_LABEL[topMuscle];
    if (label) return `${label} Day`;
  }

  const DOMINANT = 0.7;
  if (share("legs") >= DOMINANT) return "Leg Day";
  if (share("push") >= DOMINANT) return "Push Day";
  if (share("pull") >= DOMINANT) return "Pull Day";

  // Arms-only sessions read as neither push nor pull.
  const armReps =
    (muscleCount.get("biceps") ?? 0) +
    (muscleCount.get("triceps") ?? 0) +
    (muscleCount.get("forearms") ?? 0);
  if (armReps / classified >= 0.75) return "Arm Day";

  const hasUpper = groupCount.push > 0 || groupCount.pull > 0;
  const hasLegs = groupCount.legs > 0;

  if (hasUpper && hasLegs) return "Full Body";
  if (hasUpper) return "Upper Body";
  return "Leg Day";
}
