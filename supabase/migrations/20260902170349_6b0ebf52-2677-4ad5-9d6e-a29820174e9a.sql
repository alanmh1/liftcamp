DROP FUNCTION IF EXISTS public.admin_traffic(integer, boolean);
DROP FUNCTION IF EXISTS public.admin_overview();

CREATE OR REPLACE FUNCTION public.admin_traffic(_days integer DEFAULT 30, _exclude_internal boolean DEFAULT true, _anonymous_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
  since timestamptz := now() - make_interval(days => greatest(1, least(_days, 180)));
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  with known as (
    select distinct session_id
    from public.page_views
    where user_id is not null
  ),
  pv as (
    select * from public.page_views p
    where p.created_at >= since
      and (not _exclude_internal or p.is_internal = false)
      and (not _anonymous_only or not exists (
        select 1 from known k where k.session_id = p.session_id
      ))
  ),
  daily as (
    select d::date as day,
           count(pv.id)::int as pageviews,
           count(distinct pv.session_id)::int as visitors
    from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d
    left join pv on date_trunc('day', pv.created_at) = d
    group by d
  ),
  pages as (
    select path, count(*)::int as views, count(distinct session_id)::int as visitors
    from pv group by path order by count(*) desc limit 15
  ),
  sources as (
    select coalesce(nullif(referrer_host,''), 'Direct') as source,
           count(distinct session_id)::int as visits
    from pv group by 1 order by count(distinct session_id) desc limit 10
  ),
  campaigns as (
    select utm_source as source,
           count(distinct session_id)::int as visits,
           count(*)::int as views
    from pv
    where utm_source is not null
    group by 1
    order by count(distinct session_id) desc
    limit 10
  ),
  devices as (
    select coalesce(device,'unknown') as device,
           count(distinct session_id)::int as visits
    from pv group by 1 order by count(distinct session_id) desc
  )
  select jsonb_build_object(
    'pageviews', (select count(*) from pv),
    'visitors', (select count(distinct session_id) from pv),
    'internal_pageviews', (
      select count(*) from public.page_views
      where created_at >= since and is_internal = true
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.day) from daily x), '[]'::jsonb),
    'top_pages', coalesce((select jsonb_agg(to_jsonb(x)) from pages x), '[]'::jsonb),
    'top_sources', coalesce((select jsonb_agg(to_jsonb(x)) from sources x), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(x)) from campaigns x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(to_jsonb(x)) from devices x), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.admin_users()
 RETURNS TABLE(user_id uuid, email text, joined_at timestamp with time zone, workouts integer, finished integer, sets integer, last_active timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           (SELECT max(s.created_at) FROM public.sets s WHERE s.user_id = u.id),
           (SELECT max(p.created_at) FROM public.page_views p WHERE p.user_id = u.id)
         )
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;