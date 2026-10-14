-- Nightly guest purge: 90 days instead of 30.
--
-- private.purge_empty_guests uses max_age twice: a guest must be older than
-- it, and have no page view or app event newer than it. The cron job calls
-- the function with no arguments, so changing the default moves both to 90
-- days. The body is unchanged from 20260928120000_purge_empty_guests.sql.
--
-- The privacy page (apps/web/src/routes/privacy.tsx, line 192) says an
-- empty guest account is deleted after 30 days without activity. Change
-- that copy when this runs, so the policy matches what the database does.

-- Section 0. Diagnostic, read only. Run on its own and read the output.
-- Expect the default '30 days'::interval and one active job,
-- purge-empty-guests, '17 11 * * *', SELECT private.purge_empty_guests().
--
-- SELECT pg_get_function_arguments('private.purge_empty_guests(interval,integer)'::regprocedure);
--
-- SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'purge-empty-guests';

-- Section 1. Changing a parameter's default is allowed in CREATE OR
-- REPLACE (removing one is not). Grants and the REVOKE from the first
-- migration are kept.
BEGIN;

CREATE OR REPLACE FUNCTION private.purge_empty_guests(
  max_age interval DEFAULT interval '90 days',
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

COMMIT;

-- Section 2. Check. Expect max_age interval DEFAULT '90 days'::interval.
--
-- SELECT pg_get_function_arguments('private.purge_empty_guests(interval,integer)'::regprocedure);
