-- install_events: let the app insert its first-open rows.
-- SUPABASE (SQL editor). Run Section 0, read it, then Section 1.
--
-- docs/funnel-admin.sql created the table and an INSERT policy for anon
-- and authenticated, but no table grant. Both roles held only REFERENCES
-- and TRIGGER (checked 3 Nov 2026), so every app_opened upsert from the
-- app was refused before RLS was consulted, and the client swallowed the
-- error. Production had 0 rows while 3 fresh installs happened after
-- 27 Oct.
--
-- INSERT only. The table stays unreadable through the API (no SELECT
-- grant, no select policy); admin_funnel() (SECURITY DEFINER) is the one
-- reader. The upsert uses ON CONFLICT DO NOTHING with no RETURNING, which
-- needs INSERT alone. Never GRANT ALL here.

-- Section 0. Current grants and policies.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'install_events'
ORDER BY grantee, privilege_type;

SELECT policyname, cmd, roles, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'install_events'
ORDER BY policyname;

-- Section 1. The grant.
GRANT INSERT ON public.install_events TO anon, authenticated;

-- Check. anon and authenticated each show INSERT, REFERENCES, TRIGGER and
-- nothing else.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'install_events'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- After the app update: a fresh install, or a Simulator build with no
-- stored session, adds one row (the Simulator's with props.env = 'dev').
-- SELECT props, created_at FROM public.install_events
-- ORDER BY created_at DESC LIMIT 10;
