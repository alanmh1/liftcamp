CREATE OR REPLACE FUNCTION public.admin_traffic(_days integer DEFAULT 30, _exclude_internal boolean DEFAULT true)
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

  with pv as (
    select * from public.page_views
    where created_at >= since
      and (not _exclude_internal or is_internal = false)
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
    'devices', coalesce((select jsonb_agg(to_jsonb(x)) from devices x), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;