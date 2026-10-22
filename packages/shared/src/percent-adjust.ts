import { tidyWeight, type WeightUnit } from "./units";

/** The rounding step when the caller has no equipment step to give. */
export const PERCENT_FALLBACK_STEP = 2.5;

/**
 * What the keypad's percent box holds as the user types: a whole percent
 * from 1 to 99. Keeps the digits only, drops leading zeros (so "0" and
 * "00" are empty) and keeps the first two digits, so "100" reads 10.
 */
export function cleanPercent(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 2);
}

/**
 * The percent box and its sign pill as the fraction `percentWeight` takes:
 * − and "25" is −0.25. Null while the box is empty.
 */
export function signedPercent(sign: 1 | -1, digits: string): number | null {
  const n = Number(cleanPercent(digits));
  return n > 0 ? (sign * n) / 100 : null;
}

/**
 * The weight a percent works from: the box's value, else its placeholder,
 * the number the user can see, read as the box prints it. Null with no
 * value at all, or a value of 0, where any percent of it is 0.
 */
export function percentBase(current: number | null, placeholder: number | null, unit: WeightUnit): number | null {
  const base = tidyWeight(current ?? placeholder, unit);
  return base == null || base <= 0 ? null : base;
}

/**
 * A weight box after a percent change: its `percentBase` times (1 + pct),
 * rounded to the nearest `step` (the exercise's `keypadWeightStep`, the
 * smallest jump its equipment allows). Null when there is no base. Never
 * below 0.
 *
 * The result is written exactly as a typed weight is (`weight_value`, with
 * `stored` cleared), as `steppedWeight` is.
 */
export function percentWeight(
  current: number | null,
  placeholder: number | null,
  pct: number,
  unit: WeightUnit,
  step: number = PERCENT_FALLBACK_STEP,
): number | null {
  const base = percentBase(current, placeholder, unit);
  if (base == null) return null;
  const raw = base * (1 + pct);
  const rounded = step > 0 ? Math.round(raw / step) * step : raw;
  return Math.max(0, Math.round(rounded * 100) / 100);
}
