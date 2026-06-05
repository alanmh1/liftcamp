import type { Muscle } from "react-body-highlighter";

const LOOKUP: Record<string, Muscle[]> = {
  abdominals: ["abs"],
  abs: ["abs"],
  abductors: ["abductors"],
  adductors: ["adductor"],
  back: ["upper-back"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  core: ["abs"],
  forearms: ["forearm"],
  glutes: ["gluteal"],
  hamstrings: ["hamstring"],
  lats: ["upper-back"],
  "lower back": ["lower-back"],
  "middle back": ["upper-back"],
  neck: ["neck"],
  quadriceps: ["quadriceps"],
  quads: ["quadriceps"],
  shoulders: ["front-deltoids", "back-deltoids"],
  traps: ["trapezius"],
  triceps: ["triceps"],
};

const VALID_SLUGS = new Set([
  "abs","abductors","adductor","biceps","calves","chest","forearm",
  "gluteal","hamstring","upper-back","lower-back","neck","quadriceps",
  "front-deltoids","back-deltoids","trapezius","triceps"
]);

export function muscleNamesToSlugs(raw: string | null | undefined): Muscle[] {
  if (!raw) return [];
  const out: Muscle[] = [];
  for (const part of raw.split("|")) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    const slugs = LOOKUP[key];
    if (slugs) {
      out.push(...slugs);
    } else if (VALID_SLUGS.has(key)) {
      out.push(key as Muscle);
    }
  }
  return out;
}
