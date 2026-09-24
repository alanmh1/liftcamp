-- LiftCamp: setup checklist state on user_profiles
-- Run in SUPABASE (SQL editor). Generated 24 Sep 2026. Idempotent; safe to
-- run twice. The current app ignores both columns.
--
-- Every checklist task except one is worked out from data the app already
-- has. These two are the exceptions: nothing else records that a friend was
-- invited, or that the user hid the card.

alter table public.user_profiles
  add column if not exists invited_friend_at timestamptz,
  add column if not exists setup_hidden_at timestamptz;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
  and column_name in ('invited_friend_at', 'setup_hidden_at')
order by column_name;
