-- LiftCamp: birthday instead of birth year, and "Other" for sex
-- Run in SUPABASE (SQL editor). Generated 24 Sep 2026. One transaction;
-- safe to run twice. The current app keeps working: birth_year stays until
-- the settings-redesign branch has merged, then a later cleanup drops it.

begin;

-- 1. Full birthday. The app only allows dates at least 13 years ago; the
--    database check just keeps out nonsense.
alter table public.user_profiles
  add column if not exists birthday date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_birthday_check') then
    alter table public.user_profiles
      add constraint user_profiles_birthday_check
      check (birthday is null or birthday between date '1900-01-01' and date '2100-01-01');
  end if;
end $$;

-- 2. Sex options become male, female, other. No row uses 'unspecified' on
--    24 Sep 2026; any that appear before this runs become null (unanswered),
--    since "prefer not to say" is not the same answer as "other".
alter table public.user_profiles
  drop constraint if exists user_profiles_sex_check;

update public.user_profiles set sex = null where sex = 'unspecified';

alter table public.user_profiles
  add constraint user_profiles_sex_check
  check (sex is null or sex in ('male', 'female', 'other'));

commit;

-- Check: expect the three columns and the new constraint.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
  and column_name in ('sex', 'birthday', 'birth_year')
order by column_name;
