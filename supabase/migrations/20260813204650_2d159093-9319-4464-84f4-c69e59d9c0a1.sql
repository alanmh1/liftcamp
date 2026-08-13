CREATE OR REPLACE FUNCTION public.canon_equipment(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
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
  'Canonical spelling for exercises.equipment. The only place equipment synonyms are declared.';

UPDATE public.exercises
SET equipment = public.canon_equipment(equipment)
WHERE equipment IS NOT NULL
  AND equipment IS DISTINCT FROM public.canon_equipment(equipment);

UPDATE public.exercises
SET equipment = 'e-z curl bar'
WHERE name ~* '(^|[^a-z])e-?z[ -]?bar'
  AND lower(btrim(coalesce(equipment, ''))) IN ('barbell', 'other', '');

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_equipment_canonical;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_equipment_canonical
  CHECK (
    equipment IS NULL OR equipment IN (
      'barbell','dumbbell','e-z curl bar','kettlebells','machine','smith machine',
      'cable','bands','body only','medicine ball','exercise ball','foam roll','other',''
    )
  )
  NOT VALID;