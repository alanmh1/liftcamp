-- Where each workout was started: platform and app version.
--
-- Two nullable text columns on workouts. The mobile app fills them when it
-- creates a workout (Platform.OS, and "<version> (<build>)" from
-- expo-constants). The web and older app builds do not send them and leave
-- them null, which is how a row from before this change looks too.
--
-- Run this before any build or update that sends the columns ships. A
-- workout insert naming a column the database does not have is refused
-- (PostgREST PGRST204, status 400), the write queue treats that as
-- permanent, and the workout and its sets are dropped from the queue.
--
-- No GRANT: workouts has table-level grants only (checked 2 Oct 2026), and
-- those cover a new column. No new policy: the existing ones are per row.

-- Section 0. Diagnostic, read only. Run on its own and read the output.
-- Expect: 8 columns (no platform, no app_version yet), table-level grants
-- for anon and authenticated, no triggers.
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'workouts'
-- ORDER BY ordinal_position;
--
-- SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'workouts'
--   AND grantee IN ('anon', 'authenticated')
-- GROUP BY grantee;

-- Section 1.
BEGIN;

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS app_version text;

COMMENT ON COLUMN public.workouts.platform IS
  'Platform.OS of the app that created the workout (ios, android). Null for the web and for builds before 2 Oct 2026.';
COMMENT ON COLUMN public.workouts.app_version IS
  'App version and build that created the workout, as "1.0.0 (10)". Null for the web and for builds before 2 Oct 2026.';

COMMIT;

-- Section 2. Check. Expect both columns, nullable, text.
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'workouts'
--   AND column_name IN ('platform', 'app_version');
