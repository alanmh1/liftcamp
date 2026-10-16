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
  "barbell-bench-press",
  "barbell-deadlift",
  "barbell-squat",
  "bent-over-barbell-row",
  "dumbbell-bench-press",
  "leg-press",
  "plank",
  "pullups",
  "romanian-deadlift",
  "wide-grip-lat-pulldown",
]);

export const EXERCISE_ART_WIDTH = 1600;
export const EXERCISE_ART_HEIGHT = 900;

export function exerciseArtUrl(slug: string): string | null {
  return EXERCISE_ART_SLUGS.has(slug) ? `/exercise-art/${slug}.webp` : null;
}
