-- LiftCamp: point mismatched exercise media at the right files
-- Run in SUPABASE (SQL editor). Not yet applied. See docs/gif-audit.md for
-- how each row was judged.
--
-- Every URL below already exists in the public buckets exercise-gifs (the
-- licensed ExerciseDB set, 180/ and 360/) and exercise-images (free-exercise-db,
-- public domain). Nothing is uploaded or deleted; only the pointers change.
-- One template_exercises row also changes exercise (Push Pull Legs 6 Day,
-- Day 4 Push B, Cable Incline Pushdown to Triceps Overhead Extension with
-- Rope). This file replaces docs/fix-bodyweight-squat-media.sql, which only
-- covered the Bodyweight Squat row.

-- Section 0: read this first. Two result sets.
--
-- 0a: eight exercise rows, with the values about to change. Expect image_url
-- for Plank to end in plank-0.jpg, gif_url_sm still set on Bodyweight Squat
-- and Standing Military Press, and both GIF columns null on Bulgarian Split
-- Squat.
select id, name, slug, equipment, primary_muscle, gif_url, gif_url_sm, image_url, image_url_2
from public.exercises
where id in (
  '85495e85-bd72-445d-a6c8-5961f17ec2e5', -- Barbell Squat
  '5c81a81d-cee6-4be5-96fd-3ddb65eeea00', -- Bodyweight Squat
  'c5d02e3a-8be2-47b4-bd77-dd5623e3e562', -- Bulgarian Split Squat
  '2f5bb0e9-8e46-4296-a3d7-8d41ce03c238', -- Cable Crunch
  'b974386a-dc66-4eec-a8bf-8ec25e4f1746', -- Seated Bent-Over Rear Delt Raise
  '6d3f2ccf-3a41-49ac-bb40-200704c35fbf', -- One-Arm Side Deadlift
  'c0f86c40-21ec-4135-bef6-908d2bc3154b', -- Plank
  '83e390eb-2f53-427e-8870-2997eb172279'  -- Standing Military Press
)
order by name;

-- 0b: the template row that changes exercise. Expect one row, Push Pull Legs
-- 6 Day, Day 4 Push B, position 4, Cable Incline Pushdown, 3 sets of 10-12.
select t.program_slug, t.name as variation, te.id as template_exercise_id,
       te.position, te.target_sets, te.target_reps, e.name as exercise
from public.template_exercises te
join public.templates t on t.id = te.template_id
join public.exercises e on e.id = te.exercise_id
where t.is_system
  and t.program_slug = 'push-pull-legs-6-day'
  and t.name = 'Day 4 Push B'
  and te.exercise_id in (
    '85449b67-8a33-41d7-a814-1b3f70497239', -- Cable Incline Pushdown (old)
    '2b088c7d-06a4-4def-b8b8-3923fed503ad'  -- Triceps Overhead Extension with Rope (new)
  );

-- Section 1: one transaction. Every statement sets explicit values, so
-- running the block twice changes nothing the second time.
begin;

do $$
declare
  missing int;
begin
  select 9 - count(*) into missing
  from public.exercises
  where id in (
    '85495e85-bd72-445d-a6c8-5961f17ec2e5',
    '5c81a81d-cee6-4be5-96fd-3ddb65eeea00',
    'c5d02e3a-8be2-47b4-bd77-dd5623e3e562',
    '2f5bb0e9-8e46-4296-a3d7-8d41ce03c238',
    'b974386a-dc66-4eec-a8bf-8ec25e4f1746',
    '6d3f2ccf-3a41-49ac-bb40-200704c35fbf',
    'c0f86c40-21ec-4135-bef6-908d2bc3154b',
    '83e390eb-2f53-427e-8870-2997eb172279',
    '2b088c7d-06a4-4def-b8b8-3923fed503ad'
  );
  if missing <> 0 then
    raise exception 'fix-gif-mismatches: % of the 9 exercise ids are missing, nothing changed', missing;
  end if;
end $$;

-- Barbell Squat: its GIF is a box squat to a bench (the same clip idea as
-- Barbell Squat To A Bench). Barbell Full Squat's GIF is a free back squat.
update public.exercises
set gif_url    = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/360/barbell-full-squat.gif',
    gif_url_sm = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/180/barbell-full-squat.gif'
where id = '85495e85-bd72-445d-a6c8-5961f17ec2e5';

-- Bodyweight Squat: its GIF is a rear-foot-elevated split squat and no
-- clip in the bucket shows a plain bodyweight squat. Drop the GIF so the
-- picker and the info sheet fall back to the row's photos, which are right.
update public.exercises
set gif_url = null, gif_url_sm = null
where id = '5c81a81d-cee6-4be5-96fd-3ddb65eeea00';

-- Bulgarian Split Squat: no media at all today, and it sits in 11 system
-- programs. The clip that was filed under bodyweight-squat.gif is a
-- bodyweight Bulgarian split squat, so it moves here. The file name stays
-- bodyweight-squat.gif; only the pointer changes.
update public.exercises
set gif_url    = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/360/bodyweight-squat.gif',
    gif_url_sm = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/180/bodyweight-squat.gif'
where id = 'c5d02e3a-8be2-47b4-bd77-dd5623e3e562';

-- Cable Crunch: its GIF is a crunch on an exercise ball with no cable.
-- Cable Seated Crunch's GIF is a rope crunch at a cable stack.
update public.exercises
set gif_url    = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/360/cable-seated-crunch.gif',
    gif_url_sm = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/180/cable-seated-crunch.gif'
where id = '2f5bb0e9-8e46-4296-a3d7-8d41ce03c238';

-- Seated Bent-Over Rear Delt Raise: its GIF is a standing raise with the
-- dumbbells behind the hips. The head-on-bench clip is a bent-over rear
-- delt raise.
update public.exercises
set gif_url    = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/360/bent-over-dumbbell-rear-delt-raise-with-head-on-bench.gif',
    gif_url_sm = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/180/bent-over-dumbbell-rear-delt-raise-with-head-on-bench.gif'
where id = 'b974386a-dc66-4eec-a8bf-8ec25e4f1746';

-- One-Arm Side Deadlift: its GIF is a two-hand conventional deadlift and
-- no suitcase deadlift clip exists. Drop the GIF; the photos remain.
update public.exercises
set gif_url = null, gif_url_sm = null
where id = '6d3f2ccf-3a41-49ac-bb40-200704c35fbf';

-- Plank: image_url is a kneeling hip flexor stretch and image_url_2 is the
-- plank. Put the plank first. Plank has no GIF, so this photo is the
-- picker thumbnail and the info sheet hero in 8 system programs, and the
-- public exercise page.
update public.exercises
set image_url   = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-images/plank-1.jpg',
    image_url_2 = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-images/plank-0.jpg'
where id = 'c0f86c40-21ec-4135-bef6-908d2bc3154b';

-- Standing Military Press: its GIF is a standing press inside a Smith
-- machine and no free-bar standing press clip exists. Drop the GIF; both
-- photos are a standing barbell press (bar at the collarbones, then locked
-- out overhead). Used in 10 system programs.
update public.exercises
set gif_url = null, gif_url_sm = null
where id = '83e390eb-2f53-427e-8870-2997eb172279';

-- Push Pull Legs 6 Day, Day 4 Push B, position 4: Cable Incline Pushdown is
-- a lat move in the catalogue (an incline straight-arm pulldown). The day
-- wants a triceps finisher, so the row becomes Triceps Overhead Extension
-- with Rope. Position, sets and reps stay. Matches on the old exercise id,
-- so a second run finds nothing to change.
update public.template_exercises te
set exercise_id = '2b088c7d-06a4-4def-b8b8-3923fed503ad'
from public.templates t
where t.id = te.template_id
  and t.is_system
  and t.program_slug = 'push-pull-legs-6-day'
  and t.name = 'Day 4 Push B'
  and te.exercise_id = '85449b67-8a33-41d7-a814-1b3f70497239';

commit;

-- Section 2: read-only checks. Two result sets.
--
-- 2a: expect 8 rows with ok = true.
select name,
  case slug
    when 'barbell-squat' then gif_url_sm like '%/180/barbell-full-squat.gif'
    when 'bodyweight-squat' then gif_url is null and gif_url_sm is null
    when 'bulgarian-split-squat' then gif_url_sm like '%/180/bodyweight-squat.gif'
    when 'cable-crunch' then gif_url_sm like '%/180/cable-seated-crunch.gif'
    when 'seated-bent-over-rear-delt-raise' then gif_url_sm like '%/180/bent-over-dumbbell-rear-delt-raise-with-head-on-bench.gif'
    when 'one-arm-side-deadlift' then gif_url is null and gif_url_sm is null
    when 'plank' then image_url like '%/plank-1.jpg' and image_url_2 like '%/plank-0.jpg'
    when 'standing-military-press' then gif_url is null and gif_url_sm is null
  end as ok
from public.exercises
where slug in ('barbell-squat', 'bodyweight-squat', 'bulgarian-split-squat', 'cable-crunch',
               'seated-bent-over-rear-delt-raise', 'one-arm-side-deadlift', 'plank',
               'standing-military-press')
order by name;

-- 2b: expect one row, Triceps Overhead Extension with Rope at position 4,
-- 3 sets of 10-12, and no row for Cable Incline Pushdown.
select t.program_slug, t.name as variation, te.position, te.target_sets, te.target_reps, e.name as exercise
from public.template_exercises te
join public.templates t on t.id = te.template_id
join public.exercises e on e.id = te.exercise_id
where t.is_system
  and t.program_slug = 'push-pull-legs-6-day'
  and t.name = 'Day 4 Push B'
  and te.exercise_id in (
    '85449b67-8a33-41d7-a814-1b3f70497239',
    '2b088c7d-06a4-4def-b8b8-3923fed503ad'
  );
