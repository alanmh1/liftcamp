create or replace function public.routines_built_this_week()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.templates
  where coalesce(is_system, false) = false
    and created_at >= now() - interval '7 days'
$$;

grant execute on function public.routines_built_this_week() to anon, authenticated, service_role;