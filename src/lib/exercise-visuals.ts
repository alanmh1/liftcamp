import {
  Dumbbell,
  Cable,
  Cog,
  User,
  Weight,
  CircleDot,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { canonMuscle } from "@/lib/muscle-vocab";

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

export function formatEquipmentLabel(eq: string | null | undefined): string {
  if (!eq) return "";
  return eq
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function equipmentIcon(equipment: string | null | undefined): LucideIcon {
  if (!equipment) return Circle;
  const k = equipment.toLowerCase();
  // "smith" is checked before "dumbbell"/"barbell" because a Smith machine is a
  // fixed-path machine, not a free weight — it should read as machine even though
  // the bar looks like a barbell.
  if (k.includes("smith")) return Cog;
  if (k.includes("dumbbell")) return Dumbbell;
  if (k.includes("barbell")) return Dumbbell;
  if (k.includes("kettlebell")) return Weight;
  if (k.includes("cable")) return Cable;
  if (k.includes("machine")) return Cog;
  if (k.includes("body")) return User;
  if (k.includes("band")) return CircleDot;
  return Circle;
}
