-- Tester Pro grants: user_entitlements, plus two admin functions for /admin.
--
-- Run in SUPABASE (SQL editor). Idempotent; safe to run twice. Read Section
-- 0's output before running Section 1.
--
-- The table is the one pro-billing defines (docs/pro-billing.sql on that
-- branch): same columns, same constraint name, same policy name, same
-- grants. The one difference is that 'tester' is in the allowed sources.
-- pro-billing's script only adds the constraint when no constraint of that
-- name exists, so it runs cleanly after this one. See docs/pro-billing.md
-- for what pro-billing still has to change before it merges.
--
-- Who writes what:
--   admin_set_entitlement   rows with source 'tester', admins only.
--   revenuecat-webhook      every other source (pro-billing, service_role).
--   nobody else             no insert, update or delete for anon or
--                           authenticated; a user reads only their own row.
--
-- Section 1b locks down user_roles: today RLS alone keeps clients from
-- writing it (anon and authenticated hold INSERT, UPDATE and DELETE, with
-- only a SELECT policy), and admin_set_entitlement trusts that table.
--
-- merge_guest_account is not changed. Its leftover-rows check would stop a
-- merge if a guest had a row here, but admin_set_entitlement only grants
-- non-anonymous users, so this file never gives a guest a row.

-- =====================================================================
-- Section 0. Diagnostics, read only. Run on its own and read the output.
-- =====================================================================
-- Expect, as of 3 Oct 2026: user_entitlements null (not created yet),
-- has_role present, app_role holding admin, 2 admins, neither function.
--
-- SELECT
--   to_regclass('public.user_entitlements')::text AS user_entitlements,
--   to_regprocedure('public.has_role(uuid, public.app_role)')::text AS has_role,
--   (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e
--     JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role') AS app_role_values,
--   (SELECT count(*) FROM public.user_roles WHERE role = 'admin') AS admins,
--   to_regprocedure('public.admin_list_entitlements()')::text AS list_fn,
--   to_regprocedure('public.admin_set_entitlement(text, boolean, timestamptz)')::text AS set_fn,
--   (SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'user_entitlements_source_check') AS source_check;
--
-- user_roles before Section 1b. Expect, as of 3 Oct 2026, RLS on, the one
-- SELECT policy, and anon and authenticated each holding DELETE, INSERT,
-- REFERENCES, SELECT, TRIGGER and UPDATE.
--
-- SELECT
--   (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_roles'::regclass) AS rls,
--   (SELECT json_agg(policyname || ':' || cmd) FROM pg_policies WHERE tablename = 'user_roles') AS policies,
--   (SELECT json_agg(grantee || ':' || privilege_type ORDER BY grantee, privilege_type)
--      FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND table_name = 'user_roles'
--        AND grantee IN ('anon', 'authenticated')) AS grants;

-- =====================================================================
-- Section 1. Changes
-- =====================================================================
BEGIN;

-- The table, as pro-billing defines it.
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  is_pro     boolean NOT NULL DEFAULT false,
  -- RevenueCat's store name for a purchase, or 'tester' for an admin grant.
  source     text NOT NULL,
  product_id text,
  -- Null for a lifetime purchase and for a grant with no end.
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Drift is expected, so add any column a hand-made table lacks.
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.user_entitlements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- pro-billing's source list plus 'tester', under pro-billing's constraint
-- name. A constraint of that name without 'tester' (pro-billing run first)
-- is replaced.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_entitlements_source_check'
      AND conrelid = 'public.user_entitlements'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%''tester''%'
  ) THEN
    ALTER TABLE public.user_entitlements DROP CONSTRAINT user_entitlements_source_check;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_entitlements_source_check'
      AND conrelid = 'public.user_entitlements'::regclass
  ) THEN
    ALTER TABLE public.user_entitlements
      ADD CONSTRAINT user_entitlements_source_check
      CHECK (source IN ('app_store', 'play_store', 'stripe', 'rc_billing', 'promotional', 'amazon', 'tester'));
  END IF;
END $$;

COMMENT ON TABLE public.user_entitlements IS
  'Pro state per user. source ''tester'' rows come from admin_set_entitlement; every other source from the RevenueCat webhook. Pro now = is_pro and (expires_at is null or expires_at > now()).';

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own entitlement" ON public.user_entitlements;
CREATE POLICY "Users read their own entitlement"
  ON public.user_entitlements
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- No insert, update or delete policy, and no such grant: no client writes.
-- Guests are in the authenticated role too and read their own row (none).

REVOKE ALL ON public.user_entitlements FROM anon, authenticated;
GRANT SELECT ON public.user_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_entitlements TO service_role;

-- Every user with a row, newest change first. Admins only.
CREATE OR REPLACE FUNCTION public.admin_list_entitlements()
RETURNS TABLE (
  email      text,
  user_id    uuid,
  is_pro     boolean,
  source     text,
  expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.email::text, e.user_id, e.is_pro, e.source, e.expires_at, e.updated_at
  FROM public.user_entitlements e
  JOIN auth.users u ON u.id = e.user_id
  ORDER BY e.updated_at DESC;
END
$function$;

-- Grants (p_is_pro true) or revokes (false) a tester's Pro, by email.
-- Admins only, and only ever a 'tester' row: a user whose row has any other
-- source (a purchase, a RevenueCat promotional grant) is refused both ways.
-- Returns the row after a grant, null after a revoke.
CREATE OR REPLACE FUNCTION public.admin_set_entitlement(
  p_email      text,
  p_is_pro     boolean,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.user_entitlements
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_user     uuid;
  v_matches  integer;
  v_existing public.user_entitlements%ROWTYPE;
  v_row      public.user_entitlements%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'Enter an email address.' USING ERRCODE = '22023';
  END IF;
  IF p_is_pro IS NULL THEN
    RAISE EXCEPTION 'Say whether to grant or revoke.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), min(u.id::text)::uuid INTO v_matches, v_user
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.is_anonymous IS NOT TRUE;
  IF v_matches = 0 THEN
    RAISE EXCEPTION 'No signed-up account uses %.', v_email USING ERRCODE = 'P0002';
  END IF;
  IF v_matches > 1 THEN
    RAISE EXCEPTION '% accounts use %; grant by user id in the SQL editor instead.', v_matches, v_email
      USING ERRCODE = '21000';
  END IF;

  -- Locked, so a webhook write cannot land between this check and the write.
  SELECT * INTO v_existing FROM public.user_entitlements WHERE user_id = v_user FOR UPDATE;
  IF FOUND AND v_existing.source IS DISTINCT FROM 'tester' THEN
    RAISE EXCEPTION '% already has Pro from %. A tester grant never replaces it.', v_email, v_existing.source
      USING ERRCODE = '42501';
  END IF;

  IF NOT p_is_pro THEN
    DELETE FROM public.user_entitlements WHERE user_id = v_user AND source = 'tester';
    RETURN NULL;
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'The expiry is in the past.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_entitlements AS e (user_id, is_pro, source, product_id, expires_at, updated_at)
  VALUES (v_user, true, 'tester', NULL, p_expires_at, now())
  ON CONFLICT (user_id) DO UPDATE
    SET is_pro = true, expires_at = excluded.expires_at, updated_at = now()
    WHERE e.source = 'tester'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION '% got Pro from another source just now. Reload and check.', v_email
      USING ERRCODE = '40001';
  END IF;
  RETURN v_row;
END
$function$;

-- Each function checks the admin role itself, so any signed-in user may
-- call it and a non-admin gets 'not authorized'. Never anon or PUBLIC.
REVOKE ALL ON FUNCTION public.admin_list_entitlements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_entitlement(text, boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_entitlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_entitlement(text, boolean, timestamptz) TO authenticated;

COMMIT;

-- =====================================================================
-- Section 1b. Lock down user_roles
-- =====================================================================
-- Admin rights come from this table (has_role, current_user_is_admin), and
-- admin_set_entitlement grants Pro on the strength of it. No client writes
-- it: checked 3 Oct 2026, nothing in apps/mobile, apps/web, packages/shared
-- or supabase/functions touches user_roles, and the database functions that
-- name it only read it (has_role, current_user_is_admin, merge_guest_account,
-- purge_empty_guests). No trigger writes it. Roles are granted by hand in
-- the SQL editor, as postgres, which this does not affect.
--
-- So the write grants go, and the SELECT the "Users can read their own
-- roles" policy relies on stays. Revoking a privilege a role does not hold
-- is a no-op, so this is safe to run twice.
BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

COMMIT;

-- =====================================================================
-- Section 2. Checks
-- =====================================================================
-- 2a. Structure. Expect rls true, one SELECT policy for authenticated,
-- authenticated:SELECT only on the table, the check listing 'tester', and
-- EXECUTE for authenticated (not anon) on both functions.
--
-- SELECT
--   (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_entitlements'::regclass) AS rls,
--   (SELECT json_agg(json_build_object('name', policyname, 'cmd', cmd, 'roles', roles))
--      FROM pg_policies WHERE tablename = 'user_entitlements') AS policies,
--   (SELECT json_agg(grantee || ':' || privilege_type ORDER BY grantee, privilege_type)
--      FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND table_name = 'user_entitlements'
--        AND grantee IN ('anon', 'authenticated')) AS table_grants,
--   (SELECT pg_get_constraintdef(oid) FROM pg_constraint
--      WHERE conname = 'user_entitlements_source_check') AS source_check,
--   has_function_privilege('anon', 'public.admin_set_entitlement(text, boolean, timestamptz)', 'EXECUTE') AS anon_can_set,
--   has_function_privilege('authenticated', 'public.admin_set_entitlement(text, boolean, timestamptz)', 'EXECUTE') AS authed_can_set,
--   has_function_privilege('anon', 'public.admin_list_entitlements()', 'EXECUTE') AS anon_can_list,
--   (SELECT json_agg(grantee || ':' || privilege_type ORDER BY grantee, privilege_type)
--      FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND table_name = 'user_roles'
--        AND grantee IN ('anon', 'authenticated')) AS user_roles_grants;
--   -- user_roles_grants: REFERENCES, SELECT and TRIGGER only, for each role.
--
-- 2b. A signed-in non-admin is refused. Run each block on its own; each
-- should end in an error and the rollback leaves nothing behind. The user
-- is any signed-up account without a role.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT * FROM public.admin_list_entitlements();          -- expect: not authorized
-- ROLLBACK;
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT public.admin_set_entitlement('you@example.com', true);   -- expect: not authorized
-- ROLLBACK;
--
-- 2c. The same user cannot write the table directly.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- INSERT INTO public.user_entitlements (user_id, is_pro, source)
--   VALUES (auth.uid(), true, 'tester');                       -- expect: permission denied
-- ROLLBACK;
--
-- 2d. The same user cannot make themselves an admin.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- INSERT INTO public.user_roles (user_id, role)
--   VALUES (auth.uid(), 'admin');                               -- expect: permission denied
-- ROLLBACK;
