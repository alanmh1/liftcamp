import type { Muscle } from "react-body-highlighter";
import { canonMuscle } from "@/lib/muscle-vocab";

// Keyed by CANONICAL muscle only. Synonyms (quadriceps, abdominals, middle
// back, ...) are resolved by canonMuscle() before lookup, so they no longer
// need duplicate entries here.
const LOOKUP: Record<string, Muscle[]> = {
  abs: ["abs"],
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
  "upper back": ["upper-back"],
  neck: ["neck"],
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
    const key = canonMuscle(part);
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
