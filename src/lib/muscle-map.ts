import type { Muscle } from "react-body-highlighter";

const LOOKUP: Record<string, Muscle[]> = {
  abdominals: ["abs"],
  abductors: ["abductors"],
  adductors: ["adductor"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  forearms: ["forearm"],
  glutes: ["gluteal"],
  hamstrings: ["hamstring"],
  lats: ["upper-back"],
  "lower back": ["lower-back"],
  "middle back": ["upper-back"],
  neck: ["neck"],
  quadriceps: ["quadriceps"],
  shoulders: ["front-deltoids", "back-deltoids"],
  traps: ["trapezius"],
  triceps: ["triceps"],
};

export function muscleNamesToSlugs(raw: string | null | undefined): Muscle[] {
  if (!raw) return [];
  const out: Muscle[] = [];
  for (const part of raw.split("|")) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    const slugs = LOOKUP[key];
    if (slugs) out.push(...slugs);
  }
  return out;
}
