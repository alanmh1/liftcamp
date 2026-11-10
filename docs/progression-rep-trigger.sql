-- "Move up when I hit N+ reps" (Pro, Settings > Training).
-- Null is off: the double progression as before. A number from 5 to 30
-- replaces the routine's rep target: the first working set of the last
-- session at or above it moves every working set up one step.
-- Run in SUPABASE (SQL editor). Not applied by the branch.

-- Section 0: diagnostic. Expect zero rows before running the rest.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'progression_rep_trigger';

-- Section 1: the column. Nullable, no default.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS progression_rep_trigger smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_progression_rep_trigger_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_progression_rep_trigger_check
      CHECK (progression_rep_trigger BETWEEN 5 AND 30);
  END IF;
END $$;

-- Section 2: check. One row, smallint, nullable, no default.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'progression_rep_trigger';
