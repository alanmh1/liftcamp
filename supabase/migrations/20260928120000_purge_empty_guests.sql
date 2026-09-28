-- Nightly removal of empty guest accounts.
--
-- A guest (anonymous) account is removed when all of these hold:
--   created more than 30 days ago,
--   no workouts and no routines of its own,
--   no page views or app events in the last 30 days,
--   no role (never an admin).
-- Deleting the auth.users row is the whole job: every per-user table has an
-- ON DELETE CASCADE key to auth.users. The delete-account Edge Function's
-- other steps (Apple revoke, email-keyed rows, confirmation email) never
-- apply to a guest.
--
-- The app replaces a guest whose session is lost with a new guest, so a
-- removed guest who opens the app again lands in onboarding, not sign-in.
-- The privacy page states the 30 days.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not installed; stop and look';
  END IF;
END $$;

-- Not in an API-exposed schema, so no client can call it.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.purge_empty_guests(
  max_age interval DEFAULT interval '30 days',
  batch integer DEFAULT 500
)
RETURNS integer
LANGUAGE sql
SET search_path = ''
AS $$
  WITH doomed AS (
    SELECT u.id
    FROM auth.users u
    WHERE u.is_anonymous
      AND u.created_at < now() - max_age
      AND NOT EXISTS (SELECT 1 FROM public.workouts w WHERE w.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.templates t WHERE t.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.page_views p
                      WHERE p.user_id = u.id AND p.created_at > now() - max_age)
      AND NOT EXISTS (SELECT 1 FROM public.app_events e
                      WHERE e.user_id = u.id AND e.created_at > now() - max_age)
    ORDER BY u.created_at
    LIMIT batch
  ), gone AS (
    DELETE FROM auth.users u USING doomed d WHERE u.id = d.id RETURNING u.id
  )
  SELECT count(*)::integer FROM gone;
$$;

REVOKE ALL ON FUNCTION private.purge_empty_guests(interval, integer) FROM PUBLIC, anon, authenticated;

-- 11:17 UTC is 04:17 in Oregon (03:17 in winter). Scheduling by name
-- replaces an existing job of the same name, so this is safe to rerun.
SELECT cron.schedule('purge-empty-guests', '17 11 * * *', $cron$SELECT private.purge_empty_guests()$cron$);

COMMIT;
