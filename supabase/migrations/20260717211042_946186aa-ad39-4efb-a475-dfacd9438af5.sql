-- Catalog cleanup + migration drift catch-up.
--
-- PART 1 backfills six columns that exist in the live database but in no
-- migration. Without this, a rebuild from migrations silently loses the entire
-- bodyweight system. All statements are IF NOT EXISTS, so this is a no-op
-- against the current database and only matters on a fresh rebuild.
--
-- PART 2 removes 19 duplicate Smith machine rows. The catalog was imported
-- from two batches with incompatible vocabularies: batch A used
-- equipment='machine' with short muscle names (quads/abs/upper back), batch B
-- used equipment='smith machine' with free-exercise-db names
-- (quadriceps/middle back). 13 exercise names ended up with 2-3 copies.
-- We keep the batch B row in every case: all three rows that carry logged
-- history are batch B, so nothing needs repointing, and batch B's muscle names
-- match what generate-workout's slot definitions already filter on.
--
-- PART 3 flips the two bodyweight exercises that were never tagged.
--
-- Verified against query exports 2026-07-17: every id below has
-- workout_uses = 0 and template_uses = 0. The NOT EXISTS guards make the
-- deletes safe anyway if anything has been logged since.

-- ---------------------------------------------------------------------------
-- PART 1: drift catch-up (no-ops on the live DB; required for a clean rebuild)
-- ---------------------------------------------------------------------------
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url_2 text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS weight_type text NOT NULL DEFAULT 'standard';
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS weight_value numeric;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bodyweight numeric;

-- ---------------------------------------------------------------------------
-- PART 2: de-duplicate the Smith machine rows (19 rows)
-- ---------------------------------------------------------------------------
DELETE FROM public.exercises e
WHERE e.id IN (
  'c77b79d7-350e-421c-b7d9-1029b5853138',  -- Close-Grip Smith Machine Bench Press [smith machine]
  '3d58859a-ecea-4c5d-8206-ba4e561b3fb2',  -- Smith Machine Bench Press [machine]
  '94ff27e5-2d43-4b3b-9f8a-aa9dc97baae2',  -- Smith Machine Bench Press [smith machine]
  '6c31d7bb-da73-4dc6-973c-3c071d53f7b7',  -- Smith Machine Bent Over Row [machine]
  'bc003bf9-1c14-45fa-a847-99437deb67c9',  -- Smith Machine Bent Over Row [smith machine]
  '262aa09f-bb64-4cef-b825-f030e5a8dbc0',  -- Smith Machine Bulgarian Split Squat [smith machine]
  '9ea98185-ada0-4777-8d2d-a698eb743de7',  -- Smith Machine Calf Raise [machine]
  'f5cda90e-5812-439e-a98b-ccd1e077b53e',  -- Smith Machine Calf Raise [smith machine]
  '82115bb4-c434-48d0-b26a-81c8a8aa89b9',  -- Smith Machine Hip Thrust [smith machine]
  '680720f6-45e2-4040-a818-40a41a6e666c',  -- Smith Machine Incline Bench Press [machine]
  'b255e473-4e4f-4b6a-bfcd-d611ae9e5701',  -- Smith Machine Incline Bench Press [smith machine]
  '58b3693b-923f-4889-b2e7-92f90272c98e',  -- Smith Machine Lunge [smith machine]
  '21bf3526-ac25-4771-89aa-5510b2c399bd',  -- Smith Machine Romanian Deadlift [smith machine]
  '824b94fc-b80b-4254-8029-48d923bf54c0',  -- Smith Machine Shoulder Press [smith machine]
  'b9998c45-acf5-4f49-b211-58dec4c25b8f',  -- Smith Machine Shrug [smith machine]
  '28c3b8c6-525d-468f-9baf-090229b56226',  -- Smith Machine Squat [smith machine]
  '53bebb82-3450-4355-96e8-4b9d739b644c',  -- Smith Machine Squat [machine]
  '565ce0d8-c84b-40d8-b436-a45271bf1bd0',  -- Smith Machine Upright Row [smith machine]
  '610fefaf-14bc-4936-bff8-7e111b6f5805'  -- Smith Machine Upright Row [machine]
)
AND NOT EXISTS (SELECT 1 FROM public.workout_exercises we WHERE we.exercise_id = e.id)
AND NOT EXISTS (SELECT 1 FROM public.template_exercises te WHERE te.exercise_id = e.id);

-- ---------------------------------------------------------------------------
-- PART 3: tag the untagged bodyweight exercises
-- ---------------------------------------------------------------------------
-- Wide-Grip Rear Pull-Up and Hanging Leg Raise are 'body only' but were left as
-- 'standard', so they demanded a plain weight and offered no assist option.
UPDATE public.exercises
SET weight_type = 'bodyweight'
WHERE id IN (
  '75479290-038c-477f-a209-7f8b7ef20a17',  -- Wide-Grip Rear Pull-Up
  '33330454-1ac1-486f-8b3c-7adaf9df03b5'   -- Hanging Leg Raise
);
