create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  path text not null,
  referrer_host text,
  device text,
  is_internal boolean not null default false,
  user_id uuid,
  created_at timestamptz not null default now()
);

grant insert on public.page_views to anon;
grant insert on public.page_views to authenticated;
grant all on public.page_views to service_role;

alter table public.page_views enable row level security;

drop policy if exists "page_views insert anyone" on public.page_views;
create policy "page_views insert anyone" on public.page_views
  for insert to anon, authenticated with check (true);

drop policy if exists page_views_no_select on public.page_views;
create policy page_views_no_select on public.page_views
  as restrictive for select to anon, authenticated using (false);
drop policy if exists page_views_no_update on public.page_views;
create policy page_views_no_update on public.page_views
  as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists page_views_no_delete on public.page_views;
create policy page_views_no_delete on public.page_views
  as restrictive for delete to anon, authenticated using (false);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_session_idx on public.page_views (session_id);

create or replace function public.admin_traffic(_days integer default 30, _exclude_internal boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
  )
  select jsonb_build_object(
    'pageviews', (select count(*) from pv),
    'visitors', (select count(distinct session_id) from pv),
    'internal_pageviews', (
      select count(*) from public.page_views
      where created_at >= since and is_internal = true
    ),
    'daily', coalesce((
      select jsonb_agg(x order by x->>'day')
      from (
        select jsonb_build_object(
          'day', d::date,
          'pageviews', count(pv.id),
          'visitors', count(distinct pv.session_id)
        ) as x
        from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d
        left join pv on date_trunc('day', pv.created_at) = d
        group by d
      ) s
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object('path', path, 'views', count(*), 'visitors', count(distinct session_id)) as x
        from pv group by path order by count(*) desc limit 15
      ) s
    ), '[]'::jsonb),
    'top_sources', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object('source', coalesce(nullif(referrer_host,''), 'Direct'), 'visits', count(distinct session_id)) as x
        from pv group by 1 order by count(distinct session_id) desc limit 10
      ) s
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object('device', coalesce(device,'unknown'), 'visits', count(distinct session_id)) as x
        from pv group by 1 order by count(distinct session_id) desc
      ) s
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_traffic(integer, boolean) from public, anon;
grant execute on function public.admin_traffic(integer, boolean) to authenticated, service_role;