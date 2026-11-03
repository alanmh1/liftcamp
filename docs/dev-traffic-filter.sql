-- docs/dev-traffic-filter.sql
-- Filters dev and Simulator traffic out of /admin analytics.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- A user counts as dev when any of these hold:
--   1. user metadata env = 'dev' (set by dev builds at sign-in)
--   2. a 'dev_user' app_event exists for them
--   3. they have an iOS workout from build (1), which only the Metro dev client reports
--      (iOS only: Will's release Android APK also reports build 1)
--   4. their email matches alanmh+%@gmail.com (test accounts)
-- The four named team emails are never dev. They stay visible in People, flagged as team,
-- and stay excluded from the funnel as before.

CREATE OR REPLACE FUNCTION public.dev_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH team AS (
    SELECT u.id
    FROM auth.users u
    WHERE lower(u.email) = ANY (ARRAY[
      'alanmh@gmail.com',
      'tester@example.com',
      'alan@alanharris.io',
      'alanmharris1@gmail.com'
    ])
  ),
  dev AS (
    SELECT u.id FROM auth.users u
    WHERE coalesce(u.raw_user_meta_data ->> 'env', '') = 'dev'
       OR u.email ILIKE 'alanmh+%@gmail.com'
    UNION
    SELECT e.user_id FROM public.app_events e
    WHERE e.name = 'dev_user' AND e.user_id IS NOT NULL
    UNION
    SELECT w.user_id FROM public.workouts w
    WHERE w.platform = 'ios' AND w.app_version LIKE '% (1)'
  )
  SELECT d.id FROM dev d
  WHERE NOT EXISTS (SELECT 1 FROM team t WHERE t.id = d.id);
$function$;

REVOKE ALL ON FUNCTION public.dev_user_ids() FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.admin_funnel(_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  since timestamptz := coalesce(_since, timestamptz '2026-10-13 00:00:00+00');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  since := greatest(since, now() - interval '365 days');

  WITH params AS (
    SELECT ARRAY[
             'alanmh@gmail.com',
             'tester@example.com',
             'alan@alanharris.io',
             'alanmharris1@gmail.com'
           ]::text[] AS excluded_emails
  ),
  excluded AS (
    SELECT u.id AS user_id
    FROM auth.users u, params
    WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(params.excluded_emails) AS e)
    UNION
    SELECT d.user_id FROM public.dev_user_ids() d
  ),
  merged AS (
    SELECT user_id,
           min((props->>'guest_created_at')::timestamptz) AS guest_created_at
    FROM public.app_events
    WHERE name = 'guest_merged'
    GROUP BY user_id
  ),
  finishes AS (
    SELECT user_id, finished_at,
           row_number() OVER (PARTITION BY user_id ORDER BY finished_at, id) AS n
    FROM public.workouts
    WHERE finished_at IS NOT NULL
  ),
  people AS (
    SELECT u.id AS user_id,
           u.is_anonymous,
           LEAST(u.created_at,
                 m.guest_created_at,
                 (SELECT min(w.created_at) FROM public.workouts w WHERE w.user_id = u.id)) AS first_open,
           (SELECT min(i.created_at) FROM auth.identities i WHERE i.user_id = u.id) AS account_created,
           (SELECT min(w.created_at) FROM public.workouts w WHERE w.user_id = u.id) AS first_started,
           EXISTS (SELECT 1 FROM public.sets s
                   WHERE s.user_id = u.id AND s.completed) AS logged_set,
           EXISTS (SELECT 1 FROM public.app_events e
                   WHERE e.user_id = u.id
                     AND e.name = 'onboarding_finished'
                     AND coalesce((e.props->>'returning')::boolean, false) = false) AS onboarded,
           (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 1) AS first_workout,
           (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 2) AS second_workout
    FROM auth.users u
    LEFT JOIN merged m ON m.user_id = u.id
    WHERE NOT EXISTS (SELECT 1 FROM excluded x WHERE x.user_id = u.id)
  ),
  cohort AS (
    SELECT p.*,
           now() >= p.first_open + interval '14 days' AS week2_eligible,
           EXISTS (
             SELECT 1 FROM finishes f
             WHERE f.user_id = p.user_id
               AND f.finished_at >= p.first_open + interval '7 days'
               AND f.finished_at <  p.first_open + interval '14 days'
           ) AS week2_return
    FROM people p
    WHERE p.first_open >= since
  ),
  pages AS (
    SELECT DISTINCT e.user_id, e.props->>'page' AS page
    FROM public.app_events e
    JOIN cohort c ON c.user_id = e.user_id
    WHERE e.name = 'onboarding_page'
      AND coalesce((e.props->>'returning')::boolean, false) = false
  ),
  real_installs AS (
    SELECT ie.created_at
    FROM public.install_events ie
    WHERE ie.name = 'app_opened'
      AND coalesce(ie.props->>'env', '') <> 'dev'
  ),
  daily AS (
    SELECT d.day::date AS day,
           (SELECT count(*) FROM real_installs ri
            WHERE ri.created_at::date = d.day::date) AS installs,
           (SELECT count(*) FROM cohort c WHERE c.first_open::date = d.day::date) AS accounts
    FROM generate_series(since::date, current_date, interval '1 day') AS d(day)
  )
  SELECT jsonb_build_object(
    'since', since,
    'installs', jsonb_build_object(
      'total', (SELECT count(*) FROM real_installs WHERE created_at >= since),
      'recorded_from', (SELECT min(created_at) FROM real_installs)
    ),
    'cohort', jsonb_build_object(
      'accounts',        (SELECT count(*) FROM cohort),
      'guests',          (SELECT count(*) FROM cohort WHERE is_anonymous),
      'onboarded',       (SELECT count(*) FROM cohort WHERE onboarded),
      'started_workout', (SELECT count(*) FROM cohort WHERE first_started IS NOT NULL),
      'logged_set',      (SELECT count(*) FROM cohort WHERE logged_set),
      'finished_workout',(SELECT count(*) FROM cohort WHERE first_workout IS NOT NULL),
      'second_workout',  (SELECT count(*) FROM cohort WHERE second_workout IS NOT NULL),
      'signed_up',       (SELECT count(*) FROM cohort WHERE account_created IS NOT NULL),
      'week2_eligible',  (SELECT count(*) FROM cohort WHERE week2_eligible),
      'week2_return',    (SELECT count(*) FROM cohort WHERE week2_eligible AND week2_return),
      'median_hours_open_to_first',
        (SELECT round((extract(epoch FROM percentile_cont(0.5) WITHIN GROUP
           (ORDER BY first_workout - first_open)) / 3600)::numeric, 1)
         FROM cohort WHERE first_workout IS NOT NULL)
    ),
    'onboarding', jsonb_build_object(
      'target',   (SELECT count(*) FROM pages WHERE page = 'target'),
      'prefs',    (SELECT count(*) FROM pages WHERE page = 'prefs'),
      'routines', (SELECT count(*) FROM pages WHERE page = 'routines'),
      'finished_routine',
        (SELECT count(DISTINCT e.user_id) FROM public.app_events e
         JOIN cohort c ON c.user_id = e.user_id
         WHERE e.name = 'onboarding_finished'
           AND e.props->>'how' = 'routine'
           AND coalesce((e.props->>'returning')::boolean, false) = false),
      'finished_skip',
        (SELECT count(DISTINCT e.user_id) FROM public.app_events e
         JOIN cohort c ON c.user_id = e.user_id
         WHERE e.name = 'onboarding_finished'
           AND e.props->>'how' = 'skip'
           AND coalesce((e.props->>'returning')::boolean, false) = false),
      'recorded_from', (SELECT min(created_at) FROM public.app_events
                        WHERE name = 'onboarding_page')
    ),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                'day', d.day, 'installs', d.installs, 'accounts', d.accounts)
                ORDER BY d.day), '[]'::jsonb)
              FROM daily d)
  )
  INTO result;

  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.admin_people(_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(user_id uuid, email text, kind text, is_team boolean, joined_at timestamp with time zone, source text, source_detail text, source_set_by text, stage integer, routines integer, workouts integer, finished integer, sets_done integer, last_seen timestamp with time zone, platform text, app_version text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH params AS (
    SELECT ARRAY[
             'alanmh@gmail.com',
             'tester@example.com',
             'alan@alanharris.io',
             'alanmharris1@gmail.com'
           ]::text[] AS excluded_emails
  ),
  team AS (
    SELECT u.id AS uid
    FROM auth.users u, params
    WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(params.excluded_emails) AS e)
  ),
  dev AS (
    SELECT d.user_id AS uid FROM public.dev_user_ids() d
  ),
  latest_workout AS (
    SELECT DISTINCT ON (w.user_id) w.user_id AS uid, w.platform, w.app_version
    FROM public.workouts w
    ORDER BY w.user_id, w.created_at DESC
  ),
  counts AS (
    SELECT u.id AS uid,
           (SELECT count(*)::int FROM public.templates t WHERE t.user_id = u.id) AS routines,
           (SELECT count(*)::int FROM public.workouts w WHERE w.user_id = u.id) AS workouts,
           (SELECT count(*)::int FROM public.workouts w
             WHERE w.user_id = u.id AND w.finished_at IS NOT NULL) AS finished,
           (SELECT count(*)::int FROM public.sets s
             WHERE s.user_id = u.id AND s.completed) AS sets_done,
           GREATEST(
             u.last_sign_in_at,
             (SELECT max(w.created_at) FROM public.workouts w WHERE w.user_id = u.id),
             (SELECT max(w.finished_at) FROM public.workouts w WHERE w.user_id = u.id),
             (SELECT max(e.created_at) FROM public.app_events e WHERE e.user_id = u.id),
             (SELECT max(p.created_at) FROM public.page_views p WHERE p.user_id = u.id)
           ) AS last_seen
    FROM auth.users u
  )
  SELECT u.id,
         u.email::text,
         CASE
           WHEN u.is_anonymous THEN 'guest'
           ELSE coalesce(
             (SELECT i.provider::text FROM auth.identities i
               WHERE i.user_id = u.id ORDER BY i.created_at LIMIT 1),
             'email')
         END,
         EXISTS (SELECT 1 FROM team t WHERE t.uid = u.id),
         u.created_at,
         s.source,
         s.detail,
         s.set_by,
         CASE
           WHEN c.finished >= 2 THEN 5
           WHEN c.finished >= 1 THEN 4
           WHEN c.sets_done >= 1 THEN 3
           WHEN c.workouts >= 1 THEN 2
           WHEN c.routines >= 1 THEN 1
           ELSE 0
         END,
         c.routines,
         c.workouts,
         c.finished,
         c.sets_done,
         c.last_seen,
         lw.platform,
         lw.app_version
  FROM auth.users u
  JOIN counts c ON c.uid = u.id
  LEFT JOIN public.user_sources s ON s.user_id = u.id
  LEFT JOIN latest_workout lw ON lw.uid = u.id
  WHERE (_since IS NULL OR u.created_at >= _since)
    AND NOT EXISTS (SELECT 1 FROM dev d WHERE d.uid = u.id)
  ORDER BY u.created_at DESC;
END;
$function$;


-- Check: these should list a78548ca, 3d9fc07b, 505586e9 and the Start fresh guests,
-- and none of the four team emails.
SELECT d.user_id, u.email, u.created_at
FROM public.dev_user_ids() d
JOIN auth.users u ON u.id = d.user_id
ORDER BY u.created_at DESC;
