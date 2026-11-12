/**
 * Admin reports return calendar days as 'YYYY-MM-DD' strings. `new Date()` reads
 * that form as UTC midnight, which in Pacific time is the evening before, so
 * every chart bar and label landed one day early. Parse the parts instead and
 * build the local midnight of that day.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of a 'YYYY-MM-DD' day. */
export function parseDay(s: string): Date {
  const m = DAY_RE.exec(s);
  if (!m) throw new Error(`Not a YYYY-MM-DD day: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * A Date for either a bare 'YYYY-MM-DD' day (local midnight) or a full
 * timestamp (parsed as given). Admin columns mix the two.
 */
export function toAdminDate(v: string): Date {
  return DAY_RE.test(v) ? parseDay(v) : new Date(v);
}
