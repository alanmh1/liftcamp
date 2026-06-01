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

const MUSCLE_COLORS: Record<string, { bg: string; fg: string }> = {
  chest:       { bg: "#fde2e4", fg: "#7a1f2b" },
  back:        { bg: "#dbeafe", fg: "#1e3a5f" },
  lats:        { bg: "#dbeafe", fg: "#1e3a5f" },
  "middle back":{ bg: "#dbeafe", fg: "#1e3a5f" },
  "lower back":{ bg: "#cfdbf0", fg: "#1e3a5f" },
  shoulders:   { bg: "#fef3c7", fg: "#7a4e0b" },
  traps:       { bg: "#fde7c7", fg: "#7a440b" },
  biceps:      { bg: "#e0e7ff", fg: "#312e81" },
  triceps:     { bg: "#ede9fe", fg: "#4c1d95" },
  forearms:    { bg: "#eef2ff", fg: "#3730a3" },
  quadriceps:  { bg: "#dcfce7", fg: "#14532d" },
  quads:       { bg: "#dcfce7", fg: "#14532d" },
  hamstrings:  { bg: "#d1fae5", fg: "#064e3b" },
  glutes:      { bg: "#fce7f3", fg: "#831843" },
  calves:      { bg: "#ccfbf1", fg: "#134e4a" },
  abdominals:  { bg: "#fef9c3", fg: "#713f12" },
  abs:         { bg: "#fef9c3", fg: "#713f12" },
  core:        { bg: "#fef9c3", fg: "#713f12" },
  neck:        { bg: "#e5e7eb", fg: "#374151" },
};

const FALLBACK = { bg: "#e5e7eb", fg: "#374151" };

export function muscleColors(muscle: string | null | undefined) {
  if (!muscle) return FALLBACK;
  return MUSCLE_COLORS[muscle.toLowerCase().trim()] ?? FALLBACK;
}

export function equipmentIcon(equipment: string | null | undefined): LucideIcon {
  if (!equipment) return Circle;
  const k = equipment.toLowerCase();
  if (k.includes("dumbbell")) return Dumbbell;
  if (k.includes("barbell")) return Dumbbell;
  if (k.includes("kettlebell")) return Weight;
  if (k.includes("cable")) return Cable;
  if (k.includes("machine")) return Cog;
  if (k.includes("body")) return User;
  if (k.includes("band")) return CircleDot;
  return Circle;
}
