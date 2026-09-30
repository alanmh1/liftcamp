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
  priorBestOrm: number | null;
  finishedSessions: number;
  target: unknown | null;
};

/**
 * The phone's workout with what only the server read knows filled in:
 * each exercise's prior session, PR baseline, session count and full
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
        priorBestOrm: same ? s.priorBestOrm : we.priorBestOrm,
        finishedSessions: same ? s.finishedSessions : we.finishedSessions,
        target: we.target ?? s.target,
      };
    }),
  };
}
