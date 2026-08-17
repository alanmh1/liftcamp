REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;