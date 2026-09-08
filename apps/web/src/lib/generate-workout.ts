import { canonMuscle } from "@liftcamp/shared";

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

// Categories the generator draws from.
//
// Only "strength". This filters out stretching, cardio and plyometrics, which
// are not loggable strength work and were polluting generated days ("Iron Cross
// Stretch" scored identically to a squat on legs day). It ALSO excludes
// powerlifting, olympic weightlifting and strongman -- not because those are
// bad exercises, but because at cold start the scorer treats every compound
// alike, so they crowd the slots: simulated over 300 generations, keeping them
// put a snatch/clean variant in 81% of legs days (24% of all legs picks).
//
// This only affects GENERATED workouts. Power cleans, box squats and farmer's
// walks remain fully searchable in the exercise picker and can be added by
// hand. Widen this array if you later want them in generated days too.
export const GENERATOR_CATEGORIES = ["strength"] as const;

type Slot = {
  // CANONICAL primary_muscle values to match. Candidate values are passed
  // through canonMuscle() before comparison, so synonyms no longer need to be
  // listed here.
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
    { muscles: ["lats", "upper back"], prefer: "compound" },
    { muscles: ["lats", "upper back", "traps"], prefer: "compound" },
    { muscles: ["lower back", "traps"], prefer: "any" },
    { muscles: ["biceps"], prefer: "isolation" },
    { muscles: ["biceps", "forearms"], prefer: "isolation" },
  ],
  legs: [
    { muscles: ["quads"], prefer: "compound" },
    { muscles: ["hamstrings", "glutes"], prefer: "compound" },
    { muscles: ["quads", "glutes"], prefer: "any" },
    { muscles: ["hamstrings"], prefer: "isolation" },
    { muscles: ["calves"], prefer: "any" },
  ],
  full: [
    { muscles: ["quads", "hamstrings", "glutes"], prefer: "compound" },
    { muscles: ["chest"], prefer: "compound" },
    { muscles: ["lats", "upper back"], prefer: "compound" },
    { muscles: ["shoulders"], prefer: "any" },
    { muscles: ["biceps", "triceps"], prefer: "isolation" },
    { muscles: ["abs"], prefer: "any" },
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

const norm = canonMuscle;

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
