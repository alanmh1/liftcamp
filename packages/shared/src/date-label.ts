// One formatter for every workout or set date the apps show. US English
// whatever the device, built from fixed name tables so a test reads the
// same on any machine. The year is added only when the date's year is not
// the current one: "Fri, Dec 6, 2024", but "Fri, Nov 20" this year.

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type DateLabelOptions = {
  /** "Fri" or "Friday" in front. Left out by default. */
  weekday?: "short" | "long";
  /** "Dec" (the default) or "December". */
  month?: "short" | "long";
  /**
   * Whose year counts as current: a Date (its year) or a year number.
   * Today by default. Pass a fixed one in tests.
   */
  now?: Date | number;
};

/**
 * A YYYY-MM-DD (or anything starting with one, such as an ISO timestamp's
 * first ten characters) as a local calendar date. "Dec 6", "Fri, Dec 6",
 * "Friday, December 6", each with ", 2024" when 2024 is not this year.
 * An unreadable string comes back as given.
 */
export function formatDateLabel(iso: string, options: DateLabelOptions = {}): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const { weekday, month = "short", now = new Date() } = options;
  const thisYear = typeof now === "number" ? now : now.getFullYear();
  const monthName = (month === "long" ? MONTHS_LONG : MONTHS_SHORT)[date.getMonth()];
  let out = `${monthName} ${date.getDate()}`;
  if (weekday) out = `${(weekday === "long" ? WEEKDAYS_LONG : WEEKDAYS_SHORT)[date.getDay()]}, ${out}`;
  if (date.getFullYear() !== thisYear) out += `, ${date.getFullYear()}`;
  return out;
}
