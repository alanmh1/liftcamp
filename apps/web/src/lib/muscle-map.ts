import { masksForMuscles, type MuscleMask } from "@liftcamp/shared";

/**
 * A pipe-delimited muscle column to the masks the body diagram lights.
 * The mapping itself lives in shared (`MUSCLE_MASKS`), where the mobile
 * app reads the same table. Kept under this name so ExerciseInfo's import
 * did not have to change when the diagram did.
 */
export function muscleNamesToSlugs(raw: string | null | undefined): MuscleMask[] {
  return masksForMuscles(raw);
}
