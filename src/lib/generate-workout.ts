// Generate-workout suggestion engine.
//
// Pure selection logic only: given a day type, a candidate pool from the
// exercises catalog, and the set of exercise ids the user has trained before,
// produce a balanced, ordered list of exercise ids. The caller (home screen)
// then reuses the existing per-exercise prefill machinery (most-recent prior
// sets -> coldStartSuggestion fallback) to fill in suggested reps and weights.
//
// No DB access here, so this stays trivially testable.

export type DayType = "push" | "pull" | "legs" | "full";

export const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "full", label: "Full body" },
];

export type CandidateExercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  mechanic: string | null; // "compound" | "isolation" (free text)
  equipment: string | null;
  level: string | null;
};

type Slot = {
  // primary_muscle values to match (lowercased, free-exercise-db naming)
  muscles: string[];
  prefer: "compound" | "isolation" | "any";
};

// Each day is a prioritized list of slots. Slots are filled in order; a slot
// that can't be matched is simply skipped, so a sparse catalog degrades
// gracefully rather than erroring.
const DAY_SLOTS: Record<DayType, Slot[]> = {
  push: [
    { muscles: ["chest"], prefer: "compound" },
    { muscles: ["shoulders"], prefer: "compound" },
    { muscles: ["chest"], prefer: "any" },
    { muscles: ["triceps"], prefer: "isolation" },
    { muscles: ["shoulders"], prefer: "isolation" },
  ],
  pull: [
    { muscles: ["lats", "middle back"], prefer: "compound" },
    { muscles: ["lats", "middle back", "traps"], prefer: "compound" },
    { muscles: ["lower back", "traps"], prefer: "any" },
    { muscles: ["biceps"], prefer: "isolation" },
    { muscles: ["biceps", "forearms"], prefer: "isolation" },
  ],
  legs: [
    { muscles: ["quadriceps"], prefer: "compound" },
    { muscles: ["hamstrings", "glutes"], prefer: "compound" },
    { muscles: ["quadriceps", "glutes"], prefer: "any" },
    { muscles: ["hamstrings"], prefer: "isolation" },
    { muscles: ["calves"], prefer: "any" },
  ],
  full: [
    { muscles: ["quadriceps", "hamstrings", "glutes"], prefer: "compound" },
    { muscles: ["chest"], prefer: "compound" },
    { muscles: ["lats", "middle back"], prefer: "compound" },
    { muscles: ["shoulders"], prefer: "any" },
    { muscles: ["biceps", "triceps"], prefer: "isolation" },
    { muscles: ["abdominals"], prefer: "any" },
  ],
};

// The full set of primary_muscle values a day type draws from. The caller uses
// this to scope the catalog query (`.in("primary_muscle", ...)`).
export function musclesForDay(day: DayType): string[] {
  const out = new Set<string>();
  for (const slot of DAY_SLOTS[day]) {
    for (const m of slot.muscles) out.add(m);
  }
  return [...out];
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function scoreCandidate(
  ex: CandidateExercise,
  slot: Slot,
  trainedIds: Set<string>,
  rng: () => number,
): number {
  let score = 0;
  // Strongly favor exercises the user has trained before: those get real
  // weights/reps prefilled from history instead of a cold-start guess.
  if (trainedIds.has(ex.id)) score += 1000;
  // Honor the slot's mechanic preference.
  const mech = norm(ex.mechanic);
  if (slot.prefer !== "any" && mech === slot.prefer) score += 100;
  // Tiny bonus for having equipment recorded (filters out malformed rows).
  if (norm(ex.equipment)) score += 5;
  // Random tiebreak so repeated taps produce fresh-but-sensible variety.
  score += rng() * 10;
  return score;
}

export type GenerateOptions = {
  trainedIds?: Iterable<string>;
  // Injectable RNG for deterministic tests; defaults to Math.random.
  rng?: () => number;
};

// Returns an ordered list of selected exercises (deduped), one per fillable
// slot. May be shorter than the slot count if the catalog is sparse.
export function generateWorkout(
  day: DayType,
  pool: CandidateExercise[],
  opts: GenerateOptions = {},
): CandidateExercise[] {
  const rng = opts.rng ?? Math.random;
  const trainedIds = new Set<string>(opts.trainedIds ?? []);
  const used = new Set<string>();
  const picked: CandidateExercise[] = [];

  for (const slot of DAY_SLOTS[day]) {
    const muscles = new Set(slot.muscles);
    const candidates = pool.filter(
      (ex) => !used.has(ex.id) && muscles.has(norm(ex.primary_muscle)),
    );
    if (candidates.length === 0) continue;

    let best: CandidateExercise | null = null;
    let bestScore = -Infinity;
    for (const ex of candidates) {
      const s = scoreCandidate(ex, slot, trainedIds, rng);
      if (s > bestScore) {
        bestScore = s;
        best = ex;
      }
    }
    if (best) {
      picked.push(best);
      used.add(best.id);
    }
  }

  return picked;
}
