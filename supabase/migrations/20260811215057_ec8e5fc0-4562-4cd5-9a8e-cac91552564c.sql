-- Canonical muscle vocabulary + normalized search text.
CREATE OR REPLACE FUNCTION public.canon_muscle(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(raw))
    WHEN 'quadriceps'  THEN 'quads'
    WHEN 'abdominals'  THEN 'abs'
    WHEN 'core'        THEN 'abs'
    WHEN 'middle back' THEN 'upper back'
    WHEN 'back'        THEN 'upper back'
    ELSE lower(btrim(raw))
  END;
$$;

CREATE OR REPLACE FUNCTION public.canon_muscle_list(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN btrim(raw) = '' THEN raw
    ELSE (
      SELECT string_agg(d.m, '|' ORDER BY d.ord)
      FROM (
        SELECT public.canon_muscle(t.tok) AS m, min(t.ord) AS ord
        FROM unnest(string_to_array(raw, '|')) WITH ORDINALITY AS t(tok, ord)
        WHERE btrim(t.tok) <> ''
        GROUP BY public.canon_muscle(t.tok)
      ) d
    )
  END;
$$;

UPDATE public.exercises
SET primary_muscle      = public.canon_muscle(primary_muscle),
    all_primary_muscles = public.canon_muscle_list(all_primary_muscles),
    secondary_muscles   = public.canon_muscle_list(secondary_muscles)
WHERE primary_muscle      IS DISTINCT FROM public.canon_muscle(primary_muscle)
   OR all_primary_muscles IS DISTINCT FROM public.canon_muscle_list(all_primary_muscles)
   OR secondary_muscles   IS DISTINCT FROM public.canon_muscle_list(secondary_muscles);

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_primary_muscle_canonical;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_primary_muscle_canonical
  CHECK (
    primary_muscle IS NULL OR primary_muscle IN (
      'abductors', 'abs', 'adductors', 'biceps', 'calves', 'chest',
      'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'neck',
      'quads', 'shoulders', 'traps', 'triceps', 'upper back'
    )
  ) NOT VALID;

ALTER TABLE public.exercises
  VALIDATE CONSTRAINT exercises_primary_muscle_canonical;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS exercises_search_text_trgm_idx
  ON public.exercises USING gin (search_text gin_trgm_ops);