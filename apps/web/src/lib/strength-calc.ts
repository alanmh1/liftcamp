// The strength calculator's state and result, as pure functions of the URL's
// search params, so a shared link renders its result on the server and the
// rules are testable without a browser.
//
// Params: w (weight lifted), r (reps), bw (bodyweight), s (m or f),
// u (lb or kg, lb when absent), a (age, optional), and lift on the hub.

import {
  convertWeight,
  estimatedMaxKg,
  roundForDisplay,
  roundLoadUp,
  strengthBarPosition,
  strengthLevel,
  strengthThresholds,
  type StrengthLevelName,
  type StrengthSex,
  type WeightUnit,
} from "@liftcamp/shared";
import { STRENGTH_PAGES } from "./strength-pages";

export type StrengthSearch = {
  w?: number;
  r?: number;
  bw?: number;
  s?: "m" | "f";
  u?: WeightUnit;
  a?: number;
  /** Hub only: a lift page slug. */
  lift?: string;
};

function num(v: unknown): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads the params, dropping anything malformed. `u` is left out when it is
 *  lb, so a clean URL and `?u=lb` mean the same. */
export function validateStrengthSearch(search: Record<string, unknown>): StrengthSearch {
  const out: StrengthSearch = {};
  const w = num(search.w);
  const r = num(search.r);
  const bw = num(search.bw);
  const a = num(search.a);
  if (w !== undefined) out.w = w;
  if (r !== undefined) out.r = r;
  if (bw !== undefined) out.bw = bw;
  if (a !== undefined) out.a = a;
  if (search.s === "m" || search.s === "f") out.s = search.s;
  if (search.u === "kg") out.u = "kg";
  if (typeof search.lift === "string" && search.lift in STRENGTH_PAGES) out.lift = search.lift;
  return out;
}

export function unitOf(search: StrengthSearch): WeightUnit {
  return search.u === "kg" ? "kg" : "lb";
}

export function sexOf(search: StrengthSearch): StrengthSex | null {
  return search.s === "m" ? "male" : search.s === "f" ? "female" : null;
}

/** The same lifter in the other unit: weight and bodyweight convert, to 0.1. */
export function withUnit(search: StrengthSearch, unit: WeightUnit): StrengthSearch {
  const from = unitOf(search);
  const next: StrengthSearch = { ...search };
  if (unit === "kg") next.u = "kg";
  else delete next.u;
  if (from === unit) return next;
  const conv = (v: number | undefined) =>
    v === undefined ? undefined : roundForDisplay(convertWeight(v, from, unit), unit);
  if (search.w !== undefined) next.w = conv(search.w);
  if (search.bw !== undefined) next.bw = conv(search.bw);
  return next;
}

export const BODYWEIGHT_RANGE: Record<WeightUnit, readonly [number, number]> = {
  lb: [70, 500],
  kg: [30, 230],
};

export type FieldErrors = { w?: string; r?: string; bw?: string; a?: string };

export type StrengthResult = {
  level: StrengthLevelName;
  /** "Estimated max 167 lb", or "Max 185 lb" for a single. */
  maxLine: string;
  /** 0 to 1, where the marker sits on the five-segment bar. */
  position: number;
  /** "15 lb to Intermediate", or "Top level" at Elite. */
  nextLine: string;
};

export type StrengthOutcome = { errors: FieldErrors; result: StrengthResult | null };

/** A load for display: whole lb, or the nearest 0.5 kg. */
export function formatLoad(value: number, unit: WeightUnit): string {
  const v = unit === "kg" ? Math.round(value * 2) / 2 : Math.round(value);
  return `${v} ${unit}`;
}

/**
 * Field errors for whatever is filled in, and a result once weight, reps,
 * bodyweight and sex are all filled in and valid.
 */
export function strengthOutcome(exerciseId: string, search: StrengthSearch): StrengthOutcome {
  const unit = unitOf(search);
  const sex = sexOf(search);
  const errors: FieldErrors = {};
  const { w, r, bw, a } = search;

  if (w !== undefined && !(w > 0)) errors.w = "Put in a weight above 0.";
  if (r !== undefined) {
    if (r > 12) errors.r = "Use a set of 12 reps or fewer for a good estimate.";
    else if (r < 1 || !Number.isInteger(r)) errors.r = "Reps are a whole number from 1 to 12.";
  }
  const [lo, hi] = BODYWEIGHT_RANGE[unit];
  if (bw !== undefined && !(bw >= lo && bw <= hi))
    errors.bw = `Put in a bodyweight from ${lo} to ${hi} ${unit}.`;
  if (a !== undefined && !(Number.isInteger(a) && a >= 10 && a <= 100))
    errors.a = "Put in an age from 10 to 100, or leave it empty.";

  const filled = w !== undefined && r !== undefined && bw !== undefined && sex !== null;
  if (!filled || Object.keys(errors).length > 0) return { errors, result: null };

  const maxKg = estimatedMaxKg(convertWeight(w, unit, "kg"), r);
  const thresholds = strengthThresholds(exerciseId, sex, convertWeight(bw, unit, "kg"), a ?? null);
  if (maxKg == null || !thresholds) return { errors, result: null };

  const level = strengthLevel(maxKg, thresholds);
  const maxLine =
    r === 1
      ? `Max ${formatLoad(w, unit)}`
      : `Estimated max ${formatLoad(convertWeight(maxKg, "kg", unit), unit)}`;
  const nextLine =
    level.next && level.toNext != null
      ? `${roundLoadUp(convertWeight(level.toNext, "kg", unit), unit)} ${unit} to ${level.next}`
      : "Top level";
  return {
    errors,
    result: {
      level: level.level,
      maxLine,
      position: strengthBarPosition(maxKg, thresholds),
      nextLine,
    },
  };
}
