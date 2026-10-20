import { HERO_TINT_SLOT, routineTintSlots } from "@liftcamp/shared";
import type { RoutineImageKey } from "@liftcamp/shared";

/**
 * The six pastels behind a routine's illustration, in slot order. Each is a
 * var in styles.css with a light and a dark value. Static class names, so
 * Tailwind sees them.
 */
export const ROUTINE_TINTS = [
  "bg-tint-sky",
  "bg-tint-mint",
  "bg-tint-peach",
  "bg-tint-lavender",
  "bg-tint-butter",
  "bg-tint-sand",
] as const;

/** The routine featured as the hero on /routines, out of the grid. */
export const BEST_FIRST_SLUG = "full-body-3-day";

/** Shown when a slug is missing from the lookup: the hero's colour. */
export const FALLBACK_TINT = ROUTINE_TINTS[HERO_TINT_SLOT];

/**
 * A tint class per routine, keyed by program slug, over the full catalog in
 * loader order (getPublicRoutines), with the best first routine pinned as
 * the hero. The index and the detail page both run it over that list, so a
 * routine shows the same pastel on its card, its detail hero and wherever
 * it appears under Other routines. Run over the unfiltered list, so a card
 * keeps its colour when the filters hide its neighbours; a filtered grid
 * can put two matching tints side by side.
 */
export function routineTints(
  routines: readonly { programSlug: string; art: RoutineImageKey }[],
): Map<string, string> {
  const slots = routineTintSlots(
    routines.map((r) => ({ slug: r.programSlug, art: r.art })),
    { heroSlug: BEST_FIRST_SLUG, slots: ROUTINE_TINTS.length },
  );
  return new Map([...slots].map(([slug, slot]) => [slug, ROUTINE_TINTS[slot]!]));
}
