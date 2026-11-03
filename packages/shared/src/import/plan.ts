import { hasIncline, isCardio, METERS_PER_KM, METERS_PER_MILE } from "../cardio";
import { round2, type ImportRow } from "./row";

/** The sources `import_workouts` accepts. */
export type ImportSource = "fitbod" | "strong" | "hevy";

export const IMPORT_SOURCES: readonly ImportSource[] = ["fitbod", "strong", "hevy"];

export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = { fitbod: "Fitbod", strong: "Strong", hevy: "Hevy" };

/** `workouts.app_version` on every imported workout, per source: `fitbod-csv`, `strong-csv`, `hevy-csv`. */
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
  /** `dumbbell` for the sets `dumbbellsCombined` halves. */
  equipment?: string | null;
};

/** One set as `import_workouts` reads it. */
export type ImportSetPayload = {
  weight: number | null;
  /** Sent with a weight; the function ignores it without one. Stored as given, never converted. */
  unit: "kg" | "lb" | null;
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
  /** The workout's name in the other app, or null. */
  name: string | null;
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
  /** Fills in the unit wherever a row has none: the answer for Strong's iOS file, else the user's unit. */
  unit?: "kg" | "lb";
  /** The file logged both dumbbells together: halve the weight on sets whose exercise has `equipment` `dumbbell`. */
  dumbbellsCombined?: boolean;
};

/** Seconds a session is assumed to take per set, when the file gives no usable end. */
export const IMPORT_SECONDS_PER_SET = 150;
export const IMPORT_MIN_MINUTES = 15;
export const IMPORT_MAX_MINUTES = 120;
/** The highest incline a treadmill set keeps, percent. */
export const IMPORT_MAX_INCLINE = 50;

function isoKey(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(t).toISOString();
}

function positiveOrNull(n: number | null): number | null {
  return n != null && n > 0 ? n : null;
}

type SetOptions = Pick<ImportPlanOptions, "unit" | "dumbbellsCombined">;

/** A row's distance in meters, with Strong iOS's unitless number read by the weight unit. */
function distanceMeters(row: ImportRow, unit: "kg" | "lb" | null): number | null {
  if (row.distanceM == null) return null;
  if (!row.distanceUnknown || unit !== "lb") return round2(row.distanceM);
  return round2((row.distanceM / METERS_PER_KM) * METERS_PER_MILE);
}

function setPayload(row: ImportRow, exercise: PlanCatalogEntry | undefined, opts: SetOptions): ImportSetPayload {
  const set_type = row.warmup ? "warmup" : null;
  const note = row.note;
  const unit = row.unit ?? opts.unit ?? null;
  if (isCardio(exercise)) {
    return {
      weight: null,
      unit: null,
      reps: null,
      duration: positiveOrNull(row.durationS),
      distance: positiveOrNull(distanceMeters(row, unit)),
      incline: hasIncline(exercise) ? positiveOrNull(row.incline == null ? null : Math.min(row.incline, IMPORT_MAX_INCLINE)) : null,
      set_type,
      note,
    };
  }
  // A bodyweight exercise logged with no added load is 0, the way the app
  // logs it, so it counts for PRs; any other zero or empty cell is no
  // weight at all. Weighted and assisted loads pass through as logged.
  const bodyweight = exercise?.weight_type === "bodyweight";
  const raw = row.weight ?? 0;
  let weight = raw > 0 || bodyweight ? Math.max(raw, 0) : null;
  if (weight != null && opts.dumbbellsCombined && exercise?.equipment === "dumbbell") weight = round2(weight / 2);
  return {
    weight,
    unit: weight == null ? null : unit,
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
 * payload, one workout per session (rows sharing a `sessionKey`), and the
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
 *
 * The finish is the file's own when it has one, else an estimate from the
 * set count and cardio time. The note is the file's workout note, else
 * "Imported from <source>".
 */
export function buildImportPlan(
  rows: readonly ImportRow[],
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

  const sessions = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const list = sessions.get(row.sessionKey);
    if (list) list.push(row);
    else sessions.set(row.sessionKey, [row]);
  }

  const workouts: ImportWorkoutPayload[] = [];
  let sets = 0;
  let skippedLoggedDates = 0;
  let alreadyImported = 0;
  let setsLeftOut = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const sessionRows of sessions.values()) {
    const first = sessionRows[0];
    const startedAt = first.startedAt;
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
      ex.sets.push(setPayload(row, entry, opts));
      setCount += 1;
      if (isCardio(entry)) cardioSeconds += Math.max(row.durationS ?? 0, 0);
    }
    if (setCount === 0) continue;

    const start = new Date(startedAt).getTime();
    const fileFinish = first.finishedAt ? new Date(first.finishedAt).getTime() : Number.NaN;
    let finish: number;
    if (Number.isFinite(fileFinish) && fileFinish > start) {
      finish = fileFinish;
    } else {
      const seconds = Math.min(
        Math.max(setCount * IMPORT_SECONDS_PER_SET + cardioSeconds, IMPORT_MIN_MINUTES * 60),
        IMPORT_MAX_MINUTES * 60,
      );
      finish = start + seconds * 1000;
    }
    const name = sessionRows.find((r) => r.workoutName)?.workoutName ?? null;
    const note = sessionRows.find((r) => r.workoutNote)?.workoutNote ?? null;
    workouts.push({
      created_at: new Date(start).toISOString(),
      workout_date: workoutDate,
      finished_at: new Date(finish).toISOString(),
      name,
      notes: note ?? `Imported from ${IMPORT_SOURCE_LABEL[opts.source]}`,
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
