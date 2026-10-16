import type { RoutineImageKey } from "@liftcamp/shared";

/**
 * The equipment illustrations, one per image key in shared's picker, served
 * from public/equipment/<key>.webp. 768 square clay renders with alpha, the
 * same set mobile bundles as PNGs. The name, with its article, is what the
 * alt text says.
 */
export const ROUTINE_ART_SIZE = 768;

export const ROUTINE_ART_NAMES: Record<RoutineImageKey, string> = {
  "leg-press": "a leg press",
  "leg-curl": "a leg curl machine",
  "chest-press": "a chest press machine",
  "lat-pulldown": "a lat pulldown machine",
  "power-rack": "a power rack",
  "smith-machine": "a Smith machine",
  "adjustable-bench": "an adjustable bench",
  "ez-bar": "an EZ curl bar",
  barbell: "a barbell",
  dumbbells: "a pair of dumbbells",
  kettlebell: "a kettlebell",
  "cable-machine": "a cable machine",
  "resistance-bands": "a set of resistance bands",
  "bodyweight-mat": "an exercise mat",
  "pull-up-bar": "a pull-up bar",
  "dip-station": "a dip station",
  chair: "a chair",
};

export function routineArtSrc(key: RoutineImageKey): string {
  return `/equipment/${key}.webp`;
}

export function routineArtAlt(key: RoutineImageKey): string {
  return `Clay illustration of ${ROUTINE_ART_NAMES[key]}`;
}
