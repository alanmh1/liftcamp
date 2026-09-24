/**
 * Birthdays are stored as a Postgres `date`, which arrives as YYYY-MM-DD.
 * These convert to and from a local-time Date without passing through UTC,
 * which would shift the day for anyone west of Greenwich.
 */

/** Youngest allowed age, and the earliest selectable birthday. */
export const MIN_AGE = 13;
export const EARLIEST_BIRTHDAY = "1920-01-01";

export function isoFromLocalDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Local midnight on that date, or null when the string is not YYYY-MM-DD. */
export function localDateFromIso(iso: string | null | undefined): Date | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "Nov 10, 1983". */
export function formatBirthday(iso: string | null | undefined): string | null {
  const d = localDateFromIso(iso);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
}

/** The latest selectable birthday: today, MIN_AGE years ago. */
export function latestBirthday(now = new Date()): Date {
  return new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
}

/** Where the picker opens with nothing saved: Jan 1, thirty years back. */
export function defaultBirthday(now = new Date()): Date {
  return new Date(now.getFullYear() - 30, 0, 1);
}
