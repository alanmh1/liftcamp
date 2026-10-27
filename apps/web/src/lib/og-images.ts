// The 1200x630 link-card images that scripts/og-images.ts writes to
// public/og/, listed in og-images.json by the same script. A page uses its
// jpg when the manifest lists it and falls back otherwise, so a slug added
// between builds never points og:image at a missing file.

import manifest from "./og-images.json";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const EXERCISES: ReadonlySet<string> = new Set(manifest.exercises);
const ROUTINES: ReadonlySet<string> = new Set(manifest.routines);

/** Site path of an exercise's card image, or null. */
export function exerciseOgPath(slug: string): string | null {
  return EXERCISES.has(slug) ? `/og/exercises/${slug}.jpg` : null;
}

/** Site path of a routine's card image, or null. */
export function routineOgPath(slug: string): string | null {
  return ROUTINES.has(slug) ? `/og/routines/${slug}.jpg` : null;
}
