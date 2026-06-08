export type WeightType = "standard" | "bodyweight";

export type BwMode = "assist" | "body" | "added";

export function bwModeFromValue(v: number | null | undefined): BwMode {
  if (v == null) return "body";
  if (v < 0) return "assist";
  if (v > 0) return "added";
  return "body";
}

export function signedFromBw(mode: BwMode, magnitude: number): number {
  if (mode === "body") return 0;
  const m = Math.abs(magnitude);
  return mode === "assist" ? -m : m;
}

export type SetForDisplay = {
  weight: string | null;
  weight_value: number | null;
  reps?: number | null;
};

export function formatSetWeight(
  set: SetForDisplay,
  weightType: string | null | undefined,
  unit: string,
): string {
  const v = set.weight_value;
  if (v == null) return set.weight?.trim() || "—";
  if (weightType === "bodyweight") {
    if (v === 0) return "Bodyweight";
    if (v < 0) return `BW − ${Math.abs(v)} ${unit} assist`;
    return `BW + ${v} ${unit}`;
  }
  return `${v} ${unit}`;
}

// Numeric magnitude useful for 1RM-style comparisons.
// Returns null when the set has no usable weight signal.
export function numericWeight(set: SetForDisplay): number | null {
  if (set.weight_value != null) return set.weight_value;
  const m = (set.weight ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}
