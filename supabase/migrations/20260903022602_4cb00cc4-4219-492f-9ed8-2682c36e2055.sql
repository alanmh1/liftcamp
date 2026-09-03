REVOKE ALL ON FUNCTION public.admin_traffic(integer, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_traffic(integer, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_overview(integer) TO authenticated, service_role;