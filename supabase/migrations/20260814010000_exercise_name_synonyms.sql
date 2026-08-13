-- Exercise name synonyms.
--
-- Third instance of one root cause: what people type is not what the seed data
-- stored. Muscles were fixed by canon_muscle(), equipment by canon_equipment().
-- Exercise NAMES need a different shape of fix, because a muscle has one right
-- answer ('quads') while an exercise legitimately has many right names.
--
-- OBSERVED: the chest fly is stored as "Butterfly". Searching "chest fly",
-- "chest flyes", "pec fly" or "pec deck" returns nothing, because search_text
-- is a substring match on the name and none of those strings appear in it.
-- Same class of miss for "OHP", "RDL", "skullcrusher", "rope pushdown".
--
-- STRATEGY. Two tables and one rebuild function:
--
--   exercise_synonym_rules  -- a regex over exercise NAME -> extra search terms.
--                              This is the ONE place a name synonym is declared.
--   exercises.alias_text    -- denormalized, rebuilt from the rules. The client
--                              searches this alongside search_text.
--
-- Adding a synonym is one INSERT plus one function call. Nothing else changes.
--
-- WHY DENORMALIZE rather than join. The picker's query is a single PostgREST
-- select with .ilike on search_text. Keeping the match on a column preserves
-- that shape -- the client change is .ilike(...) becoming .or(...), and the
-- ROW_LIMIT / count semantics are untouched.
--
-- WHY NOT extend search_text itself. search_text is a GENERATED column, and a
-- generated column cannot read another table. alias_text is added alongside it
-- so the muscle-vocabulary migration that creates search_text needs no edit.


-- ---------------------------------------------------------------------------
-- 1. Normalizer, matching normalizeSearch() in src/lib/muscle-vocab.ts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.norm_search(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9]+', '', 'g');
$$;

COMMENT ON FUNCTION public.norm_search(text) IS
  'Lowercase and strip every non-alphanumeric character. Mirrors normalizeSearch() in src/lib/muscle-vocab.ts. If you change one, change the other.';


-- ---------------------------------------------------------------------------
-- 2. Rules table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exercise_synonym_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Case-insensitive regex tested against exercises.name.
  name_match  text NOT NULL,
  -- Search terms to attach to every exercise whose name matches.
  aliases     text[] NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_synonym_rules_match_key
  ON public.exercise_synonym_rules (name_match);

ALTER TABLE public.exercise_synonym_rules ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.exercise_synonym_rules TO authenticated;
GRANT ALL    ON public.exercise_synonym_rules TO service_role;

DROP POLICY IF EXISTS "Synonym rules readable by authenticated users"
  ON public.exercise_synonym_rules;
CREATE POLICY "Synonym rules readable by authenticated users"
  ON public.exercise_synonym_rules FOR SELECT
  TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- 3. alias_text column
-- ---------------------------------------------------------------------------
--
-- Normalized aliases joined by '|'. The separator matters: norm_search() strips
-- every non-alphanumeric character, so a normalized query can never contain a
-- '|'. Without it, concatenating 'chestfly' and 'pecdeck' would make the
-- nonsense query "flypec" match across the boundary.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS alias_text text;

CREATE INDEX IF NOT EXISTS exercises_alias_text_idx
  ON public.exercises (alias_text text_pattern_ops);


-- ---------------------------------------------------------------------------
-- 4. Rebuild function
-- ---------------------------------------------------------------------------
--
-- Idempotent and safe to run any time. Call after editing the rules table.

CREATE OR REPLACE FUNCTION public.rebuild_exercise_aliases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  WITH matched AS (
    SELECT e.id,
           string_agg(DISTINCT public.norm_search(a.alias), '|') AS txt
    FROM public.exercises e
    JOIN public.exercise_synonym_rules r
      ON e.name ~* r.name_match
    CROSS JOIN LATERAL unnest(r.aliases) AS a(alias)
    -- Aliases shorter than 3 normalized characters are rejected. Two-letter
    -- terms like 'dl' collide with ordinary substrings -- 'dl' appears inside
    -- "seatedlegcurl" -- and produce nonsense results.
    WHERE length(public.norm_search(a.alias)) >= 3
    GROUP BY e.id
  )
  UPDATE public.exercises e
  SET alias_text = m.txt
  FROM matched m
  WHERE e.id = m.id
    AND e.alias_text IS DISTINCT FROM m.txt;

  GET DIAGNOSTICS touched = ROW_COUNT;

  -- Clear rows that no longer match any rule.
  UPDATE public.exercises e
  SET alias_text = NULL
  WHERE e.alias_text IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.exercise_synonym_rules r WHERE e.name ~* r.name_match
    );

  RETURN touched;
END;
$$;

COMMENT ON FUNCTION public.rebuild_exercise_aliases() IS
  'Rebuilds exercises.alias_text from exercise_synonym_rules. Run after inserting or editing a rule.';


-- ---------------------------------------------------------------------------
-- 5. Seed rules
-- ---------------------------------------------------------------------------
--
-- Every regex uses (^|[^a-z]) / ([^a-z]|$) style boundaries where a bare
-- substring would over-match. Aliases are stored human-readably; the rebuild
-- normalizes them.

INSERT INTO public.exercise_synonym_rules (name_match, aliases, note) VALUES

  -- The reported case. free-exercise-db calls every chest fly a "Butterfly".
  ('butterfly',
   ARRAY['chest fly','chest flye','chest flies','chest flyes','pec fly','pec flyes','pec deck','chest flys'],
   'free-exercise-db names chest flyes "Butterfly"; nobody searches that'),

  -- Fly spelling family, for rows that already say "fly" somewhere.
  ('(^|[^a-z])fly(e?s)?([^a-z]|$)',
   ARRAY['flye','flyes','flies','flys'],
   'fly / flye / flies / flyes are all in common use'),

  ('cable crossover',
   ARRAY['cable fly','cable flye','cable flyes','cable crossovers'],
   NULL),

  ('rear delt|reverse fly|reverse machine fly',
   ARRAY['rear delt fly','rear delt raise','reverse fly','reverse flye','rear fly'],
   NULL),

  -- Pressing
  ('(^|[^a-z])(military|shoulder|overhead) press',
   ARRAY['ohp','overhead press','shoulder press','military press'],
   'OHP is near-universal shorthand'),
  ('bench press',
   ARRAY['chest press','bench'],
   NULL),

  -- Pulling
  ('(^|[^a-z])pulldown|pull down',
   ARRAY['lat pulldown','pulldown','pull down'],
   NULL),
  ('bent over row|barbell row',
   ARRAY['bent over row','barbell row','pendlay row'],
   NULL),
  ('(^|[^a-z])(seated|cable) row',
   ARRAY['cable row','seated row'],
   NULL),
  ('face pull',
   ARRAY['face pulls','rear delt cable'],
   NULL),

  -- Arms
  ('skullcrusher|skull crusher|lying triceps',
   ARRAY['skullcrusher','skull crusher','french press','lying tricep extension','nose breaker'],
   NULL),
  ('(^|[^a-z])pushdown|push down',
   ARRAY['tricep pushdown','triceps pushdown','rope pushdown','cable pushdown','tricep extension'],
   'attachment is not modelled in schema; rope/bar searches land here'),
  -- Negative lookahead: a leg, hamstring, wrist or calf curl is not an arm
  -- curl. Without this, searching "bicep curl" returns Seated Leg Curl.
  ('^(?!.*(leg|hamstring|wrist|calf|reverse)).*curl',
   ARRAY['bicep curl','biceps curl','arm curl'],
   'arm curls only; leg/wrist/calf curls excluded by lookahead'),
  ('preacher curl',
   ARRAY['ez bar curl','scott curl'],
   NULL),

  -- Shoulders
  ('lateral raise|side lateral',
   ARRAY['lat raise','side raise','lateral raises','shoulder raise'],
   NULL),
  ('front raise',
   ARRAY['front delt raise','anterior raise'],
   NULL),
  ('upright row',
   ARRAY['upright rows'],
   NULL),
  ('(^|[^a-z])shrug',
   ARRAY['trap shrug','barbell shrug','shrugs'],
   NULL),

  -- Legs
  ('romanian deadlift',
   ARRAY['rdl','romanian deadlift','stiff leg deadlift','straight leg deadlift'],
   NULL),
  ('(^|[^a-z])deadlift',
   ARRAY['dead lift','deadlifts'],
   NULL),
  ('bulgarian split squat|rear.foot.elevated',
   ARRAY['bulgarian split squat','rfess','rear foot elevated split squat'],
   NULL),
  ('leg extension',
   ARRAY['knee extension','quad extension'],
   NULL),
  ('leg curl',
   ARRAY['hamstring curl','ham curl'],
   NULL),
  ('calf raise',
   ARRAY['heel raise','calf raises'],
   NULL),
  ('glute bridge|hip thrust',
   ARRAY['glute bridge','hip thrust','bridge'],
   NULL),
  ('good morning',
   ARRAY['good mornings'],
   NULL),

  -- Bodyweight
  ('(^|[^a-z])dips?([^a-z]|$)',
   ARRAY['tricep dip','chest dip','dips'],
   NULL),
  ('chin.?up',
   ARRAY['chin up','chinup','chins'],
   NULL),
  ('push.?up',
   ARRAY['press up','pushup','push up'],
   NULL),
  ('(^|[^a-z])plank',
   ARRAY['planks','front plank'],
   NULL),

  -- Core
  ('(^|[^a-z])crunch',
   ARRAY['crunches','ab crunch','abdominal crunch'],
   NULL),
  ('leg raise',
   ARRAY['leg lift','hanging leg raise','leg raises'],
   NULL),
  ('russian twist',
   ARRAY['russian twists','oblique twist'],
   NULL),

  -- Carries
  ('farmer',
   ARRAY['farmers walk','farmers carry','farmer carry'],
   NULL)

ON CONFLICT (name_match) DO UPDATE
  SET aliases = EXCLUDED.aliases,
      note    = EXCLUDED.note;


-- ---------------------------------------------------------------------------
-- 6. Build
-- ---------------------------------------------------------------------------

SELECT public.rebuild_exercise_aliases();
