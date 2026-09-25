import { Dumbbell, Cable, Cog, User, Weight, Circle, type LucideIcon } from "lucide-react";
import { Barbell, EZBar } from "@/components/icons/EquipmentIcons";
import { canonMuscle, equipmentIconKind, type EquipmentIconKind } from "@liftcamp/shared";

/** Lucide icons and the two hand-drawn equipment icons share this shape, so
 *  callers can render whatever equipmentIcon() returns without a type guard. */
export type EquipmentIconComponent =
  | LucideIcon
  | typeof Barbell
  | typeof EZBar;

const MUSCLE_COLORS: Record<string, { bg: string; fg: string }> = {
  // CHALK palette. Grouped by region so the family reads at a glance:
  // push = coral, pull = teal, arms = violet, legs = green, core = gold.
  //
  // The pull family is deliberately TEAL rather than plate blue. Plate blue is
  // the app's single action colour (buttons, nav, links, focus rings); reusing
  // it as a muscle category made "blue" mean two unrelated things on the same
  // screen. Shifting pull toward teal keeps the chips categorical.
  //
  // Every pair verified at >= 4.5:1 contrast.
  // Keyed by CANONICAL muscle only; canonMuscle() resolves synonyms first.
  chest:         { bg: "#F7DED6", fg: "#8A3520" },
  shoulders:     { bg: "#F9E4CB", fg: "#8A5410" },
  traps:         { bg: "#F5E2CE", fg: "#7E4E12" },
  lats:          { bg: "#D3E7E8", fg: "#1B5157" },
  "upper back":  { bg: "#D3E7E8", fg: "#1B5157" },
  "lower back":  { bg: "#CADFE1", fg: "#17474D" },

  biceps:        { bg: "#E2DEF3", fg: "#43357F" },
  triceps:       { bg: "#E7DFF2", fg: "#4B357C" },
  forearms:      { bg: "#E4E1F0", fg: "#3F3874" },
  quads:         { bg: "#D9E9D6", fg: "#265C2C" },
  hamstrings:    { bg: "#D3E7DC", fg: "#1E5940" },
  glutes:        { bg: "#F3DCE4", fg: "#7C2B47" },
  calves:        { bg: "#D5E8E2", fg: "#1C554A" },
  adductors:     { bg: "#DCE7DE", fg: "#2B5734" },
  abductors:     { bg: "#DCE7DE", fg: "#2B5734" },
  abs:           { bg: "#F6E7C4", fg: "#6E4A0C" },
  neck:          { bg: "#E5E2DC", fg: "#4A443B" },
};

const FALLBACK = { bg: "#EDE8E0", fg: "#4A443B" };

export function muscleColors(muscle: string | null | undefined) {
  if (!muscle) return FALLBACK;
  return MUSCLE_COLORS[canonMuscle(muscle)] ?? FALLBACK;
}

/** The glyph for an equipment value. The choice lives in @liftcamp/shared so
 *  mobile picks the same one; this only maps the kind to a component. */
export function equipmentIcon(equipment: string | null | undefined): EquipmentIconComponent {
  return EQUIPMENT_ICONS[equipmentIconKind(equipment)];
}

const EQUIPMENT_ICONS: Record<EquipmentIconKind, EquipmentIconComponent> = {
  smith: Cog,
  ezbar: EZBar,
  dumbbell: Dumbbell,
  barbell: Barbell,
  kettlebell: Weight,
  cable: Cable,
  machine: Cog,
  body: User,
  // Bands borrow the cable glyph the way smith borrows the cog: a band is
  // a stretched line with something at each end, and the circle-dot it had
  // read as a target. Its own kind stays so a dedicated glyph can land later.
  band: Cable,
  other: Circle,
};
