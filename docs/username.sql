-- LiftCamp: usernames on user_profiles
-- Run in SUPABASE (SQL editor). Idempotent; safe to run twice.

-- 1. The column. Nullable: an anonymous user gets one at profile creation,
-- and the 16 existing rows are filled by step 3 below.
alter table public.user_profiles
  add column if not exists username text;

-- 2. Uniqueness, case-insensitive. Usernames are stored lowercase, and the
-- index enforces it so a race between two clients cannot land two rows that
-- differ only by case.
create unique index if not exists user_profiles_username_key
  on public.user_profiles (lower(username));

-- 3. Shape. 3 to 20 characters, lowercase letters, digits and underscore,
-- starting with a letter. Checked here as well as in the app so a bad value
-- cannot arrive by any other path.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_username_shape'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_username_shape
      check (username is null or username ~ '^[a-z][a-z0-9_]{2,19}$');
  end if;
end $$;

-- 4. Backfill the existing rows.
-- Derived from the email local part, stripped to the allowed characters and
-- truncated to 20. A row whose derived value is taken, too short, or whose
-- user has no email (anonymous) falls back to lifter<n>. row_number over a
-- stable order makes the fallback deterministic rather than random.
with candidate as (
  select
    p.user_id,
    nullif(
      left(
        regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g'),
        20
      ),
      ''
    ) as base,
    row_number() over (order by p.created_at, p.user_id) as n
  from public.user_profiles p
  join auth.users u on u.id = p.user_id
  where p.username is null
),
ranked as (
  -- Two emails can reduce to the same base (alan@gmail.com and
  -- alan@example.com both give "alan"). Only the first keeps it; the rest
  -- fall through to lifter<n>, so the batch cannot collide with itself.
  select
    candidate.*,
    row_number() over (partition by base order by n) as dup
  from candidate
),
resolved as (
  select
    user_id,
    case
      when base is not null
       and dup = 1
       and base ~ '^[a-z][a-z0-9_]{2,19}$'
       and not exists (
         select 1 from public.user_profiles x where lower(x.username) = base
       )
      then base
      else 'lifter' || n::text
    end as username
  from ranked
)
update public.user_profiles p
set username = r.username
from resolved r
where p.user_id = r.user_id
  and p.username is null;
