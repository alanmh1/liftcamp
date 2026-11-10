ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS progression_rep_trigger smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_progression_rep_trigger_range'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_progression_rep_trigger_range
      CHECK (progression_rep_trigger IS NULL OR progression_rep_trigger BETWEEN 5 AND 30);
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.progression_rep_trigger IS
  'Pro. Reps on the first working set that trigger a weight bump. Null means off.';
