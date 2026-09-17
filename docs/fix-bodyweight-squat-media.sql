-- LiftCamp: Bodyweight Squat shows a split squat animation
-- Run in SUPABASE (SQL editor). Not yet applied.
--
-- The row's two photos (free-exercise-db, public domain, bucket
-- exercise-images, bodyweight-squat-0.jpg and -1.jpg) show a plain
-- bodyweight squat and are correct. Its GIF (ExerciseDB licensed set, bucket
-- exercise-gifs, 360/bodyweight-squat.gif and 180/bodyweight-squat.gif) is a
-- Bulgarian split squat with the rear foot on a bench: the wrong ExerciseDB
-- clip was matched to this slug when the 548 GIFs were mapped.
--
-- No GIF in the bucket shows a plain bodyweight squat (every body-only quad
-- exercise's GIF was checked, and every object named *squat*), so there is
-- no existing GIF URL to point the row at. The fix that uses existing media
-- correctly is to drop the GIF, after which the picker thumbnail and the info
-- sheet hero fall back to the correct photo, the same path the 350 exercises
-- without a GIF already take.
--
-- The lasting fix needs a new asset, not SQL: upload a real bodyweight squat
-- clip to 360/bodyweight-squat.gif and 180/bodyweight-squat.gif, then restore
-- the two URLs below (Section 2).

-- Section 0: read this first. One row, with the GIF URLs still set.
select id, name, slug, image_url, image_url_2, gif_url, gif_url_sm
from public.exercises
where id = '5c81a81d-cee6-4be5-96fd-3ddb65eeea00';

-- Section 1: drop the wrong animation. Idempotent.
update public.exercises
set gif_url = null, gif_url_sm = null
where id = '5c81a81d-cee6-4be5-96fd-3ddb65eeea00'
  and (gif_url is not null or gif_url_sm is not null);

-- Section 2: once a correct clip is in the bucket at the same paths, put the
-- URLs back. Do not run until the files have been replaced.
-- update public.exercises
-- set gif_url = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/360/bodyweight-squat.gif',
--     gif_url_sm = 'https://mnsigwjyskxfuszeegtp.supabase.co/storage/v1/object/public/exercise-gifs/180/bodyweight-squat.gif'
-- where id = '5c81a81d-cee6-4be5-96fd-3ddb65eeea00';
