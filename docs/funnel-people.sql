-- SUPABASE (SQL editor). Run top to bottom, after docs/funnel-admin.sql.
--
-- Two parts.
-- 1. user_sources: where a person says they found LiftCamp (the Home
--    "How did you find LiftCamp?" card writes one row per user), with an
--    admin override for the rows the app cannot know (App Review testers,
--    a Reddit commenter you recognise, a friend). One row per user; the
--    app may only insert its own row and never change it, so an admin
--    override is never overwritten by a late tap in the app.
-- 2. admin_people(): the People table on /admin. Every user, guests
--    included, with the furthest activation stage they reached, their
--    source, sign-in kind, and a last-seen that is not fooled by seeded
--    set rows. Replaces admin_users(), which counted every seeded set as
--    a logged set (a routine day starts with 15 to 20 rows before anyone
--    ticks one) and read last_active from those rows' created_at.
--
-- Stage ladder, computed from the domain tables so it is right for every
-- user back to launch:
--   0 started   tapped Get started (the auth user exists)
--   1 routine   has a routine (templates row), i.e. reached the end of
--               onboarding and picked one, or saved one later
--   2 workout   started a workout (workouts row)
--   3 set       ticked at least one set (sets.completed)
--   4 finished  finished a workout
--   5 second    finished a second workout
--
-- Known gap: a guest who answers the source card and is then merged into
-- an existing account loses the row (merge_guest_account deletes the
-- guest's auth.users row and this table cascades). Linking a new identity
-- keeps the same user row, so the common sign-up path keeps the answer.

BEGIN;

-- Part 1: user_sources ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_sources (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  source text NOT NULL,
  detail text,
  set_by text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_sources_source_allowed CHECK (source IN (
    -- Offered in the app
    'app_store', 'reddit', 'friend', 'web', 'chatbot', 'social', 'other',
    -- Admin only
    'app_review', 'tester', 'flier', 'trainer', 'unknown'
  )),
  CONSTRAINT user_sources_set_by_allowed CHECK (set_by IN ('user', 'admin')),
  CONSTRAINT user_sources_detail_short CHECK (detail IS NULL OR length(detail) <= 200)
);

ALTER TABLE public.user_sources ENABLE ROW LEVEL SECURITY;

-- The app inserts its own row once (upsert with ignoreDuplicates lands on
-- the primary key and does nothing the second time). No select, update or
-- delete for users; admins read through admin_people() and write through
-- admin_set_source().
DROP POLICY IF EXISTS "user_sources_insert_own" ON public.user_sources;
CREATE POLICY "user_sources_insert_own" ON public.user_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND set_by = 'user'
    AND source IN ('app_store', 'reddit', 'friend', 'web', 'chatbot', 'social', 'other')
  );

CREATE OR REPLACE FUNCTION public.admin_set_source(p_user_id uuid, p_source text, p_detail text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_source IS NULL THEN
    DELETE FROM public.user_sources WHERE user_id = p_user_id;
    RETURN;
  END IF;

  INSERT INTO public.user_sources (user_id, source, detail, set_by)
  VALUES (p_user_id, p_source, nullif(trim(p_detail), ''), 'admin')
  ON CONFLICT (user_id) DO UPDATE
    SET source = EXCLUDED.source,
        detail = EXCLUDED.detail,
        set_by = 'admin',
        updated_at = now();
END;
$function$;

-- Part 2: admin_people() -------------------------------------------------

-- _since null returns everyone. The page passes the launch date by default
-- and null for the "All time" toggle.
CREATE OR REPLACE FUNCTION public.admin_people(_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  email text,
  kind text,
  is_team boolean,
  joined_at timestamptz,
  source text,
  source_detail text,
  source_set_by text,
  stage integer,
  routines integer,
  workouts integer,
  finished integer,
  sets_done integer,
  last_seen timestamptz,
  platform text,
  app_version text
)
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
    -- Same team rules as admin_funnel(), so a row tagged team here is a
    -- row the funnel leaves out.
    SELECT ARRAY[
             'alanmh@gmail.com',
             'tester@example.com',
             'alan@alanharris.io',
             'alanmharris1@gmail.com'
           ]::text[] AS excluded_emails,
           ARRAY['alanmh+%@gmail.com']::text[] AS excluded_patterns
  ),
  team AS (
    SELECT u.id AS uid
    FROM auth.users u, params
    WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(params.excluded_emails) AS e)
       OR u.email ILIKE ANY (params.excluded_patterns)
    UNION
    SELECT e.user_id FROM public.app_events e WHERE e.name = 'dev_user'
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
  WHERE _since IS NULL OR u.created_at >= _since
  ORDER BY u.created_at DESC;
END;
$function$;

COMMIT;

-- Check: the table should list the Reddit sign-up and the fastmail one at
-- the top with stage 1 (picked a routine, never started a workout).
--
-- SELECT email, kind, joined_at::date, stage, routines, workouts, sets_done, last_seen
-- FROM public.admin_people(timestamptz '2026-10-13') LIMIT 20;
--
-- Tag the Reddit commenter by hand once the branch is live (or from the
-- Source cell on /admin):
-- SELECT public.admin_set_source('<user_id>', 'reddit', 'commented on the launch post');
