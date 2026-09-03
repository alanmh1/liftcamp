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

  with mine as (
    -- Sessions that are clearly the operator: manually flagged devices, anything
    -- arriving from a Lovable surface (editor preview, oauth, project domains),
    -- and any session that was ever signed in as an admin.
    select distinct p.session_id
    from public.page_views p
    where p.is_internal = true
      or p.referrer_host ilike '%lovable.dev'
      or p.referrer_host ilike '%lovable.app'
      or p.referrer_host ilike '%lovableproject.com'
      or (p.user_id is not null and public.has_role(p.user_id, 'admin'))
  ),
  known as (
    select distinct session_id
    from public.page_views
    where user_id is not null
  ),
  pv as (
    -- page_views_human already drops crawler and internal-flagged rows.
    select * from public.page_views_human p
    where p.created_at >= since
      and (not _exclude_internal or not exists (
        select 1 from mine m where m.session_id = p.session_id
      ))
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
  ),
  filtered as (
    select f.filter_reason, count(distinct f.session_id)::int as sessions
    from public.page_views_filtered f
    where f.created_at >= since
    group by 1
  )
  select jsonb_build_object(
    'pageviews', (select count(*) from pv),
    'visitors', (select count(distinct session_id) from pv),
    'internal_pageviews', (
      select count(*) from public.page_views p
      where p.created_at >= since
        and exists (select 1 from mine m where m.session_id = p.session_id)
    ),
    'excluded', jsonb_build_object(
      'automated', coalesce((select sum(sessions) from filtered where filter_reason in ('known_bot','suspected_bot')), 0),
      'internal', coalesce((select sum(sessions) from filtered where filter_reason = 'internal'), 0)
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