import { formatDateLabel } from '@liftcamp/shared';

/**
 * "Wednesday, September 9 · 6:40 PM", from the local date, with the year
 * when it is not this year. US English whatever the device. The workout detail's date line, and the header of
 * the workout screen while it edits a finished workout.
 */
export function dateLine(workoutDate: string, createdAt: string): string {
  const day = formatDateLabel(workoutDate, { weekday: 'long', month: 'long' });
  const time = new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
