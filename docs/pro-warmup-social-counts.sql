-- Warm-up sets never count toward a workout's set count on the social feed
-- (branch pro-starting-weights). Run in SUPABASE (SQL editor), Section 0
-- first, and read its output before Section 1.
--
-- social_feed() and social_workout() count completed sets on the server.
-- Both now leave out sets.set_type = 'warmup', the same rule the app's
-- countedSets (packages/shared/src/working-sets.ts) applies on the phone.
-- social_workout also returns each set's set_type, so a friend's read-only
-- workout can badge a warm-up W.
--
-- Bodies are the live ones read on 2 Nov 2026 (pg_get_functiondef), with
-- only the warm-up filter and the set_type field added. The signatures and
-- return types are unchanged, so CREATE OR REPLACE keeps the grants.
--
-- Needs sets.set_type, from docs/pro-starting-weights.sql (live as of
-- 2 Nov 2026). Safe for old builds: they never send set_type, so every
-- one of their sets is null and still counts.
--
-- If supabase/migrations/20261010120000_social_feed.sql (branch
-- social-feed) is ever run again, it puts the old counts back. Carry this
-- filter into that file when social-feed merges.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Expect set_type present (text, nullable), both
-- functions present, and a count of warm-up sets (0 before any Pro warm-up
-- has been logged).
-- ---------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sets' AND column_name = 'set_type';

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('social_feed', 'social_workout')
ORDER BY p.proname;

SELECT count(*) AS warmup_sets FROM public.sets WHERE set_type = 'warmup';

-- ---------------------------------------------------------------------------
-- Section 1: social_feed. Warm-ups left out of completed_sets and of each
-- exercise's set count; a workout of warm-ups only drops out of the feed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_user uuid DEFAULT NULL::uuid)
 RETURNS TABLE(workout_id uuid, user_id uuid, username text, name text, note text, workout_date date, created_at timestamp with time zone, finished_at timestamp with time zone, completed_sets integer, volume numeric, volume_unit text, pr_count integer, exercises jsonb, kudos_count integer, kudos_given boolean)
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
               AND x.set_type IS DISTINCT FROM 'warmup'
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
      AND x.set_type IS DISTINCT FROM 'warmup'
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

-- ---------------------------------------------------------------------------
-- Section 2: social_workout. Warm-ups left out of completed_sets; each set
-- carries set_type.
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
        AND s.set_type IS DISTINCT FROM 'warmup'
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
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed,
            'set_type', s.set_type
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
-- Section 3: check. Expect both bodies to mention 'warmup'.
-- ---------------------------------------------------------------------------
SELECT p.proname, pg_get_functiondef(p.oid) LIKE '%warmup%' AS filters_warmups
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('social_feed', 'social_workout')
ORDER BY p.proname;
