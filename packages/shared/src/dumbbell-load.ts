/**
 * How a dumbbell exercise's weight is logged. The convention is the weight
 * of one dumbbell, and the workout card says so under the exercise name
 * ("Log the weight of one dumbbell") until the user has a few sessions of it.
 *
 * The exceptions are movements done with a single dumbbell held in both
 * hands (or, for the calf raise, stood on). There the weight is simply the
 * dumbbell, and the hint would suggest there were two. Checked against
 * each exercise's description, 24 Sep 2026.
 */
export const ONE_DUMBBELL_EXERCISES: readonly string[] = [
  "43284cd1-4bb4-44c7-87b6-617ed5f03dbf", // Goblet Squat (retagged dumbbell, 24 Sep 2026)
  "d9f87ffc-f2b5-4628-810b-e6ddc3a49009", // Bent-Arm Dumbbell Pullover
  "bde96b00-81c6-42a8-91e8-c82f366b5380", // Straight-Arm Dumbbell Pullover
  "c67f5050-77ad-42de-8a61-36515b915869", // Dumbbell Hip Thrust
  "f0badbc1-5584-4b59-a640-87797f341286", // Plie Dumbbell Squat
  "d9899985-a114-4200-af3d-fbd9a1ecf6ee", // Standing Dumbbell Triceps Extension
  "572fc426-31a2-4582-961d-f92e9d782ef4", // Seated Triceps Press
  "fb13a615-b33f-4662-b40f-e0ad4926fe0f", // Single Dumbbell Raise
  "1dd6a949-00e9-41fb-acbe-a85c602ce2be", // Vertical Swing
  "98b20825-bbfa-4e6a-83b7-9233b8082c4b", // Dumbbell Seated Box Jump
  "592ddd5f-d72d-40a4-9ce4-7bc21006eb67", // Calf Raise On A Dumbbell (stood on, not held)
];

/**
 * Unilateral dumbbell exercises done one side at a time while holding a
 * dumbbell in each hand: the lunge and split squat family. The logged
 * weight is one dumbbell, and both are carried for every rep. Checked
 * against each exercise's description, 24 Sep 2026; Bulgarian Split Squat's
 * description does not name the load, and is here as the spec asks.
 */
export const TWO_DUMBBELL_UNILATERAL: readonly string[] = [
  "c5d02e3a-8be2-47b4-bd77-dd5623e3e562", // Bulgarian Split Squat
  "91ca5bfe-50dd-4fba-9b7b-b342077c9bd4", // Dumbbell Lunges
  "5e6a36e9-0fdb-4bdb-8ee7-0e619624ad16", // Dumbbell Rear Lunge
  "5fd26cd7-19b7-4d82-b0a4-4039e2132f23", // Dumbbell Step Ups
  "a800b7d8-d432-4472-8998-b9275efd2d32", // Split Squat with Dumbbells
];

export type DumbbellExercise = {
  id?: string | null;
  equipment?: string | null;
  is_unilateral?: boolean | null;
};

/** True when the logged weight is one dumbbell of a pair, so the hint applies. */
export function weightIsPerDumbbell(exercise: { id: string; equipment?: string | null }): boolean {
  return exercise.equipment === "dumbbell" && !ONE_DUMBBELL_EXERCISES.includes(exercise.id);
}

/**
 * How many dumbbells a set moves, for volume. The logged weight is one
 * dumbbell, so a two-dumbbell set moves twice it.
 *
 * - Not a dumbbell exercise, or on ONE_DUMBBELL_EXERCISES: 1.
 * - Dumbbell and bilateral: 2 (bench, shoulder press, two-dumbbell rows
 *   and curls).
 * - Dumbbell and unilateral: 1 (one-arm rows, one-arm presses), unless on
 *   TWO_DUMBBELL_UNILATERAL: 2.
 */
export function dumbbellCount(exercise: DumbbellExercise | null | undefined): 1 | 2 {
  if (exercise?.equipment !== "dumbbell") return 1;
  const id = exercise.id ?? "";
  if (ONE_DUMBBELL_EXERCISES.includes(id)) return 1;
  if (exercise.is_unilateral) return TWO_DUMBBELL_UNILATERAL.includes(id) ? 2 : 1;
  return 2;
}
