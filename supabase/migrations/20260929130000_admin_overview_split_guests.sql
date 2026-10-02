-- /admin overview: signed-up accounts and guests counted separately.
--
-- admin_overview() counted every auth.users row for Accounts, New accounts
-- and Active, so on 29 Sep 2026 the Accounts tile read 50 while the Per
-- account table (signed-up only, 20260929120000) lists 14. The other 36 are
-- guests.
--
-- New keys, split by the same guest predicate as admin_users() and
-- admin_guest_count(): a guest is is_anonymous = true, or has no email.
--   signed_up_users, guest_users
--   new_signed_up_7d, new_guests_7d
--   new_signed_up_30d, new_guests_30d
--   active_signed_up_7d, active_guests_7d
--   active_signed_up_30d, active_guests_30d
-- "Active" is still "created a workout in the window", joined to auth.users
-- to tell the two apart.
--
-- Every existing key is kept with its old meaning (all users), so the
-- deployed frontend reads the same numbers before and after this runs.
-- The rest of the body is unchanged from the live definition read on
-- 29 Sep 2026.
--
-- Run in SUPABASE (SQL editor). Section 0 first, read the output, then the rest.

-- Section 0: diagnostic. Expect signed_up + guests = total in each row group.
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE u.is_anonymous IS NOT TRUE AND nullif(u.email, '') IS NOT NULL) AS signed_up,
--        count(*) FILTER (WHERE u.is_anonymous IS TRUE OR nullif(u.email, '') IS NULL) AS guests,
--        count(*) FILTER (WHERE u.created_at > now() - interval '30 days'
--                           AND u.is_anonymous IS NOT TRUE AND nullif(u.email, '') IS NOT NULL) AS new_signed_up_30d,
--        count(*) FILTER (WHERE u.created_at > now() - interval '30 days'
--                           AND (u.is_anonymous IS TRUE OR nullif(u.email, '') IS NULL)) AS new_guests_30d,
--        (SELECT count(DISTINCT w.user_id) FROM public.workouts w
--          WHERE w.created_at > now() - interval '30 days') AS active_30d_all
-- FROM auth.users u;

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_overview(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  win interval := make_interval(days => greatest(1, least(_days, 180)));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH users AS (
    SELECT u.id,
           u.created_at,
           (u.is_anonymous IS TRUE OR nullif(u.email, '') IS NULL) AS is_guest
    FROM auth.users u
  ),
  active AS (
    SELECT w.user_id,
           max(w.created_at) AS last_workout
    FROM public.workouts w
    WHERE w.created_at > now() - interval '30 days'
    GROUP BY w.user_id
  ),
  active_users AS (
    SELECT u.is_guest, a.last_workout
    FROM active a
    JOIN users u ON u.id = a.user_id
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'new_users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(DISTINCT user_id) FROM public.workouts WHERE created_at > now() - interval '7 days'),
    'active_30d', (SELECT count(DISTINCT user_id) FROM public.workouts WHERE created_at > now() - interval '30 days'),
    'signed_up_users', (SELECT count(*) FROM users WHERE NOT is_guest),
    'guest_users', (SELECT count(*) FROM users WHERE is_guest),
    'new_signed_up_7d', (SELECT count(*) FROM users WHERE NOT is_guest AND created_at > now() - interval '7 days'),
    'new_guests_7d', (SELECT count(*) FROM users WHERE is_guest AND created_at > now() - interval '7 days'),
    'new_signed_up_30d', (SELECT count(*) FROM users WHERE NOT is_guest AND created_at > now() - interval '30 days'),
    'new_guests_30d', (SELECT count(*) FROM users WHERE is_guest AND created_at > now() - interval '30 days'),
    'active_signed_up_7d', (SELECT count(*) FROM active_users WHERE NOT is_guest AND last_workout > now() - interval '7 days'),
    'active_guests_7d', (SELECT count(*) FROM active_users WHERE is_guest AND last_workout > now() - interval '7 days'),
    'active_signed_up_30d', (SELECT count(*) FROM active_users WHERE NOT is_guest),
    'active_guests_30d', (SELECT count(*) FROM active_users WHERE is_guest),
    'total_workouts', (SELECT count(*) FROM public.workouts),
    'finished_workouts', (SELECT count(*) FROM public.workouts WHERE finished_at IS NOT NULL),
    'workouts_7d', (SELECT count(*) FROM public.workouts WHERE created_at > now() - interval '7 days'),
    'total_sets', (SELECT count(*) FROM public.sets),
    'completed_sets', (SELECT count(*) FROM public.sets WHERE completed),
    'distinct_exercises', (SELECT count(DISTINCT exercise_id) FROM public.workout_exercises),
    'failed_starts_7d', (SELECT count(*) FROM public.app_events WHERE name = 'workout_start_failed' AND created_at > now() - interval '7 days'),
    'top_exercises', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT e.name, e.slug, count(*)::int AS uses, count(DISTINCT we.user_id)::int AS users
        FROM public.workout_exercises we
        JOIN public.exercises e ON e.id = we.exercise_id
        GROUP BY e.name, e.slug
        ORDER BY count(*) DESC
        LIMIT 15
      ) t
    ),
    'daily', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
               count(*)::int AS workouts,
               count(DISTINCT user_id)::int AS users
        FROM public.workouts
        WHERE created_at > now() - win
        GROUP BY 1
      ) t
    ),
    'recent_failures', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) FROM (
        SELECT created_at, props
        FROM public.app_events
        WHERE name = 'workout_start_failed'
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

COMMIT;
