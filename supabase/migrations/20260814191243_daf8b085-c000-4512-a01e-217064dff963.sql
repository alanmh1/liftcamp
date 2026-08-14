-- 1. slug generator (display label, punctuation stripped)
create or replace function public.exercise_slug(raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(translate(raw, '''’.', '')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'))
$$;

revoke all on function public.exercise_slug(text) from public;
grant execute on function public.exercise_slug(text) to authenticated, service_role;

-- 2. stored column, backfilled once (never derived at runtime)
alter table public.exercises add column if not exists slug text;

update public.exercises
set slug = public.exercise_slug(name)
where slug is null;

-- 3. hard guarantees: present, unique, never equal to a region slug
alter table public.exercises alter column slug set not null;

create unique index if not exists exercises_slug_key on public.exercises (slug);

alter table public.exercises
  add constraint exercises_slug_not_region
  check (slug not in ('chest','back','shoulders','arms','legs','core'));

-- 4. auto-fill on insert when not supplied (updates never rewrite an existing slug)
create or replace function public.exercises_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.exercise_slug(new.name);
  end if;
  return new;
end;
$$;

revoke all on function public.exercises_set_slug() from public;

drop trigger if exists exercises_set_slug_trg on public.exercises;
create trigger exercises_set_slug_trg
  before insert on public.exercises
  for each row execute function public.exercises_set_slug();