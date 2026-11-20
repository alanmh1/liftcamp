-- Inline comments and "Liked by" on feed cards (branch feed-inline).
-- Run in SUPABASE (SQL editor) after docs/social-comments.sql, one section
-- at a time. 20 Nov 2026.
--
-- social_feed and social_workout gain two fields, filled only when the
-- viewer and the owner follow each other (the same rule as comment_count):
--   recent_comments  the latest 2 comments the viewer may see, oldest of
--                    the two first: [{id, user_id, username, body,
--                    created_at, mine}], body cut at 280 characters
--   likers           up to 3 people who gave kudos, newest first, not the
--                    viewer, not anyone blocked either way, social on:
--                    [{user_id, username}]
-- Old builds ignore the extra fields.

-- ---------------------------------------------------------------------------
-- Section 1: the two helpers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.recent_comments(p_viewer uuid, p_workout uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'user_id', x.user_id, 'username', x.username,
           'body', x.body, 'created_at', x.created_at, 'mine', x.user_id = p_viewer
         ) ORDER BY x.created_at, x.id), '[]'::jsonb)
  FROM (
    SELECT c.id, c.user_id, p.username, left(c.body, 280) AS body, c.created_at
    FROM public.workout_comments c
    JOIN public.workouts w ON w.id = c.workout_id
    LEFT JOIN public.user_profiles p ON p.user_id = c.user_id
    WHERE c.workout_id = p_workout
      AND private.comment_shown(p_viewer, w.user_id, c.user_id, c.hidden_at, c.moderation_flagged_at)
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 2
  ) x;
$function$;

CREATE OR REPLACE FUNCTION private.recent_likers(p_viewer uuid, p_workout uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', x.user_id, 'username', x.username
         ) ORDER BY x.created_at DESC, x.user_id), '[]'::jsonb)
  FROM (
    SELECT k.user_id, p.username, k.created_at
    FROM public.kudos k
    LEFT JOIN public.user_profiles p ON p.user_id = k.user_id
    WHERE k.workout_id = p_workout
      AND k.user_id <> p_viewer
      AND private.social_on(k.user_id)
      AND NOT private.blocked_between(p_viewer, k.user_id)
    ORDER BY k.created_at DESC, k.user_id
    LIMIT 3
  ) x;
$function$;

REVOKE ALL ON FUNCTION private.recent_comments(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.recent_likers(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Section 2: social_feed with recent_comments and likers. The return type
-- gains columns, so it is dropped and recreated with the same grants.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.social_feed(timestamp with time zone, uuid, integer, uuid);

CREATE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_user uuid DEFAULT NULL::uuid)
 RETURNS TABLE(workout_id uuid, user_id uuid, username text, name text, note text, workout_date date, created_at timestamp with time zone, finished_at timestamp with time zone, completed_sets integer, volume numeric, volume_unit text, pr_count integer, exercises jsonb, kudos_count integer, kudos_given boolean, can_interact boolean, comment_count integer, recent_comments jsonb, likers jsonb)
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
  SELECT w.id, w.user_id, p.username,
         private.shown_name(w.name, w.moderation_flagged_at),
         private.shown_note(w.notes, w.platform, w.moderation_flagged_at),
         w.workout_date, w.created_at, w.finished_at,
         s.n, w.volume, w.volume_unit, w.pr_count,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
             'workout_exercise_id', we.id,
             'exercise_id', e.id,
             'name', e.name,
             'gif_url_sm', e.gif_url_sm,
             'image_url', e.image_url,
             'sets', c.n,
             'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END
           ) ORDER BY we.position, we.id)
           FROM public.workout_exercises we
           JOIN public.exercises e ON e.id = we.exercise_id
           CROSS JOIN LATERAL (
             SELECT count(*)::integer AS n FROM public.sets x
             WHERE x.workout_exercise_id = we.id AND x.completed
               AND x.set_type IS DISTINCT FROM 'warmup'
           ) c
           WHERE we.workout_id = w.id AND c.n > 0
         ), '[]'::jsonb),
         (SELECT count(*)::integer FROM public.kudos k WHERE k.workout_id = w.id),
         EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
         private.mutual(v_me, w.user_id),
         CASE WHEN private.mutual(v_me, w.user_id) THEN private.comment_count(v_me, w.id) ELSE 0 END,
         CASE WHEN private.mutual(v_me, w.user_id) THEN private.recent_comments(v_me, w.id) ELSE '[]'::jsonb END,
         CASE WHEN private.mutual(v_me, w.user_id) THEN private.recent_likers(v_me, w.id) ELSE '[]'::jsonb END
  FROM owners o
  JOIN public.workouts w ON w.user_id = o.uid
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS n FROM public.sets x
    JOIN public.workout_exercises xe ON xe.id = x.workout_exercise_id
    WHERE xe.workout_id = w.id AND x.completed
      AND x.set_type IS DISTINCT FROM 'warmup'
  ) s
  WHERE w.finished_at IS NOT NULL
    AND w.hidden_at IS NULL
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

REVOKE ALL ON FUNCTION public.social_feed(timestamp with time zone, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_feed(timestamp with time zone, uuid, integer, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 3: social_workout with recent_comments and likers.
-- ---------------------------------------------------------------------------
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
    'name', private.shown_name(w.name, w.moderation_flagged_at),
    'note', private.shown_note(w.notes, w.platform, w.moderation_flagged_at),
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
        AND s.set_type IS DISTINCT FROM 'warmup'
    ),
    'kudos_count', (SELECT count(*) FROM public.kudos k WHERE k.workout_id = w.id),
    'kudos_given', EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
    'can_interact', private.mutual(v_me, w.user_id),
    'comment_count', CASE WHEN private.mutual(v_me, w.user_id) THEN private.comment_count(v_me, w.id) ELSE 0 END,
    'recent_comments', CASE WHEN private.mutual(v_me, w.user_id) THEN private.recent_comments(v_me, w.id) ELSE '[]'::jsonb END,
    'likers', CASE WHEN private.mutual(v_me, w.user_id) THEN private.recent_likers(v_me, w.id) ELSE '[]'::jsonb END,
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', we.id,
        'position', we.position,
        'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END,
        'exercise', jsonb_build_object(
          'id', e.id, 'name', e.name, 'weight_type', e.weight_type, 'is_unilateral', e.is_unilateral,
          'mechanic', e.mechanic, 'level', e.level, 'equipment', e.equipment,
          'primary_muscle', e.primary_muscle, 'secondary_muscles', e.secondary_muscles,
          'gif_url_sm', e.gif_url_sm, 'gif_url', e.gif_url, 'image_url', e.image_url,
          'is_custom', e.owner_id IS NOT NULL
        ),
        'sets', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weight', s.weight, 'weight_value', s.weight_value,
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed,
            'set_type', s.set_type, 'duration_seconds', s.duration_seconds,
            'distance_meters', s.distance_meters, 'incline_percent', s.incline_percent
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

-- ---------------------------------------------------------------------------
-- Section 4: check. Expect true, true.
-- ---------------------------------------------------------------------------
SELECT pg_get_function_result('public.social_feed(timestamp with time zone, uuid, integer, uuid)'::regprocedure) LIKE '%recent_comments jsonb, likers jsonb%' AS feed_ok,
       pg_get_functiondef('public.social_workout(uuid)'::regprocedure) LIKE '%recent_likers%' AS workout_ok;
