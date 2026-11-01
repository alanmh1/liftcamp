-- Funnel analytics for /admin. SUPABASE (SQL editor). Run top to bottom.
--
-- Two parts.
-- 1. install_events: one row per install's first open, written by the app
--    before any sign-in exists (insert only, nothing readable through the
--    API). This is the top of the funnel: App Store units live in App
--    Store Connect, so "opened the app" is the first step LiftCamp itself
--    can see. Comparing this count against ASC first-time downloads shows
--    download-to-open drop.
-- 2. admin_funnel(): everything the /admin Funnel section reads. Cohort
--    rules match docs/funnel-query.sql: users with a dev_user row, the
--    team's emails and alanmh+ patterns are left out; merged guests count
--    once, with first open pulled back to the guest's created_at.
--
-- Stage sources. Workout stages come from workouts and sets, so they are
-- right for every user back to launch. Installs and onboarding steps come
-- from install_events and app_events written by the app from the build
-- that ships docs/funnel-admin-spec.md on, so they read 0 for the days
-- before that; the page says so.
--
-- Known gaps, same as the manual query: guests purged after 90 idle days
-- shrink old cohorts, and TestFlight installs on the team's own phones do
-- write an app_opened row (release build, no account to exclude them by).
-- Dev builds (__DEV__) write nothing.

BEGIN;

-- Part 1: install_events -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.install_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The anon key is public, so what this table accepts is pinned down:
  -- only known names, only small payloads.
  CONSTRAINT install_events_name_allowed CHECK (name IN ('app_opened')),
  CONSTRAINT install_events_props_small CHECK (pg_column_size(props) < 2048)
);

-- One first open per device. The client upserts with ignoreDuplicates, so
-- a re-send (reinstall that kept the keychain-free AsyncStorage id, or a
-- lost local flag) lands on DO NOTHING instead of a second row.
CREATE UNIQUE INDEX IF NOT EXISTS install_events_once
  ON public.install_events (device_id, name);

CREATE INDEX IF NOT EXISTS install_events_created_at
  ON public.install_events (created_at);

ALTER TABLE public.install_events ENABLE ROW LEVEL SECURITY;

-- The app fires before any sign-in exists, so anon may insert. There is
-- no select policy: only admin_funnel() (SECURITY DEFINER) reads.
DROP POLICY IF EXISTS "install events insert" ON public.install_events;
CREATE POLICY "install events insert" ON public.install_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "install_events_no_update" ON public.install_events;
CREATE POLICY "install_events_no_update" ON public.install_events
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "install_events_no_delete" ON public.install_events;
CREATE POLICY "install_events_no_delete" ON public.install_events
  AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

-- Part 2: admin_funnel() -------------------------------------------------

-- _since defaults to the App Store launch (13 Oct 2026). The page passes
-- other anchors for 7- and 30-day views.
CREATE OR REPLACE FUNCTION public.admin_funnel(_since timestamptz DEFAULT NULL)
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

  -- The daily series is capped so a wide-open range cannot return years
  -- of rows.
  since := greatest(since, now() - interval '365 days');

  WITH params AS (
    SELECT ARRAY[
             'alanmh@gmail.com',
             'tester@example.com',
             'alan@alanharris.io',
             'alanmharris1@gmail.com'
           ]::text[] AS excluded_emails,
           ARRAY['alanmh+%@gmail.com']::text[] AS excluded_patterns
  ),
  excluded AS (
    SELECT u.id AS user_id
    FROM auth.users u, params
    WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(params.excluded_emails) AS e)
       OR u.email ILIKE ANY (params.excluded_patterns)
    UNION
    SELECT e.user_id FROM public.app_events e WHERE e.name = 'dev_user'
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
  -- One row per cohort user per onboarding page reached in their first
  -- run (returning rows are the re-ask flow for pre-launch accounts).
  pages AS (
    SELECT DISTINCT e.user_id, e.props->>'page' AS page
    FROM public.app_events e
    JOIN cohort c ON c.user_id = e.user_id
    WHERE e.name = 'onboarding_page'
      AND coalesce((e.props->>'returning')::boolean, false) = false
  ),
  daily AS (
    SELECT d.day::date AS day,
           (SELECT count(*) FROM public.install_events ie
            WHERE ie.name = 'app_opened' AND ie.created_at::date = d.day::date) AS installs,
           (SELECT count(*) FROM cohort c WHERE c.first_open::date = d.day::date) AS accounts
    FROM generate_series(since::date, current_date, interval '1 day') AS d(day)
  )
  SELECT jsonb_build_object(
    'since', since,
    'installs', jsonb_build_object(
      'total', (SELECT count(*) FROM public.install_events
                WHERE name = 'app_opened' AND created_at >= since),
      'recorded_from', (SELECT min(created_at) FROM public.install_events
                        WHERE name = 'app_opened')
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

COMMIT;

-- Check, after the app update ships: a fresh install (or Simulator "Start
-- fresh" on a release-mode build) should add one install_events row and,
-- after tapping Get started, onboarding_page rows for each page reached.
--
-- SELECT name, props, created_at FROM public.install_events
-- ORDER BY created_at DESC LIMIT 10;
-- SELECT name, props->>'page' AS page, created_at FROM public.app_events
-- WHERE name LIKE 'onboarding%' ORDER BY created_at DESC LIMIT 20;
