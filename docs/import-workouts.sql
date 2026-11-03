-- Workout import: the exercise name map and the import function.
-- Run in the Supabase SQL editor before merging import-workouts. Safe to run twice.

-- 1. Name map. One row per exercise name in another app's export.
--    close = true marks a near variant, shown as "Close match" on the review screen.
CREATE TABLE IF NOT EXISTS public.import_exercise_map (
  source text NOT NULL CHECK (source IN ('fitbod', 'strong', 'hevy')),
  source_name text NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises (id),
  close boolean NOT NULL DEFAULT false,
  PRIMARY KEY (source, source_name)
);
ALTER TABLE public.import_exercise_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import map readable" ON public.import_exercise_map;
CREATE POLICY "import map readable" ON public.import_exercise_map FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.import_exercise_map TO authenticated;

-- 2. Fitbod names, 147 rows, from tester Justin's export (Nov 2026).
INSERT INTO public.import_exercise_map (source, source_name, exercise_id, close) VALUES
  ('fitbod', 'Ab Crunch Machine', '3d3fa7b4-78bb-412c-b6f8-52a1dd374ac1', false),
  ('fitbod', 'Alternating Superman', '190ed825-f7db-4e9b-ac63-2e75913e0cc1', true),
  ('fitbod', 'Arnold Dumbbell Press', '0f559379-49f3-44b5-a02a-11f42e20047d', false),
  ('fitbod', 'Back Extensions', 'dcf87728-cb73-413e-8f79-5c4ff4d6774f', false),
  ('fitbod', 'Back Squat', '85495e85-bd72-445d-a6c8-5961f17ec2e5', false),
  ('fitbod', 'Barbell Back Squat with Deep Partial Squat', '85495e85-bd72-445d-a6c8-5961f17ec2e5', true),
  ('fitbod', 'Barbell Bench Press', 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', false),
  ('fitbod', 'Barbell Curl', '5bed9c3c-fda3-4d55-86ce-5cc2a804492b', false),
  ('fitbod', 'Barbell Hip Thrust', 'e0980266-4bfe-4722-9eca-57a18d0ad1b1', false),
  ('fitbod', 'Barbell Lunge', '588caa20-97a6-4217-a115-e3ad7434a329', false),
  ('fitbod', 'Behind the Back Cable Bicep Curl', '3e6d3e07-beaa-42fb-bb18-1b956f1c82d2', true),
  ('fitbod', 'Bent Over Barbell Row', '7492d613-b2ff-41c0-9131-af0bb9832438', false),
  ('fitbod', 'Bicycle Crunch', '9a315ccb-72d2-4dd9-a932-3b95b8000a12', false),
  ('fitbod', 'Cable Face Pull', '2d7d0ac0-bde1-40e5-8eda-233c4953a094', false),
  ('fitbod', 'Cable Front Raise', '7bf35745-7c56-433e-9eaf-e5e4810334cb', false),
  ('fitbod', 'Cable Hip Extension', 'f1a56047-11ae-4933-bfc0-c40cec277690', true),
  ('fitbod', 'Cable Lateral Raise', '4af5a5ca-2bc1-4cd5-b2cd-acb816dc1c94', true),
  ('fitbod', 'Cable One Arm Tricep Side Extension', '79a21387-945d-4eb0-be47-a0d2e4411adc', true),
  ('fitbod', 'Cable Pull Through', '570c24c1-8ce1-4825-9c35-921d20071abc', false),
  ('fitbod', 'Cable Rope Hammer Curls', '02a611fb-383e-4725-b134-d7a139101a0e', false),
  ('fitbod', 'Cable Rope Overhead Triceps Extension', '2b088c7d-06a4-4def-b8b8-3923fed503ad', false),
  ('fitbod', 'Cable Rope Tricep Extension', '470c1ecb-4e83-4295-a23e-7973006f316d', false),
  ('fitbod', 'Cable Row', '9f94e87f-9afc-4a49-b4b3-feba0a560e27', false),
  ('fitbod', 'Cable Shoulder Press', '7f58c6e7-371a-49fd-a423-157e73001970', false),
  ('fitbod', 'Cable Tricep Pushdown', 'ff125b68-7808-49db-9a7b-da3db74fdef4', false),
  ('fitbod', 'Clean Deadlift', '4aebfd8d-259c-4af8-8338-712014112ba0', false),
  ('fitbod', 'Close-Grip Bench Press', 'b995af1d-b83a-45cb-8d89-1f7761003d13', false),
  ('fitbod', 'Concentration Curl', '2814340e-d3d0-4060-ac0b-57219da15ff4', false),
  ('fitbod', 'Cross Body Hammer Curls', 'ff7bf8a7-c885-4bed-ab69-ed55f8c2e4bf', false),
  ('fitbod', 'Crunches', '008baae1-21d9-4672-ab3f-c8b2da99cda6', false),
  ('fitbod', 'Cycling', 'be6db5d7-9787-451c-a9c0-e4591190c92f', false),
  ('fitbod', 'Cycling - Stationary', 'ce8a0d3b-59ce-4814-897e-8c171833c3ca', false),
  ('fitbod', 'Deadlift', '034ebb98-56b3-4073-a726-1709d14b4455', false),
  ('fitbod', 'Dumbbell Back Fly', 'b974386a-dc66-4eec-a8bf-8ec25e4f1746', true),
  ('fitbod', 'Dumbbell Bench Press', '05510482-9385-455f-85b4-96aef279939c', false),
  ('fitbod', 'Dumbbell Bent Over Reverse Fly', 'b974386a-dc66-4eec-a8bf-8ec25e4f1746', true),
  ('fitbod', 'Dumbbell Bent Over Row', 'a85860d0-706c-4e88-b20a-bb15eb308822', false),
  ('fitbod', 'Dumbbell Bicep Curl', 'd02def38-ea29-4bbb-87ff-8da1e23f2afe', false),
  ('fitbod', 'Dumbbell Bulgarian Split Squat', 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', false),
  ('fitbod', 'Dumbbell Clean', '49f5cc66-afa3-4d50-bf03-1526a5f972a2', false),
  ('fitbod', 'Dumbbell Decline Bench Press', 'e00c312b-9a42-4674-9c90-e4f3fb5ac617', false),
  ('fitbod', 'Dumbbell Deficit Reverse Lunge', '5e6a36e9-0fdb-4bdb-8ee7-0e619624ad16', true),
  ('fitbod', 'Dumbbell Floor Press', '11d89e96-e7f6-49eb-b673-40eb98736b63', false),
  ('fitbod', 'Dumbbell Fly', '80f60581-67e4-444b-88bd-a455d07fed69', false),
  ('fitbod', 'Dumbbell Front Raise', '3db0c025-9191-4bae-9560-1e274d71ae85', false),
  ('fitbod', 'Dumbbell Glute Bridge', '0f2b1238-5acf-455c-9770-884152c6be7d', true),
  ('fitbod', 'Dumbbell Hip Thrust', 'c67f5050-77ad-42de-8a61-36515b915869', false),
  ('fitbod', 'Dumbbell Incline Bench Press', '6ab07ffd-b583-4680-ba41-078eb95b3454', false),
  ('fitbod', 'Dumbbell Kickbacks', 'f596a494-345a-466c-885e-7ce55e8762bf', false),
  ('fitbod', 'Dumbbell Lateral Raise', '463a3682-c764-4971-a1fc-db0e925d0735', false),
  ('fitbod', 'Dumbbell Lateral Raise To Front Raise', '97169019-d033-4ba2-a120-de6c84e399e5', false),
  ('fitbod', 'Dumbbell Lunge', '91ca5bfe-50dd-4fba-9b7b-b342077c9bd4', false),
  ('fitbod', 'Dumbbell Rear Delt Raise', 'b974386a-dc66-4eec-a8bf-8ec25e4f1746', false),
  ('fitbod', 'Dumbbell Romanian Deadlift', 'f5521250-381d-4aec-819c-833202e1d481', false),
  ('fitbod', 'Dumbbell Row', '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', false),
  ('fitbod', 'Dumbbell Shoulder Press', '6db0743b-b1be-4071-b663-af358c7f47bb', false),
  ('fitbod', 'Dumbbell Skullcrusher', '37e89840-cca5-4e8d-b8ac-31ed7dcec252', false),
  ('fitbod', 'Dumbbell Squat', '8f6f1a53-8fed-4c3b-8713-8d44e030c3a6', false),
  ('fitbod', 'Dumbbell Sumo Squat', 'f0badbc1-5584-4b59-a640-87797f341286', false),
  ('fitbod', 'Dumbbell Superman', '190ed825-f7db-4e9b-ac63-2e75913e0cc1', true),
  ('fitbod', 'Dumbbell Tricep Extension', 'd9899985-a114-4200-af3d-fbd9a1ecf6ee', false),
  ('fitbod', 'Dumbbell Upright Row', 'c17f07b6-7ae7-4ab9-9a85-71e8f4d2e46b', false),
  ('fitbod', 'Dumbbell Wide Curls', 'd02def38-ea29-4bbb-87ff-8da1e23f2afe', true),
  ('fitbod', 'EZ-Bar Curl', '9c991d4a-16a6-4c71-96b4-a10d7cba257b', false),
  ('fitbod', 'EZ-Bar Overhead Tricep Extension', 'bce73dbb-d5c6-4fdf-ba4b-0ef3be1bb2e4', true),
  ('fitbod', 'Elliptical', '84c1646e-fff3-4ee4-94c7-deae2e961d6f', false),
  ('fitbod', 'Front Squat', 'f37d03ea-540c-48ca-9da6-8eb1102b6d45', false),
  ('fitbod', 'Good Morning', '95e3b3b1-db35-4227-8c66-179f952f80af', false),
  ('fitbod', 'Hack Squat', '388431f8-a3da-4015-9655-15508cf03799', false),
  ('fitbod', 'Hammer Curls', '52f54e89-69d2-4fd5-ac03-9244b582570a', false),
  ('fitbod', 'Hand Release Push Up', '9d7eb3e6-9f33-422d-b3b6-de5eaa503982', true),
  ('fitbod', 'Hip Thrust', 'e0980266-4bfe-4722-9eca-57a18d0ad1b1', false),
  ('fitbod', 'Hip Thrust Machine', 'aa5d5c40-ccbc-45f9-9226-391ac205658d', false),
  ('fitbod', 'Incline Back Extension', 'dcf87728-cb73-413e-8f79-5c4ff4d6774f', true),
  ('fitbod', 'Incline Barbell Skull Crusher', '7ee86358-b1c7-4249-967e-8bd15dceb63a', false),
  ('fitbod', 'Incline Dumbbell Curl', '7b1f2e56-1d5e-4ebe-983a-3793f812a27c', false),
  ('fitbod', 'Incline Hammer Curl', '73958ce3-10c9-40ee-bf69-f78b42454b57', false),
  ('fitbod', 'Kettlebell Swing American', '22300963-6e44-4393-8d77-f6f622912e3a', true),
  ('fitbod', 'Lat Pulldown', '653288a1-8c39-4840-a2bc-c6eb64790c82', false),
  ('fitbod', 'Leg Extension', '22023c4b-535d-4d9e-a77f-274fd91fa8b4', false),
  ('fitbod', 'Leg Press', 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', false),
  ('fitbod', 'Leg Press Glute Activation', 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', true),
  ('fitbod', 'Leg Pull-In', '183af4a8-a876-4851-a3e3-a384056457d0', false),
  ('fitbod', 'Leg Raise', '95a0610d-7b79-4bb0-8248-5cef4ca24392', false),
  ('fitbod', 'Loop Band Good Morning', '9502bad4-6947-420f-a21e-957db0d72004', false),
  ('fitbod', 'Loop Band Lat Pulldown', '31c27849-7dbe-431c-bcf7-2b9d241f2b78', false),
  ('fitbod', 'Loop Band Romanian Deadlift', '5868ef11-764d-4ad9-840e-13cb4f824555', false),
  ('fitbod', 'Low Cable Chest Fly', '8b19d791-c73e-4a82-9bcb-9e51e6b849b4', false),
  ('fitbod', 'Lying Hamstrings Curl', '5d45e185-8637-4a37-98f3-868513644bed', false),
  ('fitbod', 'Machine Bench Press', 'f49adb7f-68a1-4f99-a93f-c22fc083f46d', false),
  ('fitbod', 'Machine Fly', '342f27d1-ed94-4c99-a606-e2a237a105ef', false),
  ('fitbod', 'Machine Hip Abductor', 'a03553a8-a718-47b1-8878-34f93f53e8c1', false),
  ('fitbod', 'Machine Hip Adductor', 'dd174b78-a2b2-483b-a9f8-98142c4f5deb', false),
  ('fitbod', 'Machine Lateral Raise', 'e0173d84-7f8e-4149-ab85-974b55ec93b5', false),
  ('fitbod', 'Machine Leg Press', 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', false),
  ('fitbod', 'Machine Rear Delt Fly', '4cb0f37a-b602-439b-ac80-eee4a711c5e3', false),
  ('fitbod', 'Machine Row', '0a9d5484-f897-435d-849b-0c809d67d446', false),
  ('fitbod', 'Machine Shoulder Press', 'fa4d95dd-0bc0-4225-a3f6-e97413c0d3c5', false),
  ('fitbod', 'Machine Tricep Dip', 'fd042fd4-2193-4ca4-a4fa-b1b063f263b2', false),
  ('fitbod', 'Mid Cable Crossover Fly', '9e3c1a8f-028b-41ad-bfe3-ae58a5ce3cdc', false),
  ('fitbod', 'Mini Loop Band Kneeling Bicep Curl', '7a3508bb-5314-4b6e-9fc3-3adf60482908', true),
  ('fitbod', 'One Arm Cable Tricep Extension', '79a21387-945d-4eb0-be47-a0d2e4411adc', false),
  ('fitbod', 'Overhead Dumbbell Lunge', '91ca5bfe-50dd-4fba-9b7b-b342077c9bd4', true),
  ('fitbod', 'Palms-Down Dumbbell Wrist Curl', '84e6b2a9-7f14-4f9c-881b-fade9c14a3a1', false),
  ('fitbod', 'Plank', 'c0f86c40-21ec-4135-bef6-908d2bc3154b', false),
  ('fitbod', 'Preacher Curl', '26b61579-6af1-4ee5-9f6e-be5ac598a140', false),
  ('fitbod', 'Push Up', '9d7eb3e6-9f33-422d-b3b6-de5eaa503982', false),
  ('fitbod', 'Push Up on Knees', '72a1f0b7-3e1a-4f61-8c6f-cf9f357104f4', false),
  ('fitbod', 'Renegade Row', '52d1bd6b-9a37-4785-a55f-63ca99b8a352', false),
  ('fitbod', 'Reverse Barbell Curl', '24943b5d-1b35-4662-b1dc-f0ad3532985b', false),
  ('fitbod', 'Reverse Grip Barbell Bent Over Row', '87ba6f8a-6251-4a18-9416-b606c4d949f8', false),
  ('fitbod', 'Reverse Grip Pull Down', '708ed2d1-34b5-40a4-8fcb-f8713bfb87fb', false),
  ('fitbod', 'Romanian Deadlift', '21e9e394-1151-4a07-bb3a-2fd487e461dd', false),
  ('fitbod', 'Running', 'c87881af-1102-4c16-93b8-8bba177b88ac', true),
  ('fitbod', 'Running - Treadmill', 'e9f243ca-158a-4479-966f-8a4dcf5318c4', false),
  ('fitbod', 'Seated Back Extension', 'dcf87728-cb73-413e-8f79-5c4ff4d6774f', true),
  ('fitbod', 'Seated Dumbbell Curl', 'b975eec9-0b8e-467b-8a9c-e829b8b7ba34', false),
  ('fitbod', 'Seated Hammer Curl', '52f54e89-69d2-4fd5-ac03-9244b582570a', true),
  ('fitbod', 'Seated Lateral Raise', 'ce782009-68be-4548-96d1-a01931d46ea4', false),
  ('fitbod', 'Seated Leg Curl', '574856f1-10ef-4549-b3e9-7a17781d0298', false),
  ('fitbod', 'Single Arm Cable Crossover', 'bf393e8c-420c-4550-afe5-c4c42fc62315', false),
  ('fitbod', 'Single Arm Dumbbell Tricep Extension', 'ba04d7e5-70a6-4031-a941-12238aef452d', false),
  ('fitbod', 'Single Arm Lat Pulldown', '989ebb7f-f62e-44a7-acc8-063285c85761', false),
  ('fitbod', 'Single Arm Overhead Cable Tricep Extension', '6cacd1bf-b900-4468-a2b0-cef60f2dbae4', true),
  ('fitbod', 'Single Arm Rear Delt Fly', '26ec787f-6ea1-494c-a3d1-a2526eeabc73', false),
  ('fitbod', 'Single Leg Glute Bridge', '6ba8aad6-b38d-432a-a1b3-393a740d03d6', false),
  ('fitbod', 'Single Leg Hip Thrust', '6ba8aad6-b38d-432a-a1b3-393a740d03d6', true),
  ('fitbod', 'Single Leg Kickback', 'c55f3000-77c2-426e-84e0-2b95199a7fe7', true),
  ('fitbod', 'Single Leg Romanian Deadlift', '4e6238a7-6cfc-42be-86f4-f9f6bafd60f7', false),
  ('fitbod', 'Skullcrusher', '02fcac11-be6b-468d-9b09-b4a6ce3436ce', false),
  ('fitbod', 'Smith Machine Squat', '228a8d52-4450-4709-afcd-c8e4a34b5747', false),
  ('fitbod', 'Smith Machine Stiff-Legged Deadlift', 'fdd66e56-f011-40a1-b03a-0d514d1e0e10', false),
  ('fitbod', 'Standing Arnold Press', '0f559379-49f3-44b5-a02a-11f42e20047d', true),
  ('fitbod', 'Standing Barbell Calf Raise', '301dab58-5604-4c86-b273-3a3888cbd0c6', false),
  ('fitbod', 'Standing Machine Calf Press', '09e9a230-a675-4796-bee5-13193961b46b', false),
  ('fitbod', 'Stiff-Legged Barbell Good Morning', 'aa0c7a93-dc09-4926-8cf4-4e6113fea271', false),
  ('fitbod', 'Straight-Arm Pulldown', '1ab6197b-758e-425f-afd0-63a1d91bdc0f', false),
  ('fitbod', 'Superman', '190ed825-f7db-4e9b-ac63-2e75913e0cc1', false),
  ('fitbod', 'Superman Hold', '190ed825-f7db-4e9b-ac63-2e75913e0cc1', true),
  ('fitbod', 'Superman with Scaption', '190ed825-f7db-4e9b-ac63-2e75913e0cc1', true),
  ('fitbod', 'T-Bar Row', '0ecc248b-d9a8-47d6-bac4-0ff8c245ff04', false),
  ('fitbod', 'Tricep Push Up', '5a41c467-99d3-429a-9f53-aa283eaccd06', false),
  ('fitbod', 'Upright Row', '6d6793db-4795-4475-8a1e-ce23d07c047d', false),
  ('fitbod', 'V-Bar Pulldown', '39928e6f-6b32-40ff-8f13-d3c284164b86', false),
  ('fitbod', 'Walking', 'c87881af-1102-4c16-93b8-8bba177b88ac', true),
  ('fitbod', 'Walking - Treadmill', '4d74d632-253d-4d87-b8a2-40e04de8e0d6', false),
  ('fitbod', 'Wide Grip Cable Row', '2002c1d2-25c0-404f-b696-0b4dc4b580cb', false)
ON CONFLICT (source, source_name) DO UPDATE SET exercise_id = EXCLUDED.exercise_id, close = EXCLUDED.close;

-- 3. The import. Runs as the caller, so RLS applies to every insert. Takes up to
--    50 workouts per call, each saved whole or not at all (the call is one
--    transaction). A workout whose start time is already imported from the same
--    source is skipped, so running the same file twice adds nothing.
CREATE OR REPLACE FUNCTION public.import_workouts(p_source text, p_workouts jsonb)
RETURNS TABLE (inserted integer, skipped integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_tag text;
  v_w jsonb;
  v_e jsonb;
  v_wid uuid;
  v_weid uuid;
  v_epos integer;
  v_ins integer := 0;
  v_skip integer := 0;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Importing needs an account';
  END IF;
  IF p_source NOT IN ('fitbod', 'strong', 'hevy') THEN
    RAISE EXCEPTION 'Unknown import source %', p_source;
  END IF;
  IF jsonb_typeof(p_workouts) <> 'array' OR jsonb_array_length(p_workouts) > 50 THEN
    RAISE EXCEPTION 'Send at most 50 workouts per call';
  END IF;
  v_tag := p_source || '-csv';

  FOR v_w IN SELECT value FROM jsonb_array_elements(p_workouts) LOOP
    IF EXISTS (
      SELECT 1 FROM public.workouts x
      WHERE x.user_id = v_uid AND x.app_version = v_tag
        AND x.created_at = (v_w ->> 'created_at')::timestamptz
    ) THEN
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.workouts (user_id, workout_date, created_at, finished_at, name, notes, platform, app_version)
    VALUES (v_uid, (v_w ->> 'workout_date')::date, (v_w ->> 'created_at')::timestamptz,
            (v_w ->> 'finished_at')::timestamptz, NULL, v_w ->> 'notes', 'import', v_tag)
    RETURNING id INTO v_wid;

    v_epos := 0;
    FOR v_e IN SELECT value FROM jsonb_array_elements(v_w -> 'exercises') LOOP
      INSERT INTO public.workout_exercises (workout_id, exercise_id, user_id, position, created_at)
      VALUES (v_wid, (v_e ->> 'exercise_id')::uuid, v_uid, v_epos, (v_w ->> 'created_at')::timestamptz)
      RETURNING id INTO v_weid;

      INSERT INTO public.sets (workout_exercise_id, user_id, position, weight_value, weight_unit, reps,
                               duration_seconds, distance_meters, incline_percent, set_type, note, completed, created_at)
      SELECT v_weid, v_uid, (o.ord - 1)::integer,
             (o.s ->> 'weight')::numeric,
             CASE WHEN o.s ->> 'weight' IS NULL THEN NULL ELSE o.s ->> 'unit' END,
             (o.s ->> 'reps')::integer, (o.s ->> 'duration')::integer,
             (o.s ->> 'distance')::numeric, (o.s ->> 'incline')::numeric,
             o.s ->> 'set_type', nullif(o.s ->> 'note', ''), true, (v_w ->> 'created_at')::timestamptz
      FROM jsonb_array_elements(v_e -> 'sets') WITH ORDINALITY AS o (s, ord);

      v_epos := v_epos + 1;
    END LOOP;
    v_ins := v_ins + 1;
  END LOOP;

  RETURN QUERY SELECT v_ins, v_skip;
END;
$fn$;

REVOKE ALL ON FUNCTION public.import_workouts(text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_workouts(text, jsonb) TO authenticated;

-- Check: expect fitbod_rows 147 and function_ok true.
SELECT (SELECT count(*) FROM public.import_exercise_map WHERE source = 'fitbod') AS fitbod_rows,
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'import_workouts') AS function_ok;
