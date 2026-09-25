import { isoFromLocalDate, localDateFromIso } from "./birthday";

/**
 * Pure helpers for the Profile tab: the weekly training-days chart, the
 * abbreviated volume total, and a bar-chart axis with round ticks.
 */

/** Local midnight on the Monday of the week holding `d`. Weeks start on Monday, as on Home. */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export type WeekDays = {
  /** The week's Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Distinct days in the week with a finished workout. */
  days: number;
};

/**
 * The last `weeks` weeks, oldest first and ending with the week holding
 * `today`, each with its count of distinct training days. Days, not
 * workouts, so it agrees with Home's "N of target": two workouts on one
 * Tuesday are one day. Dates outside the window are ignored.
 */
export function trainingDaysByWeek(dates: readonly string[], weeks: number, today = new Date()): WeekDays[] {
  const current = mondayOf(today);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    starts.push(isoFromLocalDate(d));
  }
  const index = new Map(starts.map((s, i) => [s, i]));
  const days = starts.map(() => new Set<string>());
  for (const date of dates) {
    const local = localDateFromIso(date);
    if (!local) continue;
    const i = index.get(isoFromLocalDate(mondayOf(local)));
    if (i != null) days[i].add(date);
  }
  return starts.map((weekStart, i) => ({ weekStart, days: days[i].size }));
}

const TIERS = [
  { size: 1e3, suffix: "k" },
  { size: 1e6, suffix: "M" },
  { size: 1e9, suffix: "B" },
];

/**
 * A whole number under 1,000 as is, then 1.5k, 214k, 1.2M. One decimal
 * below 10 of a tier, none above. A value that would round up to 1000 of
 * a tier moves to the next one, so 999,600 is 1M, never 1000k.
 */
export function compactNumber(n: number): string {
  const v = Math.round(Math.max(0, n));
  if (v < 1000) return String(v);
  for (let i = 0; i < TIERS.length; i += 1) {
    const x = v / TIERS[i].size;
    const r = x < 9.95 ? Math.round(x * 10) / 10 : Math.round(x);
    if (r < 1000 || i === TIERS.length - 1) return `${r}${TIERS[i].suffix}`;
  }
  return String(v);
}

/**
 * The smallest of 1, 2, 2.5 or 5 times a power of ten that is at least `x`.
 * With `integer`, a step of 2.5 becomes 2 (one more interval) and nothing
 * goes below 1.
 */
function niceStep(x: number, integer: boolean): number {
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const f = x / base;
  const mantissa = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? (integer && base === 1 ? 2 : 2.5) : f <= 5 ? 5 : 10;
  const step = mantissa * base;
  return integer ? Math.max(1, Math.round(step)) : step;
}

/**
 * A zero-based axis for bars: a top at or just above `max` and evenly
 * spaced round ticks from zero up to it, ascending. About three intervals.
 * With `integer`, every tick is a whole number, so a count of days never
 * gets a 1.5 gridline.
 */
export function barAxis(max: number, integer = false): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const step = niceStep(max / 3, integer);
  const count = Math.ceil(max / step - 1e-9);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) ticks.push(Number((i * step).toPrecision(12)));
  return { top: ticks[ticks.length - 1], ticks };
}
