-- LiftCamp: profile settings (sex, birth year) and a unit on every set
-- Run in SUPABASE (SQL editor). Generated 24 Sep 2026. One transaction;
-- safe to run twice. Run this before building the profile-settings branch;
-- the current app keeps working, since the trigger fills the new column.
--
-- Why sets get a unit: sets.weight_value has no unit of its own. It means
-- whatever user_profiles.weight_unit said at the time, so switching units
-- would silently turn 225 lb into 225 kg. After this, each set records the
-- unit it was typed in, and the app converts to the user's current unit on
-- read. Nothing stored is ever rewritten by a unit switch.

begin;

-- 1. Body fields for the strength level. Both nullable: unanswered is normal.
--    'unspecified' is an explicit "prefer not to say", kept distinct from
--    null (never asked) so the app knows not to ask again.
alter table public.user_profiles
  add column if not exists sex text,
  add column if not exists birth_year integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_sex_check') then
    alter table public.user_profiles
      add constraint user_profiles_sex_check
      check (sex is null or sex in ('male', 'female', 'unspecified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_birth_year_check') then
    alter table public.user_profiles
      add constraint user_profiles_birth_year_check
      check (birth_year is null or birth_year between 1900 and 2100);
  end if;
end $$;

-- 2. The unit each set was logged in. Added nullable, backfilled from the
--    owner's profile (every existing weighted set belongs to an lb profile
--    on 24 Sep 2026), then made NOT NULL.
alter table public.sets
  add column if not exists weight_unit text;

update public.sets s
set weight_unit = coalesce(p.weight_unit, 'lb')
from public.user_profiles p
where s.weight_unit is null
  and p.user_id = s.user_id;

update public.sets
set weight_unit = 'lb'
where weight_unit is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sets_weight_unit_check') then
    alter table public.sets
      add constraint sets_weight_unit_check
      check (weight_unit in ('lb', 'kg'));
  end if;
end $$;

-- 3. Any insert that does not say its unit (the frozen web app, or a client
--    that forgets) gets the owner's current unit. BEFORE triggers run ahead
--    of the NOT NULL check, so the column can be NOT NULL with no default.
create or replace function public.sets_fill_weight_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.weight_unit is null then
    select coalesce(p.weight_unit, 'lb') into new.weight_unit
    from public.user_profiles p
    where p.user_id = new.user_id;
    new.weight_unit := coalesce(new.weight_unit, 'lb');
  end if;
  return new;
end
$fn$;

revoke all on function public.sets_fill_weight_unit() from public;

drop trigger if exists sets_fill_weight_unit on public.sets;
create trigger sets_fill_weight_unit
  before insert on public.sets
  for each row execute function public.sets_fill_weight_unit();

alter table public.sets
  alter column weight_unit set not null;

commit;

-- Check: expect one row per unit with no nulls, and 0 for null_units.
select weight_unit, count(*) as sets,
       (select count(*) from public.sets where weight_unit is null) as null_units
from public.sets
group by weight_unit;
