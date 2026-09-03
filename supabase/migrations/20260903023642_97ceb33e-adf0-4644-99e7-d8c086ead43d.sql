create or replace function public.admin_routines(_days integer default 30, _exclude_internal boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
  since timestamptz := now() - make_interval(days => greatest(1, least(_days, 180)));
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  with pv as (
    select * from public.page_views p
    where p.created_at >= since
      and (not _exclude_internal or p.is_internal = false)
      and p.path like '/routines%'
  ),
  index_v as (select * from pv where path = '/routines'),
  builder_v as (select * from pv where path like '/routines/build%'),
  detail_v as (select * from pv where path like '/routines/%' and path not like '/routines/build%'),
  detail_pages as (
    select path, count(*)::int as views, count(distinct session_id)::int as visitors
    from detail_v group by path order by count(*) desc limit 15
  ),
  daily as (
    select d::date as day,
           count(distinct case when pv.path = '/routines' then pv.id end)::int as index_views,
           count(distinct case when pv.path like '/routines/build%' then pv.id end)::int as builder_views,
           count(distinct case when pv.path like '/routines/%' and pv.path not like '/routines/build%' then pv.id end)::int as detail_views
    from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d
    left join pv on date_trunc('day', pv.created_at) = d
    group by d
  ),
  builder_sessions as (select distinct session_id from builder_v),
  signed_up as (
    select distinct p.session_id
    from public.page_views p
    join builder_sessions b on b.session_id = p.session_id
    where p.user_id is not null
  ),
  routine_starts as (
    select coalesce(nullif(e.props->>'template',''), 'unknown') as template,
           (e.props->>'is_system') = 'true' as is_system,
           count(*)::int as starts,
           count(distinct e.user_id)::int as users
    from public.app_events e
    where e.name = 'routine_chosen' and e.created_at >= since
    group by 1,2
    order by count(*) desc
    limit 15
  )
  select jsonb_build_object(
    'index_views', (select count(*) from index_v),
    'index_visitors', (select count(distinct session_id) from index_v),
    'detail_views', (select count(*) from detail_v),
    'detail_visitors', (select count(distinct session_id) from detail_v),
    'builder_views', (select count(*) from builder_v),
    'builder_visitors', (select count(distinct session_id) from builder_v),
    'builder_signups', (select count(*) from signed_up),
    'routines_saved', (
      select count(*) from public.templates
      where user_id is not null and created_at >= since
    ),
    'routines_saved_total', (select count(*) from public.templates where user_id is not null),
    'routines_shared', (
      select count(*) from public.templates
      where share_token is not null and coalesce(shared_at, created_at) >= since
    ),
    'system_routine_starts', (
      select count(*) from public.app_events
      where name = 'routine_chosen' and created_at >= since and props->>'is_system' = 'true'
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.day) from daily x), '[]'::jsonb),
    'top_routines', coalesce((select jsonb_agg(to_jsonb(x)) from detail_pages x), '[]'::jsonb),
    'routine_starts', coalesce((select jsonb_agg(to_jsonb(x)) from routine_starts x), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke execute on function public.admin_routines(integer, boolean) from public, anon;
grant execute on function public.admin_routines(integer, boolean) to authenticated, service_role;