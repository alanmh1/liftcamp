-- Onboarding fork + training schedule (docs/onboarding-fork-spec.md).
-- Run once in the Supabase SQL editor before the onboarding-fork OTA ships.
-- Idempotent: safe to run twice.

alter table public.user_profiles
  add column if not exists training_days smallint[],
  add column if not exists training_time text;

comment on column public.user_profiles.training_days is
  'Planned training days, ISO weekday numbers (1 = Monday ... 7 = Sunday), sorted, no repeats. Null = never answered; empty array = "Not sure yet" or no set days. Drives planned-day reminders.';
comment on column public.user_profiles.training_time is
  'Usual training window for planned-day reminders: morning, midday or evening. Null when no days are set.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_training_time_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_training_time_check
      check (training_time is null or training_time in ('morning', 'midday', 'evening'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_training_days_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_training_days_check
      check (
        training_days is null
        or (
          training_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
          and cardinality(training_days) <= 7
        )
      );
  end if;
end
$$;

-- Check: both columns exist and both constraints are in place.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'user_profiles'
       and column_name in ('training_days', 'training_time')) as columns_present,
  (select count(*) from pg_constraint
     where conrelid = 'public.user_profiles'::regclass
       and conname in ('user_profiles_training_time_check', 'user_profiles_training_days_check')) as constraints_present;
