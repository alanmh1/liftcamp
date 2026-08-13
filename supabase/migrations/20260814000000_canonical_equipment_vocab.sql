-- Canonical equipment vocabulary.
--
-- Same root cause as the muscle vocabulary migration: there is no normalization
-- layer between the seed data and stored values, so one physical piece of
-- equipment is spelled several ways.
--
-- OBSERVED: EZ-bar exercises carry equipment 'barbell' on some rows and
-- 'e-z curl bar' on others. "Close-Grip EZ Bar Curl" and "EZ-Bar Curl" are the
-- same bar, filed under two different filter options. Anyone filtering by
-- "Barbell" sees a subset; anyone filtering "E-z Curl Bar" sees a different
-- subset; neither sees all of them.
--
-- STRATEGY, mirroring canon_muscle():
--   1. canon_equipment() is the ONE place a synonym is declared.
--   2. Rows whose NAME says EZ bar are repaired to 'e-z curl bar' regardless of
--      what equipment currently says.
--   3. A CHECK constraint stops new hand-added rows reintroducing a variant.
--
-- Written defensively (IF NOT EXISTS / CREATE OR REPLACE) because several
-- exercises columns exist in the live DB but not in any migration file.


-- ---------------------------------------------------------------------------
-- 1. Canonicalization helper
-- ---------------------------------------------------------------------------

-- Maps an equipment string to its canonical spelling. Unknown values pass
-- through unchanged rather than collapsing to 'other' -- silently discarding an
-- unrecognised value would lose data we cannot recover from the seed.
CREATE OR REPLACE FUNCTION public.canon_equipment(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(raw))
    WHEN 'ez curl bar'    THEN 'e-z curl bar'
    WHEN 'ez bar'         THEN 'e-z curl bar'
    WHEN 'e-z bar'        THEN 'e-z curl bar'
    WHEN 'e z curl bar'   THEN 'e-z curl bar'
    WHEN 'curl bar'       THEN 'e-z curl bar'
    WHEN 'kettlebell'     THEN 'kettlebells'
    WHEN 'band'           THEN 'bands'
    WHEN 'resistance band' THEN 'bands'
    WHEN 'bodyweight'     THEN 'body only'
    WHEN 'body weight'    THEN 'body only'
    WHEN 'none'           THEN 'body only'
    WHEN 'smith'          THEN 'smith machine'
    ELSE lower(btrim(raw))
  END;
$$;

COMMENT ON FUNCTION public.canon_equipment(text) IS
  'Canonical spelling for exercises.equipment. The only place equipment synonyms are declared. Mirrors CANON_EQUIPMENT in src/lib/equipment-vocab.ts.';


-- ---------------------------------------------------------------------------
-- 2. Normalize existing spellings
-- ---------------------------------------------------------------------------

UPDATE public.exercises
SET equipment = public.canon_equipment(equipment)
WHERE equipment IS NOT NULL
  AND equipment IS DISTINCT FROM public.canon_equipment(equipment);


-- ---------------------------------------------------------------------------
-- 3. Repair rows whose NAME says EZ bar but whose equipment does not
-- ---------------------------------------------------------------------------
--
-- The name is the more reliable signal here: free-exercise-db names are
-- consistent about saying "EZ Bar" / "EZ-Bar", while the equipment column drifted.
--
-- The pattern requires a word boundary before "e", so it cannot match inside
-- another word. Deliberately scoped to rows currently tagged 'barbell' or
-- 'other' -- rows already correct are left alone, and a row tagged 'cable' or
-- 'machine' that merely mentions an EZ bar in passing is not silently rewritten.

UPDATE public.exercises
SET equipment = 'e-z curl bar'
WHERE name ~* '(^|[^a-z])e-?z[ -]?bar'
  AND lower(btrim(coalesce(equipment, ''))) IN ('barbell', 'other', '');


-- ---------------------------------------------------------------------------
-- 4. Constraint
-- ---------------------------------------------------------------------------
--
-- NOT VALID: applies to new and updated rows immediately, but does not scan
-- existing rows. If the live catalog holds an equipment value not in this list,
-- the migration still succeeds and the offending rows can be found with the
-- audit query before validating. Run
--     ALTER TABLE public.exercises VALIDATE CONSTRAINT exercises_equipment_canonical;
-- once the audit comes back clean.

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_equipment_canonical;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_equipment_canonical
  CHECK (
    equipment IS NULL OR equipment IN (
      'barbell',
      'dumbbell',
      'e-z curl bar',
      'kettlebells',
      'machine',
      'smith machine',
      'cable',
      'bands',
      'body only',
      'medicine ball',
      'exercise ball',
      'foam roll',
      'other',
      ''
    )
  )
  NOT VALID;
