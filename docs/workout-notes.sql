-- Workout notes: a 500 character cap on workouts.notes.
--
-- The app caps the box at 500 (WORKOUT_NOTES_MAX in
-- packages/shared/src/workout-notes.ts). This makes the database refuse a
-- longer note from any client. The write queue treats the refusal (23514)
-- as permanent: the op goes to liftcamp:queue-failed and app_events as
-- write_failed, which the app's own cap keeps from happening.
--
-- char_length counts characters (code points). The app counts UTF-16 units,
-- which is never fewer, so anything the app accepts fits.
--
-- Run in SUPABASE (SQL editor). Safe to run twice. No grants change.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Run alone first and read the output.
-- Expect: notes_column text, with_notes 4, longest 108 (10 Oct 2026),
-- over_cap 0, existing_check null.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT data_type
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workouts' AND column_name = 'notes') AS notes_column,
  count(*) FILTER (WHERE notes IS NOT NULL) AS with_notes,
  max(char_length(notes)) AS longest,
  count(*) FILTER (WHERE char_length(notes) > 500) AS over_cap,
  (SELECT pg_get_constraintdef(oid)
     FROM pg_constraint
    WHERE conrelid = 'public.workouts'::regclass
      AND conname = 'workouts_notes_length_check') AS existing_check
FROM public.workouts;

-- ---------------------------------------------------------------------------
-- Section 1: the cap.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  too_long integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'workouts' AND column_name = 'notes'
  ) THEN
    RAISE EXCEPTION 'public.workouts.notes does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.workouts'::regclass
       AND conname = 'workouts_notes_length_check'
  ) THEN
    RAISE NOTICE 'workouts_notes_length_check already exists, nothing to do';
    RETURN;
  END IF;

  SELECT count(*) INTO too_long FROM public.workouts WHERE char_length(notes) > 500;
  IF too_long > 0 THEN
    RAISE EXCEPTION '% workouts have a note over 500 characters; shorten them first', too_long;
  END IF;

  ALTER TABLE public.workouts
    ADD CONSTRAINT workouts_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 500);
END
$$;

-- ---------------------------------------------------------------------------
-- Section 2: check. Expect one row:
-- CHECK (((notes IS NULL) OR (char_length(notes) <= 500)))
-- ---------------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.workouts'::regclass
  AND conname = 'workouts_notes_length_check';
