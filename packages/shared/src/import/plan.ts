import { hasIncline, isCardio } from "../cardio";
import type { FitbodRow } from "./fitbod";

/** The sources `import_workouts` accepts. Fitbod only in this version. */
export type ImportSource = "fitbod";

export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = { fitbod: "Fitbod" };

/** `workouts.app_version` on every imported workout, per source: `fitbod-csv`. */
export function importTag(source: ImportSource): string {
  return `${source}-csv`;
}

/** What the user picked for one source name: a LiftCamp exercise id, or leave it out. */
export type ImportChoice = string | "skip";

/** A catalog exercise as the plan needs it. */
export type PlanCatalogEntry = {
  id: string;
  weight_type?: string | null;
  set_type?: string | null;
  has_incline?: boolean | null;
};

/** One set as `import_workouts` reads it. */
export type ImportSetPayload = {
  weight: number | null;
  /** Sent with a weight; the function ignores it without one. */
  unit: "kg" | null;
  reps: number | null;
  duration: number | null;
  distance: number | null;
  incline: number | null;
  set_type: "warmup" | null;
  note: string | null;
};

export type ImportWorkoutPayload = {
  /** The session's start, ISO. The function skips a start already imported from this source. */
  created_at: string;
  /** YYYY-MM-DD, the device's local date of the start. */
  workout_date: string;
  finished_at: string;
  notes: string;
  exercises: { exercise_id: string; sets: ImportSetPayload[] }[];
};

export type ImportSummary = {
  workouts: number;
  sets: number;
  /** Local dates, YYYY-MM-DD. Null when nothing is left to import. */
  firstDate: string | null;
  lastDate: string | null;
  /** Sessions on a date that already has a workout logged in LiftCamp. */
  skippedLoggedDates: number;
  /** Sessions whose start is already imported from this source. */
  alreadyImported: number;
  /** Sets left out because their exercise is set to Skip, in sessions otherwise imported. */
  setsLeftOut: number;
  /** Distinct source names set to Skip. */
  skippedExercises: number;
};

export type ImportPlan = { workouts: ImportWorkoutPayload[]; summary: ImportSummary };

export type ImportPlanOptions = {
  source: ImportSource;
  /** Local dates (YYYY-MM-DD) with a finished workout not imported from this source. */
  existingDates: Set<string>;
  /** Start times (any ISO form) of workouts already imported from this source. */
  importedStarts: Set<string>;
  /** The device's local date of an ISO time, YYYY-MM-DD. */
  localDate: (iso: string) => string;
};

/** Seconds a session is assumed to take per set. Fitbod exports no duration. */
export const IMPORT_SECONDS_PER_SET = 150;
export const IMPORT_MIN_MINUTES = 15;
export const IMPORT_MAX_MINUTES = 120;
/** The highest incline a treadmill set keeps, percent. */
export const IMPORT_MAX_INCLINE = 50;

function isoKey(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(t).toISOString();
}

function positiveOrNull(n: number): number | null {
  return n > 0 ? n : null;
}

function setPayload(row: FitbodRow, exercise: PlanCatalogEntry | undefined): ImportSetPayload {
  const set_type = row.warmup ? "warmup" : null;
  const note = row.note;
  if (isCardio(exercise)) {
    return {
      weight: null,
      unit: null,
      reps: null,
      duration: positiveOrNull(row.durationS),
      distance: positiveOrNull(row.distanceM),
      incline: hasIncline(exercise) ? positiveOrNull(Math.min(row.incline, IMPORT_MAX_INCLINE)) : null,
      set_type,
      note,
    };
  }
  // A bodyweight exercise logged with no added load is 0, the way the app
  // logs it, so it counts for PRs; any other zero is no weight at all.
  const bodyweight = exercise?.weight_type === "bodyweight";
  const weight = row.weightKg > 0 || bodyweight ? Math.max(row.weightKg, 0) : null;
  return {
    weight,
    unit: weight == null ? null : "kg",
    reps: positiveOrNull(row.reps),
    duration: positiveOrNull(row.durationS),
    distance: null,
    incline: null,
    set_type,
    note,
  };
}

/**
 * Turns parsed rows and the user's choices into the `import_workouts`
 * payload, one workout per session (rows sharing a start time), and the
 * review screen's summary.
 *
 * Exercises keep the order of their first row in the session, sets the
 * order of the file. Each source name is its own exercise in the workout,
 * even when two names were matched to the same LiftCamp exercise. A name
 * missing from `choices` is skipped.
 *
 * A session is left out when its start is already imported, when its local
 * date already has a workout logged in LiftCamp (people log in both apps
 * while they switch), or when every one of its exercises is skipped.
 */
export function buildImportPlan(
  rows: readonly FitbodRow[],
  choices: Readonly<Record<string, ImportChoice>>,
  catalog: readonly PlanCatalogEntry[],
  opts: ImportPlanOptions,
): ImportPlan {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const imported = new Set([...opts.importedStarts].map(isoKey));
  const choiceFor = (name: string): string | null => {
    const c = choices[name];
    return c && c !== "skip" ? c : null;
  };

  const sessions = new Map<string, FitbodRow[]>();
  for (const row of rows) {
    const list = sessions.get(row.startedAt);
    if (list) list.push(row);
    else sessions.set(row.startedAt, [row]);
  }

  const workouts: ImportWorkoutPayload[] = [];
  let sets = 0;
  let skippedLoggedDates = 0;
  let alreadyImported = 0;
  let setsLeftOut = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const [startedAt, sessionRows] of sessions) {
    if (imported.has(isoKey(startedAt))) {
      alreadyImported += 1;
      continue;
    }
    const workoutDate = opts.localDate(startedAt);
    if (opts.existingDates.has(workoutDate)) {
      skippedLoggedDates += 1;
      continue;
    }

    const exercises = new Map<string, { exercise_id: string; sets: ImportSetPayload[] }>();
    let cardioSeconds = 0;
    let setCount = 0;
    for (const row of sessionRows) {
      const exerciseId = choiceFor(row.exercise);
      if (!exerciseId) {
        setsLeftOut += 1;
        continue;
      }
      const entry = byId.get(exerciseId);
      let ex = exercises.get(row.exercise);
      if (!ex) {
        ex = { exercise_id: exerciseId, sets: [] };
        exercises.set(row.exercise, ex);
      }
      ex.sets.push(setPayload(row, entry));
      setCount += 1;
      if (isCardio(entry)) cardioSeconds += Math.max(row.durationS, 0);
    }
    if (setCount === 0) continue;

    const seconds = Math.min(
      Math.max(setCount * IMPORT_SECONDS_PER_SET + cardioSeconds, IMPORT_MIN_MINUTES * 60),
      IMPORT_MAX_MINUTES * 60,
    );
    const start = new Date(startedAt).getTime();
    workouts.push({
      created_at: new Date(start).toISOString(),
      workout_date: workoutDate,
      finished_at: new Date(start + seconds * 1000).toISOString(),
      notes: `Imported from ${IMPORT_SOURCE_LABEL[opts.source]}`,
      exercises: [...exercises.values()],
    });
    sets += setCount;
    if (firstDate == null || workoutDate < firstDate) firstDate = workoutDate;
    if (lastDate == null || workoutDate > lastDate) lastDate = workoutDate;
  }

  const names = new Set(rows.map((r) => r.exercise));
  const skippedExercises = [...names].filter((n) => !choiceFor(n)).length;

  return {
    workouts,
    summary: {
      workouts: workouts.length,
      sets,
      firstDate,
      lastDate,
      skippedLoggedDates,
      alreadyImported,
      setsLeftOut,
      skippedExercises,
    },
  };
}

/** Splits the payload into the batches `import_workouts` takes, at most 50 each. */
export function importBatches<T>(items: readonly T[], size = 50): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
