-- Head-term naming for the two bench press rows.
--
-- free-exercise-db stores the flat barbell bench as "Barbell Bench Press -
-- Medium Grip" and the incline as "Barbell Incline Bench Press - Medium Grip".
-- There is no plain "Barbell Bench Press" row: the medium-grip row IS the
-- canonical flat bench, so the qualifier describes a default, not a variant.
-- The name drives the H1, the <title> and the slug, so both pages currently
-- target a phrase nobody searches.
--
-- Renamed before any beginner_notes row exists, so nothing is indexed yet and
-- no redirect chain is created. The old slugs still 301 via
-- LEGACY_SLUG_REDIRECTS in src/lib/muscle-regions.ts.
--
-- The slug trigger is BEFORE INSERT only and never rewrites an existing slug,
-- so each slug is set explicitly here.
--
-- "Incline Barbell Bench Press" follows the shape already used by
-- "Decline Barbell Bench Press" and "Wide-Grip Decline Barbell Bench Press".

-- 1. Flat bench: name + slug.
UPDATE public.exercises
SET name = 'Barbell Bench Press',
    slug = 'barbell-bench-press'
WHERE slug = 'barbell-bench-press-medium-grip'
  AND NOT EXISTS (SELECT 1 FROM public.exercises WHERE slug = 'barbell-bench-press');

-- 2. Incline bench: name + slug.
UPDATE public.exercises
SET name = 'Incline Barbell Bench Press',
    slug = 'incline-barbell-bench-press'
WHERE slug = 'barbell-incline-bench-press-medium-grip'
  AND NOT EXISTS (SELECT 1 FROM public.exercises WHERE slug = 'incline-barbell-bench-press');

-- 3. Display-only cleanup. These three carry the seed data's " - " separator in
--    the middle of the name, which reads as a typo in an H1. Slugs are already
--    clean, so no URL changes and no redirects are needed.
UPDATE public.exercises SET name = 'Powerlifting Bench Press'
WHERE slug = 'bench-press-powerlifting';

UPDATE public.exercises SET name = 'Bench Press with Bands'
WHERE slug = 'bench-press-with-bands';

UPDATE public.exercises SET name = 'Squats with Bands'
WHERE slug = 'squats-with-bands';

-- 4. alias_text is denormalized from exercises.name, so it has to be rebuilt
--    after any rename. Both bench rows still match the 'bench press' rule, so
--    this restores rather than changes their aliases.
SELECT public.rebuild_exercise_aliases();