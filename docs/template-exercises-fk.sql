-- LiftCamp: foreign key from template_exercises to exercises
-- Run in SUPABASE (SQL editor). Not yet applied.
--
-- Why: the routine cards need each template exercise's equipment and
-- primary muscle. PostgREST can only embed `exercises(...)` inside
-- `template_exercises(...)` when a foreign key links the two, and there is
-- none (PGRST200 on 16 Sep 2026). The app works around it with a second
-- query by id; with this constraint the template select can carry the
-- columns itself and that query goes away.

-- Section 0: diagnostic. Read this before running Section 1. Any orphan row
-- here would make the constraint fail, and needs a decision first.
select te.id, te.template_id, te.exercise_id
from public.template_exercises te
left join public.exercises e on e.id = te.exercise_id
where e.id is null;

-- Section 1: the constraint. Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'template_exercises_exercise_id_fkey'
  ) then
    alter table public.template_exercises
      add constraint template_exercises_exercise_id_fkey
      foreign key (exercise_id) references public.exercises (id);
  end if;
end $$;

-- After it runs, PostgREST picks the new relationship up on its next schema
-- reload (Settings, API, or wait for the cache). Then TEMPLATE_FIELDS in
-- apps/mobile/src/data/home.ts can embed exercises(equipment, primary_muscle)
-- and withExerciseFacts can go.
