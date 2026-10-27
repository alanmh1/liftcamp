/** The latest of some ISO timestamps, as YYYY-MM-DD in UTC. Nulls are
 *  skipped; at least one value must be set. */
export function latestDay(...isos: (string | null | undefined)[]): string {
  const days = isos
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).toISOString().slice(0, 10));
  return days.sort().at(-1)!;
}

/** "October 19, 2026" from YYYY-MM-DD, the format of the guide byline. */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
