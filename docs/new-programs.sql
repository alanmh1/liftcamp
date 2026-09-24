-- LiftCamp: ten new system programs, plus Arnold Split copy fixes
-- Run in SUPABASE (SQL editor). Generated 16 Sep 2026 from docs/new-programs.md.
--
-- Safe to run twice: Section 1 skips any program whose slug already exists,
-- and Section 2's updates are idempotent. Exercise ids are literals, resolved
-- by exact name match on exercises on 16 Sep 2026; every name matched one row.
--
-- Section 0: read this first. Every row here must be absent (0 rows) for a
-- clean first run. A slug that appears is skipped by Section 1.

select program_slug, count(*) as existing_variations
from public.templates
where program_slug in ('upper-lower-push-pull-legs', 'torso-limbs', 'volume-light-heavy', 'tiered-strength', 'dumbbell-full-body', 'calisthenics-full-body', 'bands-upper-lower', 'dumbbell-push-pull-legs-6-day', 'two-day-full-body', 'two-day-dumbbell-full-body')
group by program_slug;

-- ---------------------------------------------------------------------------
-- Section 1: the ten programs, one transaction. Each program is one block that
-- inserts its variations and their exercises unless the slug already exists.
-- Variation ids are generated; the block captures them to attach exercises.
-- ---------------------------------------------------------------------------

begin;

-- Upper Lower Push Pull Legs (upper-lower-push-pull-legs): 5 variations, 26 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'upper-lower-push-pull-legs') then
    raise notice 'skipping upper-lower-push-pull-legs: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Upper', true, null, 'Upper Lower Push Pull Legs', 'upper-lower-push-pull-legs', 'Five days a week, each muscle trained twice. Two heavier days for upper and lower body, then push, pull and legs with more volume.', 17, 1, true, null, 'intermediate', 5, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 0, 4, '6-8'),  -- Barbell Bench Press
    (v_id, '7492d613-b2ff-41c0-9131-af0bb9832438', null, 1, 4, '6-8'),  -- Bent Over Barbell Row
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 2, 3, '8-10'),  -- Standing Military Press
    (v_id, '653288a1-8c39-4840-a2bc-c6eb64790c82', null, 3, 3, '8-10'),  -- Wide-Grip Lat Pulldown
    (v_id, '5bed9c3c-fda3-4d55-86ce-5cc2a804492b', null, 4, 2, '10-12'),  -- Barbell Curl
    (v_id, 'ff125b68-7808-49db-9a7b-da3db74fdef4', null, 5, 2, '10-12');  -- Triceps Pushdown

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Lower', true, null, 'Upper Lower Push Pull Legs', 'upper-lower-push-pull-legs', 'Five days a week, each muscle trained twice. Two heavier days for upper and lower body, then push, pull and legs with more volume.', 17, 2, true, null, 'intermediate', 5, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 4, '6-8'),  -- Barbell Squat
    (v_id, '21e9e394-1151-4a07-bb3a-2fd487e461dd', null, 1, 3, '8-10'),  -- Romanian Deadlift
    (v_id, 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', null, 2, 3, '10-12'),  -- Leg Press
    (v_id, '5d45e185-8637-4a37-98f3-868513644bed', null, 3, 3, '10-12'),  -- Lying Hamstring Curl
    (v_id, '09e9a230-a675-4796-bee5-13193961b46b', null, 4, 3, '12-15');  -- Standing Calf Raises

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Push', true, null, 'Upper Lower Push Pull Legs', 'upper-lower-push-pull-legs', 'Five days a week, each muscle trained twice. Two heavier days for upper and lower body, then push, pull and legs with more volume.', 17, 3, true, null, 'intermediate', 5, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '6ab07ffd-b583-4680-ba41-078eb95b3454', null, 0, 4, '8-10'),  -- Incline Dumbbell Press
    (v_id, '6db0743b-b1be-4071-b663-af358c7f47bb', null, 1, 3, '8-10'),  -- Dumbbell Shoulder Press
    (v_id, '61103781-eac4-4bdc-9879-2dd29a51e3db', null, 2, 3, '8-10'),  -- Dips - Chest Version
    (v_id, '463a3682-c764-4971-a1fc-db0e925d0735', null, 3, 3, '12-15'),  -- Side Lateral Raise
    (v_id, '2b088c7d-06a4-4def-b8b8-3923fed503ad', null, 4, 3, '10-12');  -- Triceps Overhead Extension with Rope

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Pull', true, null, 'Upper Lower Push Pull Legs', 'upper-lower-push-pull-legs', 'Five days a week, each muscle trained twice. Two heavier days for upper and lower body, then push, pull and legs with more volume.', 17, 4, true, null, 'intermediate', 5, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '63c49305-7b82-4a51-87bc-9aa379b7e116', null, 0, 4, '6-10'),  -- Chin-Up
    (v_id, '9f94e87f-9afc-4a49-b4b3-feba0a560e27', null, 1, 4, '8-10'),  -- Seated Cable Rows
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 2, 3, '10-12 each'),  -- One-Arm Dumbbell Row
    (v_id, '2d7d0ac0-bde1-40e5-8eda-233c4953a094', null, 3, 3, '12-15'),  -- Face Pull
    (v_id, '7b1f2e56-1d5e-4ebe-983a-3793f812a27c', null, 4, 3, '10-12');  -- Incline Dumbbell Curl

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Legs', true, null, 'Upper Lower Push Pull Legs', 'upper-lower-push-pull-legs', 'Five days a week, each muscle trained twice. Two heavier days for upper and lower body, then push, pull and legs with more volume.', 17, 5, true, null, 'intermediate', 5, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'f37d03ea-540c-48ca-9da6-8eb1102b6d45', null, 0, 3, '8-10'),  -- Front Barbell Squat
    (v_id, 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', null, 1, 3, '8-10 each'),  -- Bulgarian Split Squat
    (v_id, '22023c4b-535d-4d9e-a77f-274fd91fa8b4', null, 2, 3, '12-15'),  -- Leg Extensions
    (v_id, '574856f1-10ef-4549-b3e9-7a17781d0298', null, 3, 3, '12-15'),  -- Seated Hamstring Curl
    (v_id, '935a5844-cc7b-4eb2-a8c7-cd37492d1e73', null, 4, 3, '12-15');  -- Seated Calf Raise
end $$;

-- Torso / Limbs (torso-limbs): 4 variations, 22 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'torso-limbs') then
    raise notice 'skipping torso-limbs: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Torso A', true, null, 'Torso / Limbs', 'torso-limbs', 'An upper and lower split with arms moved to leg day, so the torso days stay short and heavy. Alternate A and B each week.', 18, 1, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 0, 4, '5-8'),  -- Barbell Bench Press
    (v_id, '7492d613-b2ff-41c0-9131-af0bb9832438', null, 1, 4, '6-8'),  -- Bent Over Barbell Row
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 2, 3, '8-10'),  -- Standing Military Press
    (v_id, '653288a1-8c39-4840-a2bc-c6eb64790c82', null, 3, 3, '8-10'),  -- Wide-Grip Lat Pulldown
    (v_id, '2d7d0ac0-bde1-40e5-8eda-233c4953a094', null, 4, 3, '12-15');  -- Face Pull

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Limbs A', true, null, 'Torso / Limbs', 'torso-limbs', 'An upper and lower split with arms moved to leg day, so the torso days stay short and heavy. Alternate A and B each week.', 18, 2, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 4, '5-8'),  -- Barbell Squat
    (v_id, '21e9e394-1151-4a07-bb3a-2fd487e461dd', null, 1, 3, '8-10'),  -- Romanian Deadlift
    (v_id, '5d45e185-8637-4a37-98f3-868513644bed', null, 2, 3, '10-12'),  -- Lying Hamstring Curl
    (v_id, '5bed9c3c-fda3-4d55-86ce-5cc2a804492b', null, 3, 3, '8-10'),  -- Barbell Curl
    (v_id, 'f34d6c21-15cd-4a1f-bfe4-620e2b0e2c97', null, 4, 3, '8-10'),  -- Lying Triceps Press
    (v_id, '09e9a230-a675-4796-bee5-13193961b46b', null, 5, 3, '12-15');  -- Standing Calf Raises

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Torso B', true, null, 'Torso / Limbs', 'torso-limbs', 'An upper and lower split with arms moved to leg day, so the torso days stay short and heavy. Alternate A and B each week.', 18, 3, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '6ab07ffd-b583-4680-ba41-078eb95b3454', null, 0, 4, '8-10'),  -- Incline Dumbbell Press
    (v_id, '9f94e87f-9afc-4a49-b4b3-feba0a560e27', null, 1, 4, '8-10'),  -- Seated Cable Rows
    (v_id, '6db0743b-b1be-4071-b663-af358c7f47bb', null, 2, 3, '8-10'),  -- Dumbbell Shoulder Press
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 3, 3, '10-12 each'),  -- One-Arm Dumbbell Row
    (v_id, '463a3682-c764-4971-a1fc-db0e925d0735', null, 4, 3, '12-15');  -- Side Lateral Raise

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Limbs B', true, null, 'Torso / Limbs', 'torso-limbs', 'An upper and lower split with arms moved to leg day, so the torso days stay short and heavy. Alternate A and B each week.', 18, 4, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '034ebb98-56b3-4073-a726-1709d14b4455', null, 0, 3, '5'),  -- Barbell Deadlift
    (v_id, 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', null, 1, 3, '10-12'),  -- Leg Press
    (v_id, 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', null, 2, 3, '8-10 each'),  -- Bulgarian Split Squat
    (v_id, '52f54e89-69d2-4fd5-ac03-9244b582570a', null, 3, 3, '10-12'),  -- Hammer Curls
    (v_id, 'ff125b68-7808-49db-9a7b-da3db74fdef4', null, 4, 3, '10-12'),  -- Triceps Pushdown
    (v_id, '935a5844-cc7b-4eb2-a8c7-cd37492d1e73', null, 5, 3, '12-15');  -- Seated Calf Raise
end $$;

-- Volume, Light, Heavy (volume-light-heavy): 3 variations, 10 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'volume-light-heavy') then
    raise notice 'skipping volume-light-heavy: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Volume Day', true, null, 'Volume, Light, Heavy', 'volume-light-heavy', 'The next step once 5x5 stops moving. Lots of work at a moderate weight early in the week, a light day in the middle, then one heavy set of 5 to beat last week.', 19, 1, true, null, 'intermediate', 3, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 5, '5'),  -- Barbell Squat
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 1, 5, '5'),  -- Barbell Bench Press
    (v_id, '034ebb98-56b3-4073-a726-1709d14b4455', null, 2, 1, '5');  -- Barbell Deadlift

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Light Day', true, null, 'Volume, Light, Heavy', 'volume-light-heavy', 'The next step once 5x5 stops moving. Lots of work at a moderate weight early in the week, a light day in the middle, then one heavy set of 5 to beat last week.', 19, 2, true, null, 'intermediate', 3, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 2, '5'),  -- Barbell Squat
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 1, 3, '5'),  -- Standing Military Press
    (v_id, '63c49305-7b82-4a51-87bc-9aa379b7e116', null, 2, 3, '8-10'),  -- Chin-Up
    (v_id, 'dcf87728-cb73-413e-8f79-5c4ff4d6774f', null, 3, 3, '10-12');  -- Hyperextensions (Back Extensions)

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Heavy Day', true, null, 'Volume, Light, Heavy', 'volume-light-heavy', 'The next step once 5x5 stops moving. Lots of work at a moderate weight early in the week, a light day in the middle, then one heavy set of 5 to beat last week.', 19, 3, true, null, 'intermediate', 3, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 1, '5'),  -- Barbell Squat
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 1, 1, '5'),  -- Barbell Bench Press
    (v_id, '19c71949-529b-4e2c-a98d-3d4f317ae13d', null, 2, 5, '3');  -- Power Clean
end $$;

-- Tiered Strength (tiered-strength): 4 variations, 12 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'tiered-strength') then
    raise notice 'skipping tiered-strength: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 1', true, null, 'Tiered Strength', 'tiered-strength', 'Each day has one heavy lift, one lighter lift for more reps, and one easy accessory. On the heavy lift, push the last set for as many reps as you can.', 20, 1, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 5, '3'),  -- Barbell Squat
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 1, 3, '10'),  -- Barbell Bench Press
    (v_id, '653288a1-8c39-4840-a2bc-c6eb64790c82', null, 2, 3, '15');  -- Wide-Grip Lat Pulldown

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 2', true, null, 'Tiered Strength', 'tiered-strength', 'Each day has one heavy lift, one lighter lift for more reps, and one easy accessory. On the heavy lift, push the last set for as many reps as you can.', 20, 2, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 0, 5, '3'),  -- Standing Military Press
    (v_id, '034ebb98-56b3-4073-a726-1709d14b4455', null, 1, 3, '10'),  -- Barbell Deadlift
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 2, 3, '15 each');  -- One-Arm Dumbbell Row

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 3', true, null, 'Tiered Strength', 'tiered-strength', 'Each day has one heavy lift, one lighter lift for more reps, and one easy accessory. On the heavy lift, push the last set for as many reps as you can.', 20, 3, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 0, 5, '3'),  -- Barbell Bench Press
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 1, 3, '10'),  -- Barbell Squat
    (v_id, '653288a1-8c39-4840-a2bc-c6eb64790c82', null, 2, 3, '15');  -- Wide-Grip Lat Pulldown

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 4', true, null, 'Tiered Strength', 'tiered-strength', 'Each day has one heavy lift, one lighter lift for more reps, and one easy accessory. On the heavy lift, push the last set for as many reps as you can.', 20, 4, true, null, 'intermediate', 4, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '034ebb98-56b3-4073-a726-1709d14b4455', null, 0, 5, '3'),  -- Barbell Deadlift
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 1, 3, '10'),  -- Standing Military Press
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 2, 3, '15 each');  -- One-Arm Dumbbell Row
end $$;

-- Dumbbell Full Body (dumbbell-full-body): 2 variations, 12 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'dumbbell-full-body') then
    raise notice 'skipping dumbbell-full-body: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Full Body A', true, null, 'Dumbbell Full Body', 'dumbbell-full-body', 'Two full body days with a pair of dumbbells, alternated across three sessions a week. Heavier and longer than Dumbbell Only.', 21, 1, true, null, 'intermediate', 3, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '43284cd1-4bb4-44c7-87b6-617ed5f03dbf', null, 0, 4, '8-10'),  -- Goblet Squat
    (v_id, '05510482-9385-455f-85b4-96aef279939c', null, 1, 4, '6-8'),  -- Dumbbell Bench Press
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 2, 4, '8-10 each'),  -- One-Arm Dumbbell Row
    (v_id, 'f5521250-381d-4aec-819c-833202e1d481', null, 3, 3, '8-10'),  -- Dumbbell Romanian Deadlift
    (v_id, '463a3682-c764-4971-a1fc-db0e925d0735', null, 4, 3, '12-15'),  -- Side Lateral Raise
    (v_id, '52f54e89-69d2-4fd5-ac03-9244b582570a', null, 5, 2, '10-12');  -- Hammer Curls

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Full Body B', true, null, 'Dumbbell Full Body', 'dumbbell-full-body', 'Two full body days with a pair of dumbbells, alternated across three sessions a week. Heavier and longer than Dumbbell Only.', 21, 2, true, null, 'intermediate', 3, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', null, 0, 4, '8-10 each'),  -- Bulgarian Split Squat
    (v_id, '6db0743b-b1be-4071-b663-af358c7f47bb', null, 1, 4, '6-8'),  -- Dumbbell Shoulder Press
    (v_id, 'a85860d0-706c-4e88-b20a-bb15eb308822', null, 2, 4, '8-10'),  -- Bent Over Two-Dumbbell Row
    (v_id, 'c67f5050-77ad-42de-8a61-36515b915869', null, 3, 3, '10-12'),  -- Dumbbell Hip Thrust
    (v_id, '6ab07ffd-b583-4680-ba41-078eb95b3454', null, 4, 3, '8-10'),  -- Incline Dumbbell Press
    (v_id, 'd9899985-a114-4200-af3d-fbd9a1ecf6ee', null, 5, 2, '10-12');  -- Standing Dumbbell Triceps Extension
end $$;

-- Calisthenics Full Body (calisthenics-full-body): 3 variations, 15 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'calisthenics-full-body') then
    raise notice 'skipping calisthenics-full-body: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day A', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 1, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'ec472562-635a-4216-91e9-165a09f623a6', null, 0, 4, '5-8'),  -- Pullups
    (v_id, '61103781-eac4-4bdc-9879-2dd29a51e3db', null, 1, 4, '6-10'),  -- Dips - Chest Version
    (v_id, '451a9b82-e045-454a-8d45-5ba1353abb1b', null, 2, 3, '10-12 each'),  -- Split Squats
    (v_id, '6ba8aad6-b38d-432a-a1b3-393a740d03d6', null, 3, 3, '10-12 each'),  -- Single Leg Glute Bridge
    (v_id, '33330454-1ac1-486f-8b3c-7adaf9df03b5', null, 4, 3, '8-12');  -- Hanging Leg Raise

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day B', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 2, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '63c49305-7b82-4a51-87bc-9aa379b7e116', null, 0, 4, '5-8'),  -- Chin-Up
    (v_id, '0c97a268-f6b4-45e8-9a09-72803400ef74', null, 1, 4, '6-10'),  -- Pike Push-Up
    (v_id, 'ec11c1d9-ed7a-49a1-8d4a-ee380fc7ceec', null, 2, 3, '10-12 each'),  -- Bodyweight Walking Lunge
    (v_id, '8158e7bf-fd93-43ea-bec0-1d822e456ea6', null, 3, 3, '8-12'),  -- Inverted Row
    (v_id, 'c0f86c40-21ec-4135-bef6-908d2bc3154b', null, 4, 3, '45s');  -- Plank

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day C', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 3, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '8158e7bf-fd93-43ea-bec0-1d822e456ea6', null, 0, 4, '8-12'),  -- Inverted Row
    (v_id, '9d7eb3e6-9f33-422d-b3b6-de5eaa503982', null, 1, 4, '10-15'),  -- Pushups
    (v_id, '5c81a81d-cee6-4be5-96fd-3ddb65eeea00', null, 2, 4, '15-20'),  -- Bodyweight Squat
    (v_id, '190ed825-f7db-4e9b-ac63-2e75913e0cc1', null, 3, 3, '10-12'),  -- Superman
    (v_id, '3b8e41fe-27c7-4d4e-87f9-8387f58c237a', null, 4, 3, '20');  -- Mountain Climbers
end $$;

-- Bands Upper / Lower (bands-upper-lower): 2 variations, 12 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'bands-upper-lower') then
    raise notice 'skipping bands-upper-lower: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Upper', true, null, 'Bands Upper / Lower', 'bands-upper-lower', 'An upper and lower split with resistance bands and your bodyweight. Use a heavier band when the top of the rep range feels easy.', 23, 1, true, null, 'intermediate', 4, 'bands')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '27081313-a62d-4102-acd8-55ca0e55a887', null, 0, 4, '10-15'),  -- Bench Press with Bands
    (v_id, '3a210bb3-53a0-4cfc-826d-b171d291fc15', null, 1, 4, '10-15'),  -- Banded Bent Over Row
    (v_id, 'ec541d66-68ed-4a5c-858f-cf7a9d0a5c8f', null, 2, 3, '10-12'),  -- Shoulder Press - With Bands
    (v_id, '31c27849-7dbe-431c-bcf7-2b9d241f2b78', null, 3, 3, '10-15'),  -- Banded Lat Pulldown
    (v_id, '9d7eb3e6-9f33-422d-b3b6-de5eaa503982', null, 4, 3, '8-15'),  -- Pushups
    (v_id, '57ecfc0d-f8d0-4cd8-95fe-c8192526af66', null, 5, 3, '15-20');  -- Band Pull Apart

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Lower', true, null, 'Bands Upper / Lower', 'bands-upper-lower', 'An upper and lower split with resistance bands and your bodyweight. Use a heavier band when the top of the rep range feels easy.', 23, 2, true, null, 'intermediate', 4, 'bands')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'f3d77cb1-d520-4a3d-91e7-87d2c264f999', null, 0, 4, '12-15'),  -- Squats with Bands
    (v_id, '5868ef11-764d-4ad9-840e-13cb4f824555', null, 1, 4, '10-12'),  -- Banded Romanian Deadlift
    (v_id, '451a9b82-e045-454a-8d45-5ba1353abb1b', null, 2, 3, '10-12 each'),  -- Split Squats
    (v_id, '6ba8aad6-b38d-432a-a1b3-393a740d03d6', null, 3, 3, '12 each'),  -- Single Leg Glute Bridge
    (v_id, 'b1b49aba-4d39-4019-8543-5197a6b1ad06', null, 4, 3, '15-20'),  -- Bodyweight Calf Raise
    (v_id, 'c0f86c40-21ec-4135-bef6-908d2bc3154b', null, 5, 3, '45s');  -- Plank
end $$;

-- Dumbbell Push Pull Legs 6 Day (dumbbell-push-pull-legs-6-day): 6 variations, 30 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'dumbbell-push-pull-legs-6-day') then
    raise notice 'skipping dumbbell-push-pull-legs-6-day: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Push A', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 1, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '05510482-9385-455f-85b4-96aef279939c', null, 0, 4, '6-8'),  -- Dumbbell Bench Press
    (v_id, '6db0743b-b1be-4071-b663-af358c7f47bb', null, 1, 3, '8-10'),  -- Dumbbell Shoulder Press
    (v_id, '6ab07ffd-b583-4680-ba41-078eb95b3454', null, 2, 3, '8-10'),  -- Incline Dumbbell Press
    (v_id, '463a3682-c764-4971-a1fc-db0e925d0735', null, 3, 3, '12-15'),  -- Side Lateral Raise
    (v_id, '572fc426-31a2-4582-961d-f92e9d782ef4', null, 4, 3, '10-12');  -- Seated Triceps Press

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Pull A', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 2, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 0, 4, '6-8 each'),  -- One-Arm Dumbbell Row
    (v_id, 'a85860d0-706c-4e88-b20a-bb15eb308822', null, 1, 3, '8-10'),  -- Bent Over Two-Dumbbell Row
    (v_id, 'e4e2de46-7e93-4a41-8f56-f4b2b98115f4', null, 2, 3, '12-15'),  -- Reverse Flyes
    (v_id, '7b1f2e56-1d5e-4ebe-983a-3793f812a27c', null, 3, 3, '10-12'),  -- Incline Dumbbell Curl
    (v_id, '52f54e89-69d2-4fd5-ac03-9244b582570a', null, 4, 3, '10-12');  -- Hammer Curls

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Legs A', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 3, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '43284cd1-4bb4-44c7-87b6-617ed5f03dbf', null, 0, 4, '8-10'),  -- Goblet Squat
    (v_id, 'f5521250-381d-4aec-819c-833202e1d481', null, 1, 4, '8-10'),  -- Dumbbell Romanian Deadlift
    (v_id, 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', null, 2, 3, '8-10 each'),  -- Bulgarian Split Squat
    (v_id, '4433df75-1d5a-4ad1-a252-93b67398c2e5', null, 3, 4, '12-15');  -- Standing Dumbbell Calf Raise

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Push B', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 4, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '6ab07ffd-b583-4680-ba41-078eb95b3454', null, 0, 4, '6-8'),  -- Incline Dumbbell Press
    (v_id, '80f60581-67e4-444b-88bd-a455d07fed69', null, 1, 3, '10-12'),  -- Dumbbell Flyes
    (v_id, 'ce782009-68be-4548-96d1-a01931d46ea4', null, 2, 3, '12-15'),  -- Seated Side Lateral Raise
    (v_id, 'd9899985-a114-4200-af3d-fbd9a1ecf6ee', null, 3, 3, '10-12'),  -- Standing Dumbbell Triceps Extension
    (v_id, 'f596a494-345a-466c-885e-7ce55e8762bf', null, 4, 3, '12-15');  -- Tricep Dumbbell Kickback

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Pull B', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 5, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'a85860d0-706c-4e88-b20a-bb15eb308822', null, 0, 4, '8-10'),  -- Bent Over Two-Dumbbell Row
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 1, 3, '10-12 each'),  -- One-Arm Dumbbell Row
    (v_id, 'e4e2de46-7e93-4a41-8f56-f4b2b98115f4', null, 2, 3, '15'),  -- Reverse Flyes
    (v_id, 'd02def38-ea29-4bbb-87ff-8da1e23f2afe', null, 3, 3, '10-12'),  -- Dumbbell Bicep Curl
    (v_id, '52f54e89-69d2-4fd5-ac03-9244b582570a', null, 4, 3, '12-15'),  -- Hammer Curls
    (v_id, '16a1fbcd-b9a4-4acc-9bcc-899713a940ca', null, 5, 3, '12-15');  -- Dumbbell Shrug

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Legs B', true, null, 'Dumbbell Push Pull Legs 6 Day', 'dumbbell-push-pull-legs-6-day', 'Push, pull and legs twice a week with only dumbbells. Six days, with a different set of exercises the second time through.', 24, 6, true, null, 'advanced', 6, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '8f6f1a53-8fed-4c3b-8713-8d44e030c3a6', null, 0, 4, '10-12'),  -- Dumbbell Squat
    (v_id, '91ca5bfe-50dd-4fba-9b7b-b342077c9bd4', null, 1, 3, '10-12 each'),  -- Dumbbell Lunges
    (v_id, 'c67f5050-77ad-42de-8a61-36515b915869', null, 2, 4, '10-12'),  -- Dumbbell Hip Thrust
    (v_id, '5fd26cd7-19b7-4d82-b0a4-4039e2132f23', null, 3, 3, '10 each'),  -- Dumbbell Step Ups
    (v_id, '4433df75-1d5a-4ad1-a252-93b67398c2e5', null, 4, 4, '15-20');  -- Standing Dumbbell Calf Raise
end $$;

-- Two Day Full Body (two-day-full-body): 2 variations, 11 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'two-day-full-body') then
    raise notice 'skipping two-day-full-body: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 1', true, null, 'Two Day Full Body', 'two-day-full-body', 'For weeks when you can only get to the gym twice. Two full body workouts that cover every major muscle.', 25, 1, false, null, 'beginner', 2, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '85495e85-bd72-445d-a6c8-5961f17ec2e5', null, 0, 3, '6-8'),  -- Barbell Squat
    (v_id, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', null, 1, 3, '6-8'),  -- Barbell Bench Press
    (v_id, '653288a1-8c39-4840-a2bc-c6eb64790c82', null, 2, 3, '8-10'),  -- Wide-Grip Lat Pulldown
    (v_id, '21e9e394-1151-4a07-bb3a-2fd487e461dd', null, 3, 3, '8-10'),  -- Romanian Deadlift
    (v_id, 'c0f86c40-21ec-4135-bef6-908d2bc3154b', null, 4, 3, '30s');  -- Plank

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 2', true, null, 'Two Day Full Body', 'two-day-full-body', 'For weeks when you can only get to the gym twice. Two full body workouts that cover every major muscle.', 25, 2, false, null, 'beginner', 2, 'gym')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '034ebb98-56b3-4073-a726-1709d14b4455', null, 0, 3, '5'),  -- Barbell Deadlift
    (v_id, '83e390eb-2f53-427e-8870-2997eb172279', null, 1, 3, '6-8'),  -- Standing Military Press
    (v_id, '9f94e87f-9afc-4a49-b4b3-feba0a560e27', null, 2, 3, '8-10'),  -- Seated Cable Rows
    (v_id, 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', null, 3, 3, '10-12'),  -- Leg Press
    (v_id, 'd02def38-ea29-4bbb-87ff-8da1e23f2afe', null, 4, 2, '10-12'),  -- Dumbbell Bicep Curl
    (v_id, 'ff125b68-7808-49db-9a7b-da3db74fdef4', null, 5, 2, '10-12');  -- Triceps Pushdown
end $$;

-- Two Day Dumbbell Full Body (two-day-dumbbell-full-body): 2 variations, 11 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'two-day-dumbbell-full-body') then
    raise notice 'skipping two-day-dumbbell-full-body: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 1', true, null, 'Two Day Dumbbell Full Body', 'two-day-dumbbell-full-body', 'Two full body workouts a week with a pair of dumbbells. A good start at home if your schedule is tight.', 26, 1, false, null, 'beginner', 2, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '43284cd1-4bb4-44c7-87b6-617ed5f03dbf', null, 0, 3, '8-10'),  -- Goblet Squat
    (v_id, '05510482-9385-455f-85b4-96aef279939c', null, 1, 3, '8-10'),  -- Dumbbell Bench Press
    (v_id, '5e3e2c88-2b18-42fb-b39d-c6aca546d3be', null, 2, 3, '10 each'),  -- One-Arm Dumbbell Row
    (v_id, 'f5521250-381d-4aec-819c-833202e1d481', null, 3, 3, '8-10'),  -- Dumbbell Romanian Deadlift
    (v_id, 'c0f86c40-21ec-4135-bef6-908d2bc3154b', null, 4, 3, '30s');  -- Plank

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day 2', true, null, 'Two Day Dumbbell Full Body', 'two-day-dumbbell-full-body', 'Two full body workouts a week with a pair of dumbbells. A good start at home if your schedule is tight.', 26, 2, false, null, 'beginner', 2, 'dumbbells')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '91ca5bfe-50dd-4fba-9b7b-b342077c9bd4', null, 0, 3, '8-10 each'),  -- Dumbbell Lunges
    (v_id, '6db0743b-b1be-4071-b663-af358c7f47bb', null, 1, 3, '8-10'),  -- Dumbbell Shoulder Press
    (v_id, 'a85860d0-706c-4e88-b20a-bb15eb308822', null, 2, 3, '10-12'),  -- Bent Over Two-Dumbbell Row
    (v_id, 'c67f5050-77ad-42de-8a61-36515b915869', null, 3, 3, '10-12'),  -- Dumbbell Hip Thrust
    (v_id, 'd02def38-ea29-4bbb-87ff-8da1e23f2afe', null, 4, 2, '10-12'),  -- Dumbbell Bicep Curl
    (v_id, 'd9899985-a114-4200-af3d-fbd9a1ecf6ee', null, 5, 2, '10-12');  -- Standing Dumbbell Triceps Extension
end $$;

-- ---------------------------------------------------------------------------
-- Section 2: Arnold Split copy. The blurb loses its em dash and colon with the
-- same meaning, and the variation names drop the middle dot for a space.
-- Idempotent: a second run matches nothing.
-- ---------------------------------------------------------------------------

update public.templates
set program_blurb = 'The classic six day bodybuilding split. Chest and back, shoulders and arms, then legs, each run twice a week.'
where is_system and program_slug = 'arnold-split'
  and program_blurb is distinct from 'The classic six day bodybuilding split. Chest and back, shoulders and arms, then legs, each run twice a week.';

update public.templates
set name = replace(name, ' · ', ' ')
where is_system and program_slug = 'arnold-split' and name like '% · %';

commit;

-- ---------------------------------------------------------------------------
-- Section 3: read-only check. Ten rows, one per new program, with its
-- variation and exercise counts, plus the Arnold Split's corrected names.
-- ---------------------------------------------------------------------------

select t.program, t.program_slug, t.level, t.equipment, t.days_per_week, t.program_order,
  count(distinct t.id) as variations,
  count(te.id) as exercises,
  string_agg(distinct t.name, ' | ') as variation_names
from public.templates t
left join public.template_exercises te on te.template_id = t.id
where t.is_system and t.program_slug in ('upper-lower-push-pull-legs', 'torso-limbs', 'volume-light-heavy', 'tiered-strength', 'dumbbell-full-body', 'calisthenics-full-body', 'bands-upper-lower', 'dumbbell-push-pull-legs-6-day', 'two-day-full-body', 'two-day-dumbbell-full-body', 'arnold-split')
group by t.program, t.program_slug, t.level, t.equipment, t.days_per_week, t.program_order
order by t.program_order;
