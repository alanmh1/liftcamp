// Canonical muscle vocabulary — the single source of truth.
//
// Before this module, four separate files carried their own hardcoded
// both-spellings maps (muscle-map, exercise-visuals, infer-workout-name,
// generate-workout). Every new feature touching muscles had to remember to
// handle "quads" AND "quadriceps", and the fifth place that forgot produced the
// duplicate filter-dropdown bug.
//
// Now there is exactly one synonym table. Adding a synonym means editing
// SYNONYMS below and public.canon_muscle() in SQL — nowhere else.
//
// KEEP IN SYNC: SYNONYMS mirrors public.canon_muscle(), and normalizeSearch()
// mirrors BOTH the generated exercises.search_text column and the normalize
// half of exercises.search_all. If you change one, change all three, or search
// silently stops matching.

/** The 17 values `exercises.primary_muscle` is allowed to hold. Enforced by the
 *  `exercises_primary_muscle_canonical` CHECK constraint. */
export const CANONICAL_MUSCLES = [
  "abductors",
  "abs",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "neck",
  "quads",
  "shoulders",
  "traps",
  "triceps",
  "upper back",
] as const;

export type CanonicalMuscle = (typeof CANONICAL_MUSCLES)[number];

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_MUSCLES);

/** Stale or alternate spellings mapped to canonical. Mirrors public.canon_muscle(). */
const SYNONYMS: Readonly<Record<string, CanonicalMuscle>> = {
  quadriceps: "quads",
  abdominals: "abs",
  core: "abs",
  "middle back": "upper back",
  back: "upper back",
};

/** Canonicalizes a single muscle token. Unknown values pass through lowercased
 *  and trimmed rather than being dropped, so an unexpected value still renders
 *  instead of vanishing from the UI. */
export function canonMuscle(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  return SYNONYMS[key] ?? key;
}

/** Canonicalizes a pipe-delimited list (all_primary_muscles, secondary_muscles).
 *  Preserves order, drops duplicates created by canonicalization. Mirrors
 *  public.canon_muscle_list(). */
export function canonMuscleList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split("|")) {
    const m = canonMuscle(part);
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** True if the value is one of the 17 allowed primary_muscle values. */
export function isCanonicalMuscle(raw: string | null | undefined): raw is CanonicalMuscle {
  return !!raw && CANONICAL_SET.has(raw);
}

/** Display labels for the filter dropdown and muscle chips. Title case; the
 *  underlying value stays canonical lowercase. Plain-language beginner labels
 *  (e.g. "Front Thigh") can be swapped in here later without touching queries. */
export const MUSCLE_LABELS: Readonly<Record<CanonicalMuscle, string>> = {
  abductors: "Abductors",
  abs: "Abs",
  adductors: "Adductors",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  forearms: "Forearms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  lats: "Lats",
  "lower back": "Lower Back",
  neck: "Neck",
  quads: "Quads",
  shoulders: "Shoulders",
  traps: "Traps",
  triceps: "Triceps",
  "upper back": "Upper Back",
};

export function muscleLabel(raw: string | null | undefined): string {
  const m = canonMuscle(raw);
  return isCanonicalMuscle(m) ? MUSCLE_LABELS[m] : m;
}

/** Normalizes a string for name matching: lowercase, all non-alphanumerics
 *  stripped. MUST match the SQL generating exercises.search_text:
 *
 *    lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))
 *
 *  This is what makes "pull up" and "pull-up" both find the row named
 *  "Pullups" — all three normalize into substring range of "pullups". */
export function normalizeSearch(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
