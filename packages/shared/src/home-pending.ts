// Home as the server last answered, with what is still only on the phone
// laid over it: a workout finished or discarded here and not yet synced,
// and one started here that the server does not have yet.

/** What the phone knows that the server may not yet. */
export type LocalHomeState<P, L> = {
  /** Workouts finished or discarded on the phone whose writes have not all synced. */
  endedIds: string[];
  /** Workouts finished on the phone, not yet synced, with their local dates. */
  finished: { id: string; date: string }[];
  /** The newest workout in progress that only the phone has in full. */
  unfinished: P | null;
  /** The newest workout finished on the phone and not yet synced, as Home's Last workout card shows it. */
  lastFinished: L | null;
};

export const EMPTY_LOCAL_HOME: LocalHomeState<never, never> = {
  endedIds: [],
  finished: [],
  unfinished: null,
  lastFinished: null,
};

type HomeParts<P, L> = {
  inProgress?: P | null;
  streakDates?: string[];
  finishedCount?: number;
  last?: L | null;
};

/**
 * Home's data with the phone's state over it. A part still loading
 * (undefined) stays undefined, so the screen's skeletons behave as before.
 *
 * - The Resume card drops a workout ended on the phone, and shows one only
 *   the phone has when the server shows none (or an older one).
 * - The week card and the workout count include finishes not yet synced.
 * - The Last workout card shows a finish not yet synced when it is newer.
 */
export function mergeHomePending<
  P extends { id: string; createdAt: string },
  L extends { finishedAt: string },
  D extends HomeParts<P, L>,
>(data: D, local: LocalHomeState<P, L>): D {
  const out: D = { ...data };

  if (data.inProgress !== undefined) {
    const server = data.inProgress && !local.endedIds.includes(data.inProgress.id) ? data.inProgress : null;
    const phone = local.unfinished && !local.endedIds.includes(local.unfinished.id) ? local.unfinished : null;
    out.inProgress = !phone ? server : !server || phone.createdAt > server.createdAt ? phone : server;
  }

  // Server answers already exclude these: they are not finished there yet.
  if (data.streakDates !== undefined) out.streakDates = [...data.streakDates, ...local.finished.map((f) => f.date)];
  if (data.finishedCount !== undefined) out.finishedCount = data.finishedCount + local.finished.length;

  if (data.last !== undefined && local.lastFinished && (!data.last || local.lastFinished.finishedAt > data.last.finishedAt)) {
    out.last = local.lastFinished;
  }
  return out;
}
