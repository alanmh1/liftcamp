import { normalizeSearch, STRENGTH_EXERCISES, STRENGTH_STANDARDS } from "@liftcamp/shared";
import type { IndexExercise } from "./catalog";

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export type ExerciseResolution =
  | { kind: "match"; exercise: IndexExercise }
  | { kind: "ambiguous"; candidates: IndexExercise[] }
  | { kind: "none" };

/** How many names an ambiguous answer lists. */
export const AMBIGUOUS_LIMIT = 5;

/** Authored exercises first, then shorter names, so "bench press" lists
 *  Barbell Bench Press before Decline Close-Grip Bench to Skull Crusher. */
function byRelevance(a: IndexExercise, b: IndexExercise): number {
  return (
    Number(b.has_notes) - Number(a.has_notes) ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name)
  );
}

function settle(found: IndexExercise[]): ExerciseResolution | null {
  if (found.length === 0) return null;
  if (found.length === 1) return { kind: "match", exercise: found[0]! };
  return { kind: "ambiguous", candidates: [...found].sort(byRelevance).slice(0, AMBIGUOUS_LIMIT) };
}

/**
 * The exercise a query names, in this order: exact slug ("romanian deadlift"
 * also tries "romanian-deadlift"), exact name ignoring case, name containing
 * the query, then the curated aliases, then search_all with every word
 * present. The first step with any match decides; one match is the answer,
 * several are listed back.
 */
export function resolveExercise(index: IndexExercise[], query: string): ExerciseResolution {
  const q = query.trim().toLowerCase();
  if (!q) return { kind: "none" };

  const slug = q.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const bySlug = index.find((e) => e.slug === q || e.slug === slug);
  if (bySlug) return { kind: "match", exercise: bySlug };

  const byName = index.find((e) => e.name.toLowerCase() === q);
  if (byName) return { kind: "match", exercise: byName };

  const nameHit = settle(index.filter((e) => e.name.toLowerCase().includes(q)));
  if (nameHit) return nameHit;

  const norm = normalizeSearch(q);
  if (!norm) return { kind: "none" };
  const aliasHit = settle(index.filter((e) => e.alias_text?.includes(norm)));
  if (aliasHit) return aliasHit;

  // Each word on its own, as the public search does, so "smith hip thrust"
  // finds Smith Machine Hip Thrust.
  const words = q.split(/\s+/).map(normalizeSearch).filter(Boolean);
  const allHit = settle(index.filter((e) => words.every((w) => e.search_all?.includes(w))));
  return allHit ?? { kind: "none" };
}

// ---------------------------------------------------------------------------
// Lifts with a strength level
// ---------------------------------------------------------------------------

const [SQUAT, BENCH, DEADLIFT, PRESS, ROW, RDL, PULLDOWN] = STRENGTH_EXERCISES as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

/** What people call the seven lifts, normalized. The standard names are
 *  added below, so "Bent Over Barbell Row" resolves as written. */
const LIFT_ALIASES: Record<string, string> = {
  squat: SQUAT,
  backsquat: SQUAT,
  bench: BENCH,
  benchpress: BENCH,
  flatbench: BENCH,
  flatbenchpress: BENCH,
  deadlift: DEADLIFT,
  conventionaldeadlift: DEADLIFT,
  dl: DEADLIFT,
  ohp: PRESS,
  overheadpress: PRESS,
  militarypress: PRESS,
  standingpress: PRESS,
  strictpress: PRESS,
  press: PRESS,
  row: ROW,
  barbellrow: ROW,
  bentoverrow: ROW,
  bbrow: ROW,
  rdl: RDL,
  romaniandeadlift: RDL,
  latpulldown: PULLDOWN,
  pulldown: PULLDOWN,
  widegrippulldown: PULLDOWN,
};
for (const id of STRENGTH_EXERCISES) {
  const name = STRENGTH_STANDARDS[id]?.name;
  if (name) LIFT_ALIASES[normalizeSearch(name)] = id;
}

/** Edit distance, for "deadlfit" and "bench pres". */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(up + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/**
 * The strength-standard exercise id a lift name means, or null. Dumbbell
 * lifts are refused outright: their standards are off in the app, and
 * "dumbbell bench" must not fall through to the barbell bench.
 */
export function resolveLift(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (
    /\b(dumbbells?|db|kettlebells?|kb|smith|machine|front|goblet|split|incline|decline)\b/.test(raw)
  ) {
    return null;
  }
  const norm = normalizeSearch(raw);
  if (!norm) return null;
  const candidates = [
    norm,
    norm.replace(/^barbell/, ""),
    norm.replace(/s$/, ""),
    norm.replace(/^barbell/, "").replace(/s$/, ""),
  ];
  for (const c of candidates) {
    const id = LIFT_ALIASES[c];
    if (id) return id;
  }
  // A typo of a name long enough that two letters off cannot be another lift.
  let best: { id: string; d: number } | null = null;
  for (const [alias, id] of Object.entries(LIFT_ALIASES)) {
    if (alias.length < 5) continue;
    const d = distance(norm, alias);
    if (d <= 2 && (!best || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}

/** The seven names, for the "not supported" answer. */
export function supportedLiftNames(): string[] {
  return STRENGTH_EXERCISES.map((id) => STRENGTH_STANDARDS[id]?.name ?? id);
}
