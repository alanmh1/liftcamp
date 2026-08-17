CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'new_users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(DISTINCT user_id) FROM public.workouts WHERE created_at > now() - interval '7 days'),
    'active_30d', (SELECT count(DISTINCT user_id) FROM public.workouts WHERE created_at > now() - interval '30 days'),
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
        WHERE created_at > now() - interval '30 days'
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
$$;

CREATE OR REPLACE FUNCTION public.admin_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  joined_at timestamptz,
  workouts int,
  finished int,
  sets int,
  last_active timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT u.id,
         u.email::text,
         u.created_at,
         (SELECT count(*)::int FROM public.workouts w WHERE w.user_id = u.id),
         (SELECT count(*)::int FROM public.workouts w WHERE w.user_id = u.id AND w.finished_at IS NOT NULL),
         (SELECT count(*)::int FROM public.sets s WHERE s.user_id = u.id),
         GREATEST(
           (SELECT max(w.created_at) FROM public.workouts w WHERE w.user_id = u.id),
           (SELECT max(s.created_at) FROM public.sets s WHERE s.user_id = u.id)
         )
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_users() TO authenticated, service_role;