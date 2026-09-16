import { canonMuscle, MUSCLE_LABELS, type CanonicalMuscle } from "./muscle-vocab";

/**
 * The clay body diagram: which mask lights up for which muscle, and the
 * numbers both apps draw it with. The assets themselves live in each app
 * (apps/web/public/muscles and apps/mobile/assets/images/muscles): two
 * 1024 by 1024 bases, front and back, and one mask per region below, white
 * with the shape in its alpha, registered to the matching base. See
 * docs/body-diagram.md.
 */

export const FRONT_MASKS = [
  "front_chest",
  "front_delts",
  "front_biceps",
  "front_forearms",
  "front_abs",
  "front_quads",
  "front_adductors",
] as const;

export const BACK_MASKS = [
  "back_traps",
  "back_rear_delts",
  "back_upper_back",
  "back_lats",
  "back_lower_back",
  "back_triceps",
  "back_forearms",
  "back_glutes",
  "back_abductors",
  "back_hamstrings",
  "back_calves",
] as const;

export type FrontMask = (typeof FRONT_MASKS)[number];
export type BackMask = (typeof BACK_MASKS)[number];
export type MuscleMask = FrontMask | BackMask;

export type BodyView = "anterior" | "posterior";

/**
 * Canonical muscle to the masks it lights. Lats and upper back are separate
 * regions. Neck has no mask, so a neck exercise shows an unlit figure.
 */
export const MUSCLE_MASKS: Readonly<Record<CanonicalMuscle, readonly MuscleMask[]>> = {
  chest: ["front_chest"],
  shoulders: ["front_delts", "back_rear_delts"],
  biceps: ["front_biceps"],
  forearms: ["front_forearms", "back_forearms"],
  abs: ["front_abs"],
  quads: ["front_quads"],
  adductors: ["front_adductors"],
  traps: ["back_traps"],
  "upper back": ["back_upper_back"],
  lats: ["back_lats"],
  "lower back": ["back_lower_back"],
  triceps: ["back_triceps"],
  glutes: ["back_glutes"],
  abductors: ["back_abductors"],
  hamstrings: ["back_hamstrings"],
  calves: ["back_calves"],
  neck: [],
};

/** Which muscle a mask belongs to, for the diagram's spoken label. */
export const MASK_MUSCLE: Readonly<Record<MuscleMask, CanonicalMuscle>> = {
  front_chest: "chest",
  front_delts: "shoulders",
  front_biceps: "biceps",
  front_forearms: "forearms",
  front_abs: "abs",
  front_quads: "quads",
  front_adductors: "adductors",
  back_traps: "traps",
  back_rear_delts: "shoulders",
  back_upper_back: "upper back",
  back_lats: "lats",
  back_lower_back: "lower back",
  back_triceps: "triceps",
  back_forearms: "forearms",
  back_glutes: "glutes",
  back_abductors: "abductors",
  back_hamstrings: "hamstrings",
  back_calves: "calves",
};

/**
 * Masks for a pipe-delimited muscle column. Tokens go through canonMuscle
 * so a stale spelling still lights the right region, and an unknown value
 * lights nothing rather than throwing.
 */
export function masksForMuscles(raw: string | null | undefined): MuscleMask[] {
  if (!raw) return [];
  const out: MuscleMask[] = [];
  for (const part of raw.split("|")) {
    const key = canonMuscle(part) as CanonicalMuscle;
    for (const mask of MUSCLE_MASKS[key] ?? []) {
      if (!out.includes(mask)) out.push(mask);
    }
  }
  return out;
}

export function isFrontMask(mask: MuscleMask): mask is FrontMask {
  return (FRONT_MASKS as readonly string[]).includes(mask);
}

export function masksForView(masks: readonly MuscleMask[], view: BodyView): MuscleMask[] {
  return masks.filter((m) => (view === "anterior" ? isFrontMask(m) : !isFrontMask(m)));
}

/** Primary over secondary: a muscle in both lists lights as primary only. */
export const PRIMARY_TINT = "#1B5FA8";
export const SECONDARY_TINT = "#A8C6E4";

/**
 * The figure inside the 1024 square, in source pixels. Both apps crop to
 * this box: a container at the box's aspect ratio, and every layer scaled
 * by 1024 over the box width and offset by the box origin, so the base and
 * the masks share one transform and stay registered.
 */
export const BODY_SOURCE = 1024;
export const BODY_CROP = { x: 236, y: 18, width: 552, height: 992 } as const;

/**
 * The one label for the whole diagram, primary muscles then secondary, in
 * words. The layers underneath are hidden from screen readers.
 */
export function bodyDiagramLabel(primary: readonly MuscleMask[], secondary: readonly MuscleMask[]): string {
  const words = (masks: readonly MuscleMask[]) =>
    [...new Set(masks.map((m) => MUSCLE_LABELS[MASK_MUSCLE[m]].toLowerCase()))].join(", ");
  const p = words(primary);
  const s = words(secondary.filter((m) => !primary.includes(m)));
  if (!p && !s) return "Body diagram, no muscles highlighted";
  return `Body diagram. Primary ${p || "none"}. Secondary ${s || "none"}`;
}
