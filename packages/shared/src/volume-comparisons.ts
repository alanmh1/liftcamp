/**
 * Session volume as something a person can picture, for the share card.
 * From docs/volume-comparisons.md; edit the table there and here together.
 *
 * Weights are in pounds. The card picks the heaviest entry at or below the
 * session volume, so the line always reads as an achievement. Below the
 * lightest entry there is no comparison, and above the heaviest the truck
 * stays a truck: multiples stop being picturable, which is the point.
 *
 * Each object has four lines and the card shows one at random per view, so
 * a weight band does not say the same thing every time. The number above
 * reads "You lifted 18,140 lbs", and the line completes that sentence.
 */
export type VolumeComparison = {
  /** Pounds, rounded to something defensible rather than precise. */
  weightLb: number;
  /** Names the illustration file in the app, `assets/images/comparisons/<slug>.png`. */
  slug: string;
  /** For the weight line, "Elephant weighs about 12,000 lbs". */
  object: string;
  lines: readonly [string, string, string, string];
};

export const VOLUME_COMPARISONS: readonly VolumeComparison[] = [
  {
    weightLb: 400,
    slug: "upright-piano",
    object: "An upright piano",
    lines: [
      "An upright piano. Somebody has to move those.",
      "An upright piano. Stairs not included.",
      "An upright piano. Try getting that round a corner.",
      "An upright piano. Tuning is extra.",
    ],
  },
  {
    weightLb: 700,
    slug: "vending-machine",
    object: "A vending machine",
    lines: [
      "A full vending machine. Snacks and all.",
      "A vending machine. Still fully stocked.",
      "A vending machine. Nobody has shaken this one yet.",
      "A vending machine. Coins included.",
    ],
  },
  {
    weightLb: 1000,
    slug: "horse",
    object: "A horse",
    lines: [
      "A whole horse. Not a pony.",
      "A horse. The actual animal.",
      "A horse. It did not agree to this.",
      "A horse. Roughly one furlong of unimpressed.",
    ],
  },
  {
    weightLb: 1400,
    slug: "cow",
    object: "A dairy cow",
    lines: [
      "A dairy cow. She is not amused.",
      "A cow. A real, standing-there cow.",
      "A cow. Milk not included.",
      "A cow. All of it.",
    ],
  },
  {
    weightLb: 1800,
    slug: "smart-car",
    object: "A Smart car",
    lines: [
      "A Smart car. Parking spot not included.",
      "A Smart car. The little one.",
      "A Smart car. You could almost carry it.",
      "A Smart car. Barely counts as a car.",
    ],
  },
  {
    weightLb: 2400,
    slug: "grand-piano",
    object: "A grand piano",
    lines: [
      "A grand piano. Lid open and everything.",
      "A grand piano. Bench sold separately.",
      "A grand piano. Eighty-eight keys of it.",
      "A grand piano. Now find four friends.",
    ],
  },
  {
    weightLb: 3000,
    slug: "sedan",
    object: "A family sedan",
    lines: [
      "A family sedan. With the kids in it.",
      "A sedan. Four doors, full tank.",
      "A sedan. Groceries in the boot.",
      "A sedan. The whole thing, not just the engine.",
    ],
  },
  {
    weightLb: 4000,
    slug: "hippo",
    object: "A hippo",
    lines: [
      "A hippo. Do not try this in person.",
      "A hippo. They are heavier than they look.",
      "A hippo. Faster than you, too.",
      "A hippo. Mostly just sitting in a river.",
    ],
  },
  {
    weightLb: 5000,
    slug: "pickup-truck",
    object: "A pickup truck",
    lines: [
      "A pickup truck. Empty bed, mind you.",
      "A pickup. Before you load anything in.",
      "A pickup truck. Tailgate down.",
      "A pickup truck. Someone will ask to borrow it.",
    ],
  },
  {
    weightLb: 7000,
    slug: "rhino",
    object: "A rhino",
    lines: [
      "A rhino. Fully grown and unimpressed.",
      "A rhino. Horn and all.",
      "A rhino. Armour plating included.",
      "A rhino. Two tonnes of bad mood.",
    ],
  },
  {
    weightLb: 9000,
    slug: "delivery-van",
    object: "A delivery van",
    lines: [
      "A delivery van. Packages included.",
      "A delivery van. Fully loaded.",
      "A delivery van. Still three streets behind schedule.",
      "A delivery van. Doors closed, thankfully.",
    ],
  },
  {
    weightLb: 12000,
    slug: "elephant",
    object: "An elephant",
    lines: [
      "An elephant. The whole elephant.",
      "An elephant. Trunk to tail.",
      "An elephant. It will remember this.",
      "An elephant. Not the baby one.",
    ],
  },
  {
    weightLb: 18000,
    slug: "trex",
    object: "A T. rex",
    lines: [
      "A T. rex. Never skipped leg day.",
      "A T. rex. The little arms did not help.",
      "A T. rex. Sixty-six million years, still heavy.",
      "A T. rex. It could not have done this.",
    ],
  },
  {
    weightLb: 25000,
    slug: "school-bus",
    object: "A school bus",
    lines: [
      "A school bus. Empty, thankfully.",
      "A school bus. All forty seats of it.",
      "A school bus. Every single row.",
      "A school bus. Before anyone gets on.",
    ],
  },
  {
    weightLb: 35000,
    slug: "garbage-truck",
    object: "A garbage truck",
    lines: [
      "A garbage truck. On collection day.",
      "A garbage truck. Route finished.",
      "A garbage truck. Full load.",
      "A garbage truck. Nobody wants to spot that one.",
    ],
  },
  {
    weightLb: 50000,
    slug: "humpback-whale",
    object: "A humpback whale",
    lines: [
      "A humpback whale. In one session.",
      "A humpback whale. Fins and all.",
      "A humpback whale. Out of the water, somehow.",
      "A humpback whale. Twenty-five tonnes of it.",
    ],
  },
  {
    weightLb: 80000,
    slug: "semi-truck",
    object: "A loaded semi truck",
    lines: [
      "A loaded semi truck. Eighteen wheels of it.",
      "A semi truck. Trailer full.",
      "A semi truck. Cab, trailer, cargo, everything.",
      // United States: 80,000 lb is the federal limit without a permit. The
      // one line to revisit if the app ever localises.
      "A semi truck. Legally the heaviest thing on the road.",
    ],
  },
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

/** One of the entry's four lines. Called once per view, not per render. */
export function pickComparisonLine(entry: VolumeComparison): string {
  return entry.lines[Math.floor(Math.random() * entry.lines.length)] ?? entry.lines[0];
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
