-- LiftCamp: data cleanup, 24 Sep 2026
-- Run in SUPABASE (SQL editor). One transaction; safe to run twice.
-- Part 2 (dropping birth_year) is at the bottom, commented out. Run it only
-- after the cleanup branch confirms nothing reads the column.

begin;

-- 1. Goblet Squat is done with one dumbbell in LiftCamp's programs and by
--    most beginners. It was tagged kettlebells. The cleanup branch adds its
--    id to the app's one-dumbbell list, so its volume counts one dumbbell.
update public.exercises
set equipment = 'dumbbell'
where id = '43284cd1-4bb4-44c7-87b6-617ed5f03dbf'
  and equipment = 'kettlebells';

-- 2. Close-Grip Dumbbell Press had the pullover's description pasted in.
update public.exercises
set description = E'Lie on a flat bench holding a dumbbell in each hand above your chest, palms facing each other.\nPress the dumbbells together so they touch along their length, and keep them squeezed together for the whole set.\nLower them slowly to your mid chest, keeping your elbows close to your sides.\nPress back up to the start, still squeezing the dumbbells together.\nRepeat for the recommended number of repetitions.'
where name = 'Close-Grip Dumbbell Press'
  and description like 'Place a dumbbell standing up on a flat bench.%';

-- 3. Duplicate anon read policies for system routines. Each pair grants the
--    same rows: on 24 Sep 2026 no system template or system template
--    exercise has a user_id. Keep the capitalised ones, drop the twins.
drop policy if exists "system templates readable by anyone" on public.templates;
drop policy if exists "system template exercises readable by anyone" on public.template_exercises;

commit;

-- Check: expect dumbbell, the new first line, and 1 anon system policy per table.
select 'goblet' as k, equipment as v from public.exercises where id = '43284cd1-4bb4-44c7-87b6-617ed5f03dbf'
union all
select 'close-grip', split_part(description, E'\n', 1) from public.exercises where name = 'Close-Grip Dumbbell Press'
union all
select tablename, count(*)::text
from pg_policies
where schemaname = 'public'
  and tablename in ('templates', 'template_exercises')
  and 'anon' = any(roles)
  and policyname ilike 'system%'
group by tablename;

-- Part 2. Run later, only after the cleanup branch reports that nothing in
-- apps/ or packages/ reads birth_year.
-- alter table public.user_profiles drop column if exists birth_year;
