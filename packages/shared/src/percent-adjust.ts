import { tidyWeight, type WeightUnit } from "./units";

/** The keypad tray's percent chips, left to right, as fractions. */
export const PERCENT_STEPS = [-0.3, -0.25, -0.2] as const;

/** The rounding step when the caller has no equipment step to give. */
export const PERCENT_FALLBACK_STEP = 2.5;

/**
 * A weight box after a percent chip: its value times (1 + pct), rounded to
 * the nearest `step` (the exercise's `keypadWeightStep`, the smallest jump
 * its equipment allows). An empty box works from its placeholder, the
 * number the user can see, read as the box prints it. Null with no value
 * at all, or a value of 0, where every chip would read 0: the chips show
 * disabled then. Never below 0.
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
  const base = tidyWeight(current ?? placeholder, unit);
  if (base == null || base <= 0) return null;
  const raw = base * (1 + pct);
  const rounded = step > 0 ? Math.round(raw / step) * step : raw;
  return Math.max(0, Math.round(rounded * 100) / 100);
}
