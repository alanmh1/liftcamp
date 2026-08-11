-- Canonical muscle vocabulary + normalized search text.
--
-- Fixes three related bugs that all share one root cause: there was no
-- normalization layer between user input and stored values.
--
--   1. The muscle filter dropdown was built from DISTINCT primary_muscle, so it
--      offered BOTH "quads" (147 rows) and "quadriceps" (4 rows) as separate
--      options. Picking "quadriceps" returned 4 rows and hid Leg Extensions.
--   2. Same for "upper back" (33) vs "middle back" (2).
--   3. Name search used ilike on the raw name, so "pull up" and "pull-up" both
--      failed to match the row named "Pullups".
--
-- Strategy: collapse the stale vocabulary to a single canonical set, add a
-- CHECK constraint so new hand-added rows cannot reintroduce a variant, and add
-- a generated search_text column that strips punctuation and case so the client
-- can match against a normalized form.
--
-- Written defensively (IF NOT EXISTS / IF EXISTS, CREATE OR REPLACE) because
-- several exercises columns exist in the live DB but not in any migration file,
-- so this must be safe to run against either state.


-- ---------------------------------------------------------------------------
-- 1. Canonicalization helpers
-- ---------------------------------------------------------------------------

-- Maps a single muscle token to its canonical spelling. This is the ONE place
-- in the database where a synonym is declared. Add new synonyms here only.
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

-- Canonicalizes a pipe-delimited muscle list (all_primary_muscles,
-- secondary_muscles). Preserves original token order and drops duplicates that
-- appear only after canonicalization -- e.g. "lats|middle back|upper back"
-- collapses to "lats|upper back" rather than "lats|upper back|upper back".
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


-- ---------------------------------------------------------------------------
-- 2. Collapse the stale vocabulary
-- ---------------------------------------------------------------------------

-- Touches only rows that actually change, so this is a no-op on re-run.
UPDATE public.exercises
SET primary_muscle      = public.canon_muscle(primary_muscle),
    all_primary_muscles = public.canon_muscle_list(all_primary_muscles),
    secondary_muscles   = public.canon_muscle_list(secondary_muscles)
WHERE primary_muscle      IS DISTINCT FROM public.canon_muscle(primary_muscle)
   OR all_primary_muscles IS DISTINCT FROM public.canon_muscle_list(all_primary_muscles)
   OR secondary_muscles   IS DISTINCT FROM public.canon_muscle_list(secondary_muscles);


-- ---------------------------------------------------------------------------
-- 3. Lock the vocabulary
-- ---------------------------------------------------------------------------

-- The 17 canonical values remaining after the collapse above. A hand-added row
-- using "quadriceps" now fails loudly at insert instead of silently creating a
-- duplicate filter option.
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

-- Added NOT VALID then validated separately: if some row is still off-vocabulary
-- the failure names the constraint rather than aborting the whole ALTER, which
-- makes it diagnosable.
ALTER TABLE public.exercises
  VALIDATE CONSTRAINT exercises_primary_muscle_canonical;


-- ---------------------------------------------------------------------------
-- 4. Normalized search text
-- ---------------------------------------------------------------------------

-- Strips every non-alphanumeric character and lowercases, so:
--   "Pullups"                  -> "pullups"
--   "Pull-Up"                  -> "pullup"
--   "Leg Extensions"           -> "legextensions"
--   "Dips - Chest Version"     -> "dipschestversion"
-- A client searching "pull up" normalizes to "pullup", which IS a substring of
-- "pullups". This is what fixes the long-standing Pullups search bug.
--
-- The client MUST use the identical transform. See normalizeSearch() in
-- src/lib/muscle-vocab.ts -- the two must stay in sync.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED;

-- Trigram index because the client does a substring (%foo%) match, which a
-- btree cannot serve. At 883 rows this is not a performance necessity; it is
-- here so the pattern still holds if the catalog grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS exercises_search_text_trgm_idx
  ON public.exercises USING gin (search_text gin_trgm_ops);
