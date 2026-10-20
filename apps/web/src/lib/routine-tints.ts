import { assignCardTints } from "@liftcamp/shared";
import type { RoutineImageKey } from "@liftcamp/shared";

/**
 * The six pastels behind a routine card's illustration on /routines, in
 * slot order. Each is a var in styles.css with a light and a dark value.
 * Static class names, so Tailwind sees them.
 */
export const ROUTINE_TINTS = [
  "bg-tint-sky",
  "bg-tint-mint",
  "bg-tint-peach",
  "bg-tint-lavender",
  "bg-tint-butter",
  "bg-tint-sand",
] as const;

/** The featured hero's slot. It counts toward the same-art rule. */
export const HERO_TINT_SLOT = 0;

/**
 * A tint class per grid card, keyed by program slug, from the full grid in
 * loader order. Run over the unfiltered list and looked up per card, so a
 * card keeps its colour when the filters hide its neighbours (the same rule
 * the art follows); a filtered grid can put two matching tints side by side.
 */
export function routineTints(
  grid: readonly { programSlug: string; art: RoutineImageKey }[],
  heroArt: RoutineImageKey | null,
): Map<string, string> {
  const slots = assignCardTints(
    grid.map((r) => ({ id: r.programSlug, art: r.art })),
    ROUTINE_TINTS.length,
    heroArt ? [{ art: heroArt, slot: HERO_TINT_SLOT }] : [],
  );
  return new Map([...slots].map(([slug, slot]) => [slug, ROUTINE_TINTS[slot]!]));
}
