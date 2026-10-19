import { numericWeight } from "./set-weight";

/**
 * The two units a weight can be stored in. `user_profiles.weight_unit` and
 * `sets.weight_unit` both hold one of these behind a CHECK constraint.
 */
export type WeightUnit = "lb" | "kg";

/** Exact by definition of the international pound. */
export const KG_PER_LB = 0.45359237;

/** `kg` stays kg; `lb`, null and anything unexpected read as lb. */
export function asWeightUnit(stored: string | null | undefined): WeightUnit {
  return stored === "kg" ? "kg" : "lb";
}

/** Converts a weight. Signed values (assist) convert like any other. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "lb" ? value * KG_PER_LB : value / KG_PER_LB;
}

/**
 * Rounds to 0.1 for printing. Only where a number is shown or typed into a
 * field, never before math: 1RM, volume and PR comparisons keep full
 * precision so a unit round trip returns the original number.
 */
export function roundForDisplay(value: number, _unit: WeightUnit): number {
  return Math.round(value * 10) / 10;
}

/** A `sets` row as read, carrying the unit it was logged in. */
export type SetWithUnit = {
  weight?: string | null;
  weight_value: number | null;
  weight_unit?: string | null;
};

/**
 * One set read from the database, expressed in the user's current unit.
 * Every set read in the mobile data layer passes through here, so PR,
 * 1RM, volume and chart code downstream all see one unit.
 *
 * A legacy set with only the free-text `weight` keeps it as text when the
 * units match, so its display is unchanged. When they differ, the parsed
 * number is converted into `weight_value`; otherwise "225" logged in lb
 * would be read as 225 kg by every fallback to the text column.
 */
export function toUserUnit<T extends SetWithUnit>(set: T, unit: WeightUnit): T {
  const from = asWeightUnit(set.weight_unit);
  if (from === unit) return set;
  if (set.weight_value != null) {
    return { ...set, weight_value: convertWeight(set.weight_value, from, unit) };
  }
  const legacy = numericWeight({ weight: set.weight ?? null, weight_value: null });
  if (legacy == null) return set;
  return { ...set, weight_value: convertWeight(legacy, from, unit) };
}

/**
 * A weight as the user sees it. A converted weight has a long fraction and
 * is rounded to 0.1, so 225 lb shows as 102.1 kg. A weight with two decimals
 * or fewer was typed or stepped by the user and is kept as is, so 26.25
 * still reads 26.25.
 *
 * For printing and input fields. Never before math, and never written.
 */
export function tidyWeight(value: number | null, unit: WeightUnit): number | null {
  if (value == null) return null;
  const hundredths = value * 100;
  // Snapped to the hundredth, so float noise from a sum (68.1 + 0.1 is
  // 68.19999999999999) prints as 68.2.
  if (Math.abs(hundredths - Math.round(hundredths)) < 1e-6) return Math.round(hundredths) / 100;
  return roundForDisplay(value, unit);
}

/** A weight exactly as a `sets` row holds it. */
export type StoredWeight = { weight_value: number; weight_unit: WeightUnit };

/**
 * The stored weight behind a converted one, or null when the set is already
 * in the user's unit. A set in memory keeps this so a weight the user never
 * touched can be copied or restored exactly, rather than as its rounded
 * conversion.
 */
export function storedWeightOf(
  value: number | null,
  storedUnit: string | null | undefined,
  unit: WeightUnit,
): StoredWeight | null {
  const from = asWeightUnit(storedUnit);
  return value == null || from === unit ? null : { weight_value: value, weight_unit: from };
}

/**
 * What a write sends for a set's weight. A carried weight the user has not
 * edited (prior session autofill, Add set, undo) keeps its source's stored
 * value and unit: a seed from 225 lb is written as 225 lb and shows as
 * 102.1 kg, so completing it unchanged ties its source instead of beating
 * it by the rounding. An edited weight is the typed value in `unit`.
 */
export function weightToWrite(
  value: number | null,
  stored: StoredWeight | null | undefined,
  unit: WeightUnit,
): { weight_value: number | null; weight_unit: WeightUnit } {
  return stored ?? { weight_value: value, weight_unit: unit };
}
