/**
 * A workout's length as "47 min" or "1 h 05 min".
 *
 * Workouts have no duration column; every surface that shows one subtracts
 * `created_at` from `finished_at`. Floors at one minute, so a workout
 * finished inside sixty seconds reads "1 min" rather than "0 min".
 */
export function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}
