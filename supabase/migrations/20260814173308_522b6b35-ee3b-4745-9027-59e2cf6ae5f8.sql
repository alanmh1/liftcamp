-- 20260814180000_equipment_vocab_row_fixes.sql
-- Equipment tag corrections. Vocabulary is already canonical; these are
-- per-row misassignments. Targets explicit ids, no runtime name matching.
-- Re-runnable: every UPDATE is idempotent and id-scoped.

DO $$
BEGIN

-- Item 1: exercises named Smith* tagged 'machine' (13) or 'barbell' (1).
UPDATE public.exercises e SET equipment = 'smith machine'
FROM (VALUES
  ('e71e5e7f-4433-4eb4-b0ef-63794b3a5a25'::uuid, 'Decline Smith Press'),
  ('4677d455-bc66-4559-b894-f58c7f8f1bf0'::uuid, 'Smith Incline Shoulder Raise'),
  ('8d5b0d6a-029b-4a9f-9a7d-166eebf7d385'::uuid, 'Smith Machine Behind the Back Shrug'),
  ('6bf2305a-c346-40bc-8d40-83ca70ee1e3c'::uuid, 'Smith Machine Close-Grip Bench Press'),
  ('5d54b05f-6207-451f-83f6-790cc00475ae'::uuid, 'Smith Machine Decline Press'),
  ('22c7c283-77ac-4625-ab58-c17debcb75de'::uuid, 'Smith Machine Hang Power Clean'),
  ('bbb3031e-16ff-4af7-903a-205c784f62cf'::uuid, 'Smith Machine Hip Raise'),
  ('5e08167e-a376-489d-a360-e9cd0651b5fc'::uuid, 'Smith Machine Leg Press'),
  ('5492e0ee-1e80-4a6e-a190-618250be8d2d'::uuid, 'Smith Machine One-Arm Upright Row'),
  ('6b98ccc8-b98b-468a-93cf-57dd008b689f'::uuid, 'Smith Machine Overhead Shoulder Press'),
  ('f9ba4815-b23a-48cb-9527-4c39d937cbd3'::uuid, 'Smith Machine Pistol Squat'),
  ('3088e7f8-207d-41b4-a42e-a0de2ee3e03f'::uuid, 'Smith Machine Reverse Calf Raises'),
  ('fdd66e56-f011-40a1-b03a-0d514d1e0e10'::uuid, 'Smith Machine Stiff-Legged Deadlift'),
  ('e6d615e4-fe1e-459a-a702-61c21aa2c2fd'::uuid, 'Smith Single-Leg Split Squat')
) AS t(id, nm) WHERE e.id = t.id AND e.equipment IS DISTINCT FROM 'smith machine';

-- Item 3a: bodyweight push-up tagged 'body only', actually uses a dumbbell.
UPDATE public.exercises e SET equipment = 'dumbbell'
FROM (VALUES
  ('6a57407e-de26-4587-9c97-67e51d10ad2b'::uuid, 'Close-Grip Push-Up off of a Dumbbell')
) AS t(id, nm) WHERE e.id = t.id AND e.equipment IS DISTINCT FROM 'dumbbell';

-- Item 3b: crunch performed on an exercise ball, tagged 'body only'.
UPDATE public.exercises e SET equipment = 'exercise ball'
FROM (VALUES
  ('ecd025a0-b578-4205-b527-75f2a242bf21'::uuid, 'Crunch - Legs On Exercise Ball')
) AS t(id, nm) WHERE e.id = t.id AND e.equipment IS DISTINCT FROM 'exercise ball';

-- Item 2, Group A + wall drills + Trail Running: no equipment required.
UPDATE public.exercises e SET equipment = 'body only'
FROM (VALUES
  ('ae42c7ef-e7b0-468f-9b28-3c2648e54cd6'::uuid, 'Adductor/Groin'),
  ('2f1517e7-e54d-4397-97b0-fa13d8bbe8d9'::uuid, 'Alternate Leg Diagonal Bound'),
  ('b8e49c88-d7ff-4565-8776-774f931ff06e'::uuid, 'Ankle Circles'),
  ('e543b518-8b52-4e86-a330-f572f0600145'::uuid, 'Ankle On The Knee'),
  ('47f74075-3805-4548-b56e-f50ca8b1bae3'::uuid, 'Arm Circles'),
  ('ec11c1d9-ed7a-49a1-8d4a-ee380fc7ceec'::uuid, 'Bodyweight Walking Lunge'),
  ('300e1367-a5f6-4465-88a9-27f1ee2b8ca2'::uuid, 'Calf Stretch Elbows Against Wall'),
  ('c817fa38-112a-4dfc-8148-cfa78c11b1f4'::uuid, 'Calf Stretch Hands Against Wall'),
  ('4dbc5db9-39b2-4e11-bf6c-228a292fead2'::uuid, 'Carioca Quick Step'),
  ('f6063cb6-7a89-449b-ae5e-360ee4120487'::uuid, 'Cat Stretch'),
  ('e4c84ca4-87fa-49ae-8c2a-fe8978303f13'::uuid, 'Child''s Pose'),
  ('2d8f2234-6993-4b9d-8144-10e3f522636d'::uuid, 'Chin To Chest Stretch'),
  ('f2afdc33-9742-425d-a653-c038ff8043ca'::uuid, 'Crossover Reverse Lunge'),
  ('f562d1a4-fd14-4089-b3b0-08ff07970688'::uuid, 'Dancer''s Stretch'),
  ('f4a1d6bd-5446-4062-abb6-baa1b9b086f5'::uuid, 'Dynamic Back Stretch'),
  ('de0de4d3-fc55-4b59-aa1f-dca3f060869b'::uuid, 'Dynamic Chest Stretch'),
  ('86528632-25e7-425d-9782-8a09866d132e'::uuid, 'Elbow Circles'),
  ('1e95752c-cc01-4ffc-8c65-4d2d49f120ff'::uuid, 'Elbows Back'),
  ('af8dc3ad-bffd-4ca3-b6b0-93c7b6ddc200'::uuid, 'Frog Hops'),
  ('dba86378-e8a9-427d-8002-b74459be559a'::uuid, 'Groin and Back Stretch'),
  ('74b6d802-9794-4dce-856f-8f3441dbe087'::uuid, 'Hamstring Stretch'),
  ('035dc1db-6ab6-4dbd-9cbc-191092482b5f'::uuid, 'Hug Knees To Chest'),
  ('ca53fabd-5147-406c-b760-e58a50a8c973'::uuid, 'Iron Crosses (stretch)'),
  ('ca1d2114-8dc4-49a3-949a-7e5a3f65247d'::uuid, 'Knee Across The Body'),
  ('e57525ea-6208-4b29-9d76-5442b2f9f125'::uuid, 'Kneeling Arm Drill'),
  ('2d2a461a-4cc6-4b5a-bbde-914dd66f1f04'::uuid, 'Kneeling Forearm Stretch'),
  ('f6a97473-cf3e-401f-80bb-72cca56d079f'::uuid, 'Kneeling Hip Flexor'),
  ('9005b116-a637-45bd-91f3-b099ec418164'::uuid, 'Leg-Up Hamstring Stretch'),
  ('aba31aaa-ff3e-42a9-b3d1-abb2e1ed41f0'::uuid, 'Linear 3-Part Start Technique'),
  ('4385d06f-3966-4904-b732-859a10ddf68c'::uuid, 'Linear Acceleration Wall Drill'),
  ('eb16d5d7-b5c8-41ac-9841-b490764bdd67'::uuid, 'Looking At Ceiling'),
  ('3153de3c-114b-4889-8ad6-bde367592317'::uuid, 'Middle Back Stretch'),
  ('3b8e41fe-27c7-4d4e-87f9-8387f58c237a'::uuid, 'Mountain Climbers'),
  ('302f79b7-c09e-4388-a79d-7a1b88afded5'::uuid, 'Moving Claw Series'),
  ('a8c69e25-4521-41d7-adce-f3ff64a9df12'::uuid, 'On Your Side Quad Stretch'),
  ('51345657-4057-4f48-bd0d-818713ac8ba5'::uuid, 'One Arm Against Wall'),
  ('1e8058c9-4477-4abf-87ac-1e44e6f41d5e'::uuid, 'One Half Locust'),
  ('a8dde137-d337-4697-b16a-924dd0947516'::uuid, 'One Knee To Chest'),
  ('96dc8c7a-af59-4dea-a279-7e7d47800e8a'::uuid, 'Overhead Stretch'),
  ('50312912-4b48-443f-a72a-f7d8dde81460'::uuid, 'Pelvic Tilt Into Bridge'),
  ('0be5803f-8407-4e5f-9269-b8a79040c1ec'::uuid, 'Runner''s Stretch'),
  ('f5262123-b441-489a-9040-32b3ce70ad0b'::uuid, 'Seated Calf Stretch'),
  ('0b79bc60-0d54-4733-8d5a-98b17f5a38ba'::uuid, 'Seated Floor Hamstring Stretch'),
  ('ecb9bec2-0fb7-4950-8ba0-ac5b36d62b8f'::uuid, 'Seated Hamstring'),
  ('487fd9cf-aa1b-4cec-bc25-0da2c008194c'::uuid, 'Seated Overhead Stretch'),
  ('1076a560-6eac-4209-8d03-a42bd811f5e1'::uuid, 'Shoulder Circles'),
  ('7ec502fc-4e01-4ef5-93c6-0a5f146c207d'::uuid, 'Shoulder Raise'),
  ('ffbe0e67-4e42-4ab9-a5a4-7908cdab8e62'::uuid, 'Shoulder Stretch'),
  ('c3654f66-a908-4ea6-aa79-d3fb7fb7647b'::uuid, 'Side Lying Groin Stretch'),
  ('08cafc47-254f-4d10-8c82-63ab8800ad3b'::uuid, 'Side Neck Stretch'),
  ('b00364fa-0c50-4a93-b780-2557a2b9aa22'::uuid, 'Side Standing Long Jump'),
  ('d96d586d-b2ea-4779-b49d-62d6b6cffbb8'::uuid, 'Side Wrist Pull'),
  ('94945654-c5c4-4d1c-b2d1-d252c515a4b5'::uuid, 'Side-Lying Floor Stretch'),
  ('344e0341-9a51-46e3-b424-755494c6977d'::uuid, 'Sit Squats'),
  ('fae90940-f8ff-498f-a33c-0e4cdab4b8a2'::uuid, 'Spinal Stretch'),
  ('451a9b82-e045-454a-8d45-5ba1353abb1b'::uuid, 'Split Squats'),
  ('5ead0d22-683a-42c1-a7f2-4124a744a39e'::uuid, 'Standing Gastrocnemius Calf Stretch'),
  ('cda5b717-9dad-432b-86ca-026e5c67a338'::uuid, 'Standing Hip Flexors'),
  ('cc066a65-ef05-4cde-a591-da89aca6d47c'::uuid, 'Standing Lateral Stretch'),
  ('c32e276a-c953-4511-aff0-adfc3a374339'::uuid, 'Standing Pelvic Tilt'),
  ('91cf5ffb-a68e-424b-8501-608bf8e72a96'::uuid, 'Standing Soleus And Achilles Stretch'),
  ('9080c460-afed-4f32-b64f-bc9169504e6b'::uuid, 'Standing Toe Touches'),
  ('3dab058d-a3da-482b-8536-accdb3630aa4'::uuid, 'The Straddle'),
  ('c87881af-1102-4c16-93b8-8bba177b88ac'::uuid, 'Trail Running/Walking'),
  ('f4a03682-c62f-4018-a70e-2a76ee3aed5b'::uuid, 'Tricep Side Stretch'),
  ('98311d2a-95e6-4e67-8718-379c0ff18ebe'::uuid, 'Triceps Stretch'),
  ('31051f78-094b-47a6-9ecf-409e1528c24e'::uuid, 'Upper Back Stretch'),
  ('93868c3f-f34d-471b-9819-d622f0d38554'::uuid, 'Upper Back-Leg Grab'),
  ('c8e7c5e3-0e0b-4475-9aa5-07dafc14c2db'::uuid, 'Upward Stretch'),
  ('2de2a4ea-416d-42fe-a3b1-2473c633500a'::uuid, 'Windmills'),
  ('e6a1eaf9-01a4-4580-8afd-d7cc66d20f85'::uuid, 'World''s Greatest Stretch')
) AS t(id, nm) WHERE e.id = t.id AND e.equipment IS DISTINCT FROM 'body only';

-- Item 2, chair + apparatus rows: needs a bar, bench, chair or partner.
UPDATE public.exercises e SET equipment = 'other'
FROM (VALUES
  ('18fee37e-745e-4156-8c48-f98db3a512fa'::uuid, 'Chair Lower Back Stretch'),
  ('f8d013bc-e091-42ad-a796-546fcd7ffe8e'::uuid, 'Decline Push-Up'),
  ('159512a5-9e70-4f6a-859f-263acb4dc061'::uuid, 'Floor Glute-Ham Raise'),
  ('8158e7bf-fd93-43ea-bec0-1d822e456ea6'::uuid, 'Inverted Row'),
  ('8ce4808a-8cc1-467b-90f7-2a2d4c5ae3db'::uuid, 'Prone Manual Hamstring'),
  ('ae9cc78d-0d08-41d1-971b-45ec5c4b38b9'::uuid, 'Scapular Pull-Up')
) AS t(id, nm) WHERE e.id = t.id AND e.equipment IS DISTINCT FROM 'other';

END $$;