-- Public exercise library: anonymous read access to the catalog and to
-- system routines only. User-owned rows stay invisible to anon.

-- 1. exercises: fully public catalog (open dataset, no user data)
grant select on public.exercises to anon;
drop policy if exists "Exercises readable by anyone" on public.exercises;
create policy "Exercises readable by anyone"
  on public.exercises for select to anon
  using (true);

-- 2. templates: system routines only. user_id-owned rows are NOT exposed.
grant select on public.templates to anon;
drop policy if exists "System templates readable by anyone" on public.templates;
create policy "System templates readable by anyone"
  on public.templates for select to anon
  using (is_system = true);

-- 3. template_exercises: rows belonging to a system template only.
grant select on public.template_exercises to anon;
drop policy if exists "System template exercises readable by anyone"
  on public.template_exercises;
create policy "System template exercises readable by anyone"
  on public.template_exercises for select to anon
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_exercises.template_id
        and t.is_system = true
    )
  );