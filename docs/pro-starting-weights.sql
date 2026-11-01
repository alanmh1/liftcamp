-- Pro starting weights, warm-up sets, plate calculator (branch pro-starting-weights).
-- Run in SUPABASE (SQL editor), Section 0 first, and read its output before Section 1.
--
-- Run this BEFORE the branch reaches any phone, including a dev build pointed at
-- the live project: the workout and history reads select sets.set_type, and the
-- Pro profile read selects user_profiles.warmups_enabled. Without the columns
-- those reads fail. Old builds never name either column, so adding them is safe
-- at any time.
--
-- bar_weight and plate_inventory already exist (Aug 2026 migration) and are
-- reused; the ADD COLUMN IF NOT EXISTS lines for them do nothing if so.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Expect warmups_enabled and set_type missing, and
-- bar_weight (numeric) and plate_inventory (jsonb) present.
-- ---------------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'user_profiles' AND column_name IN ('warmups_enabled', 'bar_weight', 'plate_inventory'))
    OR (table_name = 'sets' AND column_name = 'set_type'))
ORDER BY table_name, column_name;

-- ---------------------------------------------------------------------------
-- Section 1: columns.
-- ---------------------------------------------------------------------------

-- The Warm-up sets switch in Settings (Pro). On by default.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS warmups_enabled boolean NOT NULL DEFAULT true;

-- The plate calculator's bar and plates, in the profile's unit. Null means the defaults.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bar_weight numeric;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS plate_inventory jsonb;

-- What a set counts as for progression. Null is untyped (every set today).
-- The app writes 'warmup' on generated warm-up rows; the other values are
-- the ones classifySets in shared already understands.
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS set_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sets_set_type_check' AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_set_type_check
      CHECK (set_type IS NULL OR set_type IN ('warmup', 'normal', 'drop', 'failure'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Section 2: check. Expect four rows, warmups_enabled NOT NULL default true.
-- ---------------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'user_profiles' AND column_name IN ('warmups_enabled', 'bar_weight', 'plate_inventory'))
    OR (table_name = 'sets' AND column_name = 'set_type'))
ORDER BY table_name, column_name;
