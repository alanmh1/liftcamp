// Squatch clay renders for the exercise pages, one per slug, at
// public/exercise-art/<slug>.webp (1600x900, 16:9, ~20-35 KB each).
//
// Where a slug has one it replaces the muscle diagram on the "Explained in
// full" card and replaces both the animation and the muscle diagram in the
// detail page header. Every other exercise keeps its current imagery.
//
// Add a slug here when its file lands in public/exercise-art.
const EXERCISE_ART_SLUGS = new Set([
  "alternate-hammer-curl",
  "assisted-dip-machine",
  "assisted-pull-up-machine",
  "band-assisted-pull-up",
  "band-pull-apart",
  "barbell-bench-press",
  "barbell-curl",
  "barbell-deadlift",
  "barbell-hip-thrust",
  "barbell-shoulder-press",
  "barbell-shrug",
  "barbell-squat",
  "bench-dips",
  "bent-over-barbell-row",
  "bodyweight-squat",
  "bodyweight-walking-lunge",
  "bulgarian-split-squat",
  "butterfly",
  "cable-crossover",
  "cable-crunch",
  "cable-hammer-curls-rope-attachment",
  "chin-up",
  "close-grip-barbell-bench-press",
  "dips-chest-version",
  "dumbbell-bench-press",
  "dumbbell-flyes",
  "dumbbell-romanian-deadlift",
  "dumbbell-shoulder-press",
  "dumbbell-squat",
  "dumbbell-step-ups",
  "ez-bar-curl",
  "face-pull",
  "farmers-walk",
  "goblet-squat",
  "hack-squat",
  "hammer-curls",
  "hyperextensions-back-extensions",
  "incline-barbell-bench-press",
  "inverted-row",
  "leg-extensions",
  "leg-press",
  "lying-hamstring-curl",
  "machine-bench-press",
  "machine-shoulder-military-press",
  "one-arm-dumbbell-row",
  "parallel-bar-dip",
  "pendulum-squat",
  "plank",
  "pullups",
  "pushups",
  "reverse-machine-flyes",
  "romanian-deadlift",
  "seated-cable-rows",
  "seated-hamstring-curl",
  "single-leg-glute-bridge",
  "smith-machine-squat",
  "split-squat-with-dumbbells",
  "tricep-dumbbell-kickback",
  "triceps-overhead-extension-with-rope",
  "triceps-pushdown",
  "wall-sit",
  "wide-grip-lat-pulldown",
]);

export const EXERCISE_ART_WIDTH = 1600;
export const EXERCISE_ART_HEIGHT = 900;

export function exerciseArtUrl(slug: string): string | null {
  return EXERCISE_ART_SLUGS.has(slug) ? `/exercise-art/${slug}.webp` : null;
}
