-- ALREADY RAN. Do not run this file again.
--
-- It ran in the SUPABASE SQL editor in October 2026. Since then
-- docs/pro-warmup-social-counts.sql (2 Nov 2026) and docs/social-safety.sql
-- have replaced social_feed, social_workout, social_profile and
-- private.workout_visible. Running this file again would put back the
-- October social_feed and social_workout and undo both: warm-ups would
-- count in the feed's set counts again, and hidden or flagged workouts
-- would reach friends with their names and notes. Kept as the record of
-- what the feed added.
--
-- social-feed: the feed card's data.
--
-- Run in SUPABASE (SQL editor). Idempotent; safe to run twice. Read Section
-- 0's output before running Section 1.
--
-- What changes:
--   1. workouts gains volume, volume_unit and pr_exercise_ids, written by the
--      owner's phone in the same queued finish write as pr_count. The phone
--      computes them with the summary's logic (setVolume with the owner's
--      bodyweight, workoutPrSetIds with the prior bests), so a friend sees
--      the numbers the owner saw and never the owner's bodyweight. Null on
--      every workout finished before this ships, and on a finish whose PR
--      baselines never arrived (offline start); the card hides what is null.
--   2. social_feed is replaced (new return shape and arguments, so DROP and
--      CREATE): the note, volume, PR count, a per-exercise list, a
--      (finished_at, id) cursor, and p_user for one person's workouts on the
--      profile screen.
--   3. social_workout adds the note, volume and per-exercise PR flag.
--   4. social_kudos_inbox is new: kudos other people gave on the caller's
--      workouts, for the notifications inbox.
--
-- The note is returned only for workouts made in the mobile app (platform
-- 'ios' or 'android'). The 4 existing notes are all on web-era workouts
-- (platform null), written when notes were private, and the frozen web app
-- has no "people who follow you see this" line. Workout notes stay private
-- to their owner everywhere else.
--
-- Not changed: social_profile (username, follow states, latest workout) and
-- social_streak (weekly target and finished dates) already serve the
-- profile screen. No new table, so merge_guest_account and delete-account
-- need nothing.

-- ===========================================================================
-- Section 0. Diagnostics. Read before running Section 1.
-- ===========================================================================

-- 0a. Columns this file adds. Expect pr_count only (volume, volume_unit and
--     pr_exercise_ids absent before the first run).
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workouts'
  AND column_name IN ('pr_count', 'volume', 'volume_unit', 'pr_exercise_ids', 'notes', 'platform')
ORDER BY column_name;

-- 0b. Current signatures of the functions this file touches. Expect
--     social_feed(p_before timestamptz, p_limit integer) before the first run.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('social_feed', 'social_workout', 'social_kudos_inbox')
ORDER BY p.proname;

-- 0c. Notes by platform. Expect 4 notes, all on platform null.
SELECT platform, count(*) AS workouts,
       count(*) FILTER (WHERE btrim(coalesce(notes, '')) <> '') AS with_note,
       max(length(notes)) AS longest_note,
       count(*) FILTER (WHERE pr_count IS NOT NULL) AS with_pr_count
FROM public.workouts
GROUP BY platform
ORDER BY platform NULLS FIRST;

-- 0d. Table grants on workouts for the client roles. The phone writes the new
--     columns through the existing owner-only RLS, so authenticated needs
--     UPDATE (expect it present).
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'workouts'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- ===========================================================================
-- Section 1. Columns.
-- ===========================================================================

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS volume numeric;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS volume_unit text;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS pr_exercise_ids uuid[];

ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_volume_check;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_volume_check CHECK (volume IS NULL OR volume >= 0);
ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_volume_unit_check;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_volume_unit_check CHECK (volume_unit IS NULL OR volume_unit IN ('kg', 'lb'));
ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_volume_has_unit;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_volume_has_unit CHECK ((volume IS NULL) = (volume_unit IS NULL));

COMMENT ON COLUMN public.workouts.volume IS
  'Total volume at finish, in volume_unit, from the owner''s phone (setVolume). Null before social-feed.';
COMMENT ON COLUMN public.workouts.volume_unit IS
  'kg or lb: the owner''s unit at finish. Converted for display, never rewritten.';
COMMENT ON COLUMN public.workouts.pr_exercise_ids IS
  'workout_exercises ids with a PR set at finish, from the owner''s phone. Null means unknown; empty means none.';

-- ===========================================================================
-- Section 2. social_feed, replaced.
-- ===========================================================================

-- The return shape and arguments change, so the old one is dropped. Nothing
-- in the app calls it yet (the feed is this branch).
DROP FUNCTION IF EXISTS public.social_feed(timestamptz, integer);
DROP FUNCTION IF EXISTS public.social_feed(timestamptz, uuid, integer, uuid);

-- p_user null: the following feed, last 14 days. p_user set: that person's
-- finished workouts, any age, for the profile screen; nothing unless the
-- caller can view them. Paged newest first on (finished_at, id); pass the
-- last row's finished_at and workout_id as the cursor.
CREATE FUNCTION public.social_feed(
  p_before    timestamptz DEFAULT NULL,
  p_before_id uuid        DEFAULT NULL,
  p_limit     integer     DEFAULT 20,
  p_user      uuid        DEFAULT NULL
)
RETURNS TABLE (
  workout_id     uuid,
  user_id        uuid,
  username       text,
  name           text,
  note           text,
  workout_date   date,
  created_at     timestamptz,
  finished_at    timestamptz,
  completed_sets integer,
  volume         numeric,
  volume_unit    text,
  pr_count       integer,
  exercises      jsonb,
  kudos_count    integer,
  kudos_given    boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  WITH owners AS (
    SELECT f.followee_id AS uid
    FROM public.follows f
    WHERE p_user IS NULL
      AND f.follower_id = v_me
      AND f.status = 'accepted'
      AND NOT private.blocked_between(v_me, f.followee_id)
      AND private.social_on(f.followee_id)
    UNION
    SELECT p_user
    WHERE p_user IS NOT NULL
      AND private.can_view(v_me, p_user)
  )
  SELECT w.id, w.user_id, p.username, w.name,
         CASE WHEN w.platform IN ('ios', 'android') THEN nullif(btrim(w.notes), '') END,
         w.workout_date, w.created_at, w.finished_at,
         s.n, w.volume, w.volume_unit, w.pr_count,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
             'workout_exercise_id', we.id,
             'exercise_id', e.id,
             'name', e.name,
             'sets', c.n,
             'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END
           ) ORDER BY we.position, we.id)
           FROM public.workout_exercises we
           JOIN public.exercises e ON e.id = we.exercise_id
           CROSS JOIN LATERAL (
             SELECT count(*)::integer AS n FROM public.sets x
             WHERE x.workout_exercise_id = we.id AND x.completed
           ) c
           WHERE we.workout_id = w.id AND c.n > 0
         ), '[]'::jsonb),
         (SELECT count(*)::integer FROM public.kudos k WHERE k.workout_id = w.id),
         EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me)
  FROM owners o
  JOIN public.workouts w ON w.user_id = o.uid
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS n FROM public.sets x
    JOIN public.workout_exercises xe ON xe.id = x.workout_exercise_id
    WHERE xe.workout_id = w.id AND x.completed
  ) s
  WHERE w.finished_at IS NOT NULL
    AND (p_user IS NOT NULL OR w.finished_at >= now() - interval '14 days')
    AND (
      p_before IS NULL
      OR w.finished_at < p_before
      OR (p_before_id IS NOT NULL AND w.finished_at = p_before AND w.id < p_before_id)
    )
    AND s.n > 0
  ORDER BY w.finished_at DESC, w.id DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
END
$function$;

-- ===========================================================================
-- Section 3. social_workout: note, volume, per-exercise PR flag.
-- ===========================================================================

-- Same signature and return type (jsonb), so CREATE OR REPLACE keeps grants.
-- Body as live on 10 Oct 2026, plus note, volume, volume_unit, pr_count and
-- each exercise's 'pr'.
CREATE OR REPLACE FUNCTION public.social_workout(p_workout uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_me uuid := private.require_member(true);
  v    jsonb;
BEGIN
  IF NOT private.workout_visible(v_me, p_workout) THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', w.id,
    'user_id', w.user_id,
    'username', p.username,
    'name', w.name,
    'note', CASE WHEN w.platform IN ('ios', 'android') THEN nullif(btrim(w.notes), '') END,
    'workout_date', w.workout_date,
    'created_at', w.created_at,
    'finished_at', w.finished_at,
    'volume', w.volume,
    'volume_unit', w.volume_unit,
    'pr_count', w.pr_count,
    'completed_sets', (
      SELECT count(*) FROM public.sets s
      JOIN public.workout_exercises se ON se.id = s.workout_exercise_id
      WHERE se.workout_id = w.id AND s.completed
    ),
    'kudos_count', (SELECT count(*) FROM public.kudos k WHERE k.workout_id = w.id),
    'kudos_given', EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', we.id,
        'position', we.position,
        'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END,
        'exercise', jsonb_build_object(
          'id', e.id, 'name', e.name, 'weight_type', e.weight_type, 'is_unilateral', e.is_unilateral,
          'mechanic', e.mechanic, 'level', e.level, 'equipment', e.equipment,
          'primary_muscle', e.primary_muscle, 'secondary_muscles', e.secondary_muscles,
          'gif_url_sm', e.gif_url_sm, 'gif_url', e.gif_url, 'image_url', e.image_url
        ),
        'sets', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weight', s.weight, 'weight_value', s.weight_value,
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed
          ) ORDER BY s.position)
          FROM public.sets s WHERE s.workout_exercise_id = we.id
        ), '[]'::jsonb)
      ) ORDER BY we.position)
      FROM public.workout_exercises we
      JOIN public.exercises e ON e.id = we.exercise_id
      WHERE we.workout_id = w.id
    ), '[]'::jsonb)
  ) INTO v
  FROM public.workouts w
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  WHERE w.id = p_workout;
  RETURN v;
END
$function$;

-- ===========================================================================
-- Section 4. social_kudos_inbox, new.
-- ===========================================================================

-- Kudos other people gave on the caller's workouts, newest first, last 30
-- days, without anyone blocked either way. A removed kudos is gone from
-- here too. Follow events come from list_follows, which the app already
-- holds; the app merges the two (inboxItems in shared).
CREATE OR REPLACE FUNCTION public.social_kudos_inbox(p_limit integer DEFAULT 100)
RETURNS TABLE (
  workout_id   uuid,
  workout_name text,
  user_id      uuid,
  username     text,
  created_at   timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  SELECT k.workout_id, w.name, k.user_id, p.username, k.created_at
  FROM public.kudos k
  JOIN public.workouts w ON w.id = k.workout_id
  LEFT JOIN public.user_profiles p ON p.user_id = k.user_id
  WHERE w.user_id = v_me
    AND k.user_id <> v_me
    AND k.created_at >= now() - interval '30 days'
    AND NOT private.blocked_between(v_me, k.user_id)
  ORDER BY k.created_at DESC, k.user_id
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 200);
END
$function$;

-- kudos is read by workout owner here and by workout_kudos; this index makes
-- the 30-day window cheap once kudos grows. kudos_pkey leads on workout_id.
CREATE INDEX IF NOT EXISTS kudos_created_idx ON public.kudos (created_at DESC);

-- ===========================================================================
-- Section 5. Grants. Explicit; no GRANT ALL. The default privileges in
-- public grant EXECUTE to anon, so every function revokes it.
-- ===========================================================================

REVOKE ALL ON FUNCTION public.social_feed(timestamptz, uuid, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.social_workout(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.social_kudos_inbox(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.social_feed(timestamptz, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_workout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_kudos_inbox(integer) TO authenticated;

-- ===========================================================================
-- Section 6. Check. Expect three rows, each with authenticated true and
-- anon false, and the three new workouts columns.
-- ===========================================================================

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('social_feed', 'social_workout', 'social_kudos_inbox')
ORDER BY p.proname;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workouts'
  AND column_name IN ('volume', 'volume_unit', 'pr_exercise_ids')
ORDER BY column_name;
