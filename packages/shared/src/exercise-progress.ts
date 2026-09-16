import { oneRepMaxNumeric } from "./one-rep-max";
import { effectiveLoad, setVolume, type SetForDisplay } from "./set-weight";

/**
 * Per-exercise progress: what one session amounted to, and the records
 * across sessions. Every number comes through the same functions the rest
 * of the app uses (`effectiveLoad`, `oneRepMaxNumeric`, `setVolume`), so a
 * value here matches the workout summary, the history detail and the PR
 * ribbons.
 */

export type ProgressExercise = {
  weight_type?: string | null;
  equipment?: string | null;
  is_unilateral?: boolean | null;
};

export type ProgressSet = SetForDisplay & { reps: number | null };

/**
 * Whether an exercise is tracked by reps alone. True for a bodyweight-type
 * exercise when the profile has no bodyweight (no load can be computed),
 * and for a body-only exercise none of whose completed sets carries a
 * load. Everything else is load-based. One function so the list, the
 * chart and the records agree.
 */
export function isRepBased(
  exercise: ProgressExercise,
  bodyweight: number | null | undefined,
  completedSets: readonly ProgressSet[],
): boolean {
  if (exercise.weight_type === "bodyweight" && bodyweight == null) return true;
  if (exercise.equipment === "body only") {
    return !completedSets.some((s) => effectiveLoad(s, exercise, bodyweight) != null);
  }
  return false;
}

export type BestSet = { load: number; reps: number; estimatedMax: number };

export type SessionSummary = {
  /** Highest estimated one-rep max across the session's sets. */
  estimatedMax: number | null;
  /** The set that produced `estimatedMax`. */
  bestSet: BestSet | null;
  /** Heaviest load lifted for any reps. */
  heaviest: number | null;
  /** Total volume, via setVolume, so unilateral doubling is honoured. */
  volume: number;
  /** Most reps in one set. */
  mostReps: number | null;
  totalReps: number;
  sets: number;
};

/** Completed sets only; the caller filters. */
export function summarizeSession(
  sets: readonly ProgressSet[],
  exercise: ProgressExercise,
  bodyweight: number | null | undefined,
): SessionSummary {
  let estimatedMax: number | null = null;
  let bestSet: BestSet | null = null;
  let heaviest: number | null = null;
  let volume = 0;
  let mostReps: number | null = null;
  let totalReps = 0;

  for (const s of sets) {
    const load = effectiveLoad(s, exercise, bodyweight);
    const reps = s.reps ?? 0;
    if (reps > 0) {
      totalReps += reps;
      if (mostReps == null || reps > mostReps) mostReps = reps;
    }
    if (load != null && (heaviest == null || load > heaviest)) heaviest = load;
    volume += setVolume(s, exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm != null && load != null && (estimatedMax == null || orm > estimatedMax)) {
      estimatedMax = orm;
      bestSet = { load, reps, estimatedMax: orm };
    }
  }

  return { estimatedMax, bestSet, heaviest, volume, mostReps, totalReps, sets: sets.length };
}

export type ExerciseSession = {
  workoutId: string;
  /** YYYY-MM-DD. */
  workoutDate: string;
  summary: SessionSummary;
};

export type ExerciseRecord = { value: number; workoutId: string; workoutDate: string };

export type ExerciseRecords = {
  estimatedMax: (ExerciseRecord & { bestSet: BestSet }) | null;
  heaviest: ExerciseRecord | null;
  mostVolume: ExerciseRecord | null;
  mostRepsSet: ExerciseRecord | null;
  mostRepsSession: ExerciseRecord | null;
};

/**
 * The records across sessions, each remembering the workout it came from.
 * A tie goes to the earlier session, the one that set the record first.
 */
export function exerciseRecords(sessions: readonly ExerciseSession[]): ExerciseRecords {
  const byDate = [...sessions].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));
  const records: ExerciseRecords = {
    estimatedMax: null,
    heaviest: null,
    mostVolume: null,
    mostRepsSet: null,
    mostRepsSession: null,
  };
  for (const s of byDate) {
    const at = { workoutId: s.workoutId, workoutDate: s.workoutDate };
    const m = s.summary;
    if (m.estimatedMax != null && m.bestSet && (!records.estimatedMax || m.estimatedMax > records.estimatedMax.value)) {
      records.estimatedMax = { value: m.estimatedMax, bestSet: m.bestSet, ...at };
    }
    if (m.heaviest != null && (!records.heaviest || m.heaviest > records.heaviest.value)) {
      records.heaviest = { value: m.heaviest, ...at };
    }
    if (m.volume > 0 && (!records.mostVolume || m.volume > records.mostVolume.value)) {
      records.mostVolume = { value: m.volume, ...at };
    }
    if (m.mostReps != null && (!records.mostRepsSet || m.mostReps > records.mostRepsSet.value)) {
      records.mostRepsSet = { value: m.mostReps, ...at };
    }
    if (m.totalReps > 0 && (!records.mostRepsSession || m.totalReps > records.mostRepsSession.value)) {
      records.mostRepsSession = { value: m.totalReps, ...at };
    }
  }
  return records;
}

export type ProgressMetric = "estimatedMax" | "heaviest" | "volume" | "mostReps" | "totalReps";

/** The value a session contributes to a chart of the metric, or null when it has none. */
export function metricValue(summary: SessionSummary, metric: ProgressMetric): number | null {
  switch (metric) {
    case "estimatedMax":
      return summary.estimatedMax;
    case "heaviest":
      return summary.heaviest;
    case "volume":
      return summary.volume > 0 ? summary.volume : null;
    case "mostReps":
      return summary.mostReps;
    case "totalReps":
      return summary.totalReps > 0 ? summary.totalReps : null;
  }
}
