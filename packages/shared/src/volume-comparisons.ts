/**
 * Session volume as something a person can picture, for the share card.
 * From docs/volume-comparisons.md; edit the table there and here together.
 *
 * Weights are in pounds. The card picks the heaviest entry at or below the
 * session volume, so the line always reads as an achievement. Below the
 * lightest entry there is no comparison, and above the heaviest the truck
 * stays a truck: multiples stop being picturable, which is the point.
 */
export type VolumeComparison = {
  /** Pounds, rounded to something defensible rather than precise. */
  weightLb: number;
  object: string;
  line: string;
};

export const VOLUME_COMPARISONS: readonly VolumeComparison[] = [
  { weightLb: 400, object: "Upright piano", line: "That is an upright piano." },
  { weightLb: 700, object: "Vending machine", line: "That is a full vending machine." },
  { weightLb: 1000, object: "Horse", line: "That is a horse." },
  { weightLb: 1400, object: "Dairy cow", line: "That is a dairy cow." },
  { weightLb: 1800, object: "Smart car", line: "That is a Smart car." },
  {
    weightLb: 2400,
    object: "Grand piano and the people moving it",
    line: "That is a grand piano and the crew moving it.",
  },
  { weightLb: 3000, object: "Family sedan", line: "That is a family sedan." },
  { weightLb: 4000, object: "Hippo", line: "That is a hippo." },
  { weightLb: 5000, object: "Pickup truck", line: "That is a pickup truck." },
  { weightLb: 7000, object: "Rhino", line: "That is a rhino." },
  { weightLb: 9000, object: "Delivery van", line: "That is a delivery van." },
  { weightLb: 12000, object: "Elephant", line: "That is an elephant." },
  { weightLb: 18000, object: "Tyrannosaurus rex", line: "That is a T. rex." },
  { weightLb: 25000, object: "School bus", line: "That is a school bus." },
  { weightLb: 35000, object: "Garbage truck", line: "That is a garbage truck." },
  { weightLb: 50000, object: "Humpback whale", line: "That is a humpback whale." },
  { weightLb: 80000, object: "Loaded semi truck", line: "That is a loaded semi truck." },
];

export const LB_PER_KG = 2.20462;

/** The heaviest entry at or below the volume, or null under the lightest. */
export function pickVolumeComparison(volumeLb: number): VolumeComparison | null {
  let best: VolumeComparison | null = null;
  for (const entry of VOLUME_COMPARISONS) {
    if (entry.weightLb <= volumeLb) best = entry;
    else break;
  }
  return best;
}

/**
 * An entry's weight in the user's unit, rounded so a converted figure does
 * not show the object at a suspiciously precise weight.
 */
export function comparisonWeightIn(entry: VolumeComparison, unit: "lb" | "kg"): number {
  if (unit === "lb") return entry.weightLb;
  const kg = entry.weightLb / LB_PER_KG;
  const step = kg >= 1000 ? 100 : 10;
  return Math.round(kg / step) * step;
}
