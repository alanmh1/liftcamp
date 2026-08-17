INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('alanmh@gmail.com', 'alan@alanharris.io')
ON CONFLICT DO NOTHING;