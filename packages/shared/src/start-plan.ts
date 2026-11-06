// Starting a workout on the phone with nothing read from the server, and
// folding the server's read into it once it lands.

/**
 * How many empty sets an exercise starts with: the routine's target when it
 * sets one, else `count` (the prior session's, or the repeated workout's),
 * else the cold-start suggestion.
 */
export function startSetCount(targetSets: number | null | undefined, count: number | null | undefined, coldStartSets: number): number {
  if (targetSets != null && targetSets > 0) return targetSets;
  if (count != null && count > 0) return count;
  return coldStartSets;
}

/** What a workout exercise holds that only the server read can fill in. */
export type ServerDetailExercise = {
  id: string;
  exercise: { id: string };
  prior: unknown[];
  /** The finished sessions progression reads. Missing on copies saved before it existed. */
  history?: unknown[];
  priorBestOrm: number | null;
  finishedSessions: number;
  target: unknown | null;
};

/**
 * The phone's workout with what only the server read knows filled in:
 * each exercise's prior session and history, PR baseline, session count and full
 * exercise fields, and the bodyweight. Sets, order, and which exercises
 * are in the workout stay as the phone has them, since the user may have
 * changed them while the read was out. An exercise swapped on the phone
 * keeps its own details: the server's are for the exercise it replaced.
 */
export function withServerDetails<E extends ServerDetailExercise, W extends { exercises: E[]; bodyweight: number | null }>(
  local: W,
  server: W,
): W {
  const byId = new Map(server.exercises.map((we) => [we.id, we]));
  return {
    ...local,
    bodyweight: server.bodyweight,
    exercises: local.exercises.map((we) => {
      const s = byId.get(we.id);
      if (!s) return we;
      const same = s.exercise.id === we.exercise.id;
      return {
        ...we,
        exercise: same ? s.exercise : we.exercise,
        prior: same ? s.prior : we.prior,
        history: same ? s.history : we.history,
        priorBestOrm: same ? s.priorBestOrm : we.priorBestOrm,
        finishedSessions: same ? s.finishedSessions : we.finishedSessions,
        target: we.target ?? s.target,
      };
    }),
  };
}

/**
 * A card after Replace: the new exercise, its rows untouched, and nothing
 * left of the old exercise's past: no last session, no PR baseline, no
 * session count. Previous, the placeholders and the PR badges wait for
 * `withPriorRead`, or stay empty with no signal.
 */
export function withReplacedExercise<
  X,
  E extends { exercise: X; prior: unknown[]; history?: unknown[]; priorBestOrm: number | null; finishedSessions: number },
>(we: E, exercise: X): E {
  return { ...we, exercise, prior: [], history: [], priorBestOrm: null, finishedSessions: 0 };
}

/**
 * The reads for a replaced exercise, put on its card. Only while the card
 * still holds that exercise: a second Replace before they land makes them
 * the wrong exercise's.
 */
export function withPriorRead<
  E extends {
    id: string;
    exercise: { id: string };
    prior: unknown[];
    history?: unknown[];
    priorBestOrm: number | null;
    finishedSessions: number;
  },
>(
  exercises: E[],
  workoutExerciseId: string,
  exerciseId: string,
  read: Pick<E, "prior" | "history" | "priorBestOrm" | "finishedSessions">,
): E[] {
  return exercises.map((we) =>
    we.id === workoutExerciseId && we.exercise.id === exerciseId
      ? {
          ...we,
          prior: read.prior,
          history: read.history,
          priorBestOrm: read.priorBestOrm,
          finishedSessions: read.finishedSessions,
        }
      : we,
  );
}
