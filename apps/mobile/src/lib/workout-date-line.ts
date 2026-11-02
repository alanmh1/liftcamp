/**
 * "Wednesday, September 9 · 6:40 PM", from the local date. US English
 * whatever the device. The workout detail's date line, and the header of
 * the workout screen while it edits a finished workout.
 */
export function dateLine(workoutDate: string, createdAt: string): string {
  // Local midnight, not `new Date(iso)`, which parses as UTC.
  const d = new Date(`${workoutDate}T00:00:00`);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
