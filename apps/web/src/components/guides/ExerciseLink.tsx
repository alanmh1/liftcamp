import { Link } from "@tanstack/react-router";

/** Inline link from guide prose to an exercise page.
 *
 *  Prefer an exercise with an authored beginner block. Detail pages without a
 *  beginner_notes row are noindex,follow and carry nothing but the
 *  free-exercise-db description, so sending a reader there from a guide is a
 *  weaker destination.
 *
 *  AUTHORED_SLUGS is every catalog slug (owner_id null) with a beginner_notes
 *  row, sorted: 204 as of 2 November 2026, out of 912 catalog exercises. It is
 *  generated from a read-only query, not picked by hand. When notes are added,
 *  regenerate it and check it with
 *
 *    pnpm --filter @liftcamp/web exec tsx scripts/check-guide-links.ts
 *
 *  which fails if a slug here has no note, or a LINKABLE_SLUGS entry has
 *  gained one (it then belongs here). */
export const AUTHORED_SLUGS = [
  "ab-crunch-machine",
  "alternate-hammer-curl",
  "alternate-incline-dumbbell-curl",
  "alternating-deltoid-raise",
  "alternating-renegade-row",
  "arnold-dumbbell-press",
  "assisted-dip-machine",
  "assisted-pull-up-machine",
  "band-assisted-pull-up",
  "band-pull-apart",
  "banded-bent-over-row",
  "banded-lat-pulldown",
  "banded-romanian-deadlift",
  "barbell-bench-press",
  "barbell-curl",
  "barbell-deadlift",
  "barbell-full-squat",
  "barbell-glute-bridge",
  "barbell-hip-thrust",
  "barbell-lunge",
  "barbell-shoulder-press",
  "barbell-shrug",
  "barbell-squat",
  "bayesian-cable-curl",
  "bench-dips",
  "bench-press-with-bands",
  "bent-knee-hip-raise",
  "bent-over-barbell-row",
  "bent-over-two-dumbbell-row",
  "bird-dog",
  "bodyweight-calf-raise",
  "bodyweight-squat",
  "bodyweight-walking-lunge",
  "box-squat",
  "bulgarian-split-squat",
  "butt-lift-bridge",
  "butterfly",
  "cable-chest-press",
  "cable-crossover",
  "cable-crunch",
  "cable-hammer-curls-rope-attachment",
  "cable-hip-abduction",
  "cable-rear-delt-fly",
  "cable-rope-overhead-triceps-extension",
  "cable-seated-lateral-raise",
  "cable-shrugs",
  "calf-press-on-the-leg-press-machine",
  "chin-up",
  "clamshell",
  "close-grip-barbell-bench-press",
  "close-grip-front-lat-pulldown",
  "concentration-curls",
  "cross-body-hammer-curl",
  "crunches",
  "dead-bug",
  "decline-barbell-bench-press",
  "decline-close-grip-bench-to-skull-crusher",
  "decline-dumbbell-bench-press",
  "decline-push-up",
  "dips-chest-version",
  "dips-triceps-version",
  "dumbbell-bench-press",
  "dumbbell-bicep-curl",
  "dumbbell-floor-press",
  "dumbbell-flyes",
  "dumbbell-hip-thrust",
  "dumbbell-incline-row",
  "dumbbell-lunges",
  "dumbbell-one-arm-shoulder-press",
  "dumbbell-rear-lunge",
  "dumbbell-romanian-deadlift",
  "dumbbell-shoulder-press",
  "dumbbell-shrug",
  "dumbbell-side-bend",
  "dumbbell-squat",
  "dumbbell-step-ups",
  "elevated-cable-rows",
  "external-rotation-with-band",
  "ez-bar-curl",
  "face-pull",
  "farmers-walk",
  "fire-hydrant",
  "flat-bench-lying-leg-raise",
  "freehand-jump-squat",
  "front-barbell-squat",
  "front-dumbbell-raise",
  "glute-kickback",
  "goblet-squat",
  "good-morning",
  "hack-squat",
  "hammer-curls",
  "hanging-leg-raise",
  "hip-thrust-machine",
  "hyperextensions-back-extensions",
  "incline-barbell-bench-press",
  "incline-cable-flye",
  "incline-dumbbell-bench-with-palms-facing-in",
  "incline-dumbbell-curl",
  "incline-dumbbell-flyes",
  "incline-dumbbell-press",
  "incline-push-up",
  "inverted-row",
  "kettlebell-swing",
  "knee-hip-raise-on-parallel-bars",
  "knee-push-up",
  "kneeling-high-pulley-row",
  "landmine-press",
  "leg-extensions",
  "leg-press",
  "leverage-chest-press",
  "leverage-high-row",
  "leverage-incline-chest-press",
  "leverage-shoulder-press",
  "lying-hamstring-curl",
  "lying-triceps-press",
  "machine-bench-press",
  "machine-lateral-raise",
  "machine-preacher-curls",
  "machine-shoulder-military-press",
  "machine-triceps-extension",
  "middle-back-shrug",
  "monster-walk",
  "mountain-climbers",
  "oblique-crunches",
  "one-arm-dumbbell-row",
  "one-arm-lat-pulldown",
  "pallof-press",
  "parallel-bar-dip",
  "pendulum-squat",
  "pike-push-up",
  "plank",
  "power-clean",
  "preacher-curl",
  "pullups",
  "push-up-wide",
  "push-ups-close-triceps-position",
  "pushups",
  "reverse-barbell-curl",
  "reverse-crunch",
  "reverse-flyes",
  "reverse-grip-triceps-pushdown",
  "reverse-machine-flyes",
  "romanian-deadlift",
  "russian-twist",
  "scapular-pull-up",
  "seated-bent-over-rear-delt-raise",
  "seated-cable-rows",
  "seated-calf-raise",
  "seated-dumbbell-curl",
  "seated-hamstring-curl",
  "seated-machine-row",
  "seated-palm-up-barbell-wrist-curl",
  "seated-side-lateral-raise",
  "seated-triceps-press",
  "shoulder-press-with-bands",
  "side-bridge",
  "side-lateral-raise",
  "side-laterals-to-front-raise",
  "single-arm-cable-rear-delt-fly",
  "single-arm-cable-triceps-pushdown",
  "single-leg-dumbbell-romanian-deadlift",
  "single-leg-glute-bridge",
  "single-leg-high-box-squat",
  "sit-up",
  "smith-machine-bench-press",
  "smith-machine-bent-over-row",
  "smith-machine-hip-thrust",
  "smith-machine-romanian-deadlift",
  "smith-machine-shoulder-press",
  "smith-machine-squat",
  "spider-curl",
  "split-squat-with-dumbbells",
  "squats-with-bands",
  "standing-biceps-cable-curl",
  "standing-cable-wood-chop",
  "standing-calf-raises",
  "standing-dumbbell-calf-raise",
  "standing-dumbbell-triceps-extension",
  "standing-dumbbell-upright-row",
  "standing-leg-curl",
  "standing-military-press",
  "step-up-with-knee-raise",
  "stiff-legged-barbell-deadlift",
  "stiff-legged-dumbbell-deadlift",
  "straight-arm-dumbbell-pullover",
  "straight-arm-pulldown",
  "sumo-deadlift",
  "superman",
  "t-bar-row",
  "thigh-abductor",
  "thigh-adductor",
  "trap-bar-deadlift",
  "tricep-dumbbell-kickback",
  "triceps-overhead-extension-with-rope",
  "triceps-pushdown",
  "triceps-pushdown-rope-attachment",
  "upright-barbell-row",
  "upright-cable-row",
  "walking-treadmill",
  "wall-sit",
  "wide-grip-lat-pulldown",
  "wide-grip-pulldown-behind-the-neck",
  "wide-grip-seated-cable-row",
  "zottman-curl",
] as const;

export type AuthoredSlug = (typeof AUTHORED_SLUGS)[number];

/** Catalog pages a guide may link to that do NOT have a beginner block yet.
 *
 *  What is left of the original 38: the other 31 have since gained a
 *  beginner_notes row and moved to AUTHORED_SLUGS (2 November 2026). An entry
 *  that gains a note moves there too; the check script flags it.
 *
 *  These are noindex,follow, which is a search instruction, not a quality one:
 *  the page still carries both position photos, the equipment, and the full
 *  instructions, so it is a perfectly good destination for a reader. It just
 *  will not rank, and linking to it does not help it rank.
 *
 *  Prefer an AUTHORED_SLUGS target when both would work. Every slug here was
 *  checked against the catalog for images and instruction text, so none of them
 *  lands on an empty page. */
export const LINKABLE_SLUGS = [
  "leverage-decline-chest-press",
  "leverage-deadlift",
  "seated-cable-shoulder-press",
  "dip-machine",
  "machine-bicep-curl",
  "one-arm-incline-lateral-raise",
  "dumbbell-bench-press-with-neutral-grip",
] as const;

export type LinkableSlug = (typeof LINKABLE_SLUGS)[number];
export type GuideLinkSlug = AuthoredSlug | LinkableSlug;

export function ExerciseLink({ slug, children }: { slug: GuideLinkSlug; children: string }) {
  return (
    <Link
      to="/exercises/$slug"
      params={{ slug }}
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </Link>
  );
}
