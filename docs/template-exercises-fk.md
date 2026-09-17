# template_exercises to exercises foreign key

Applied in SUPABASE (SQL editor) on 16 Sep 2026:

```sql
alter table public.template_exercises
  add constraint template_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises (id);
```

Why: the routine cards need each template exercise's equipment and primary
muscle, and PostgREST can only embed `exercises(...)` inside
`template_exercises(...)` across a foreign key. Before the constraint the
embed failed with PGRST200 and the app fetched the columns by id in a
second query. `TEMPLATE_FIELDS` in `apps/mobile/src/data/home.ts` now
carries the embed.

The migrations folder does not record this; the live schema is the source
of truth, as CLAUDE.md says.
