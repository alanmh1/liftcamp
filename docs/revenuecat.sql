-- LiftCamp: RevenueCat billing and the pro_launched flag.
-- SUPABASE (SQL editor). Not applied. Idempotent, safe to run twice.
-- Run Section 0 alone first and read it. Written against the live database
-- on 5 Nov 2026 (read only).
--
-- user_entitlements already exists (20261003120000_tester_entitlements.sql)
-- with 'tester' in its source check, so this file does not touch it.
--
--   Section 1  the pro_launched flag, off, and pro_launched() for the app
--   Section 2  revenuecat_webhook_events, the webhook's ledger
--   Section 3  private.purge_empty_guests keeps a guest who has had Pro
--   Section 4  merge_guest_account drops the guest's entitlement row
--   Section 5  checks
--
-- Each function change is guarded on the md5 of the live body. A guard that
-- raises means the function changed: read its body before going on.

-- =====================================================================
-- Section 0. Diagnostics. Run this alone first and read the output.
-- =====================================================================
SELECT
  to_regclass('public.revenuecat_webhook_events')::text AS webhook_events,
  (SELECT count(*) FROM public.app_flags WHERE flag = 'pro_launched') AS pro_launched_rows,
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'app_flags_flag_check') AS app_flags_check,
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'user_flags_flag_check') AS user_flags_check,
  (SELECT count(*) FROM public.user_entitlements WHERE source <> 'tester') AS non_tester_rows,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_flag(text, text, text)'::regprocedure) AS set_flag_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_global_flag(text, boolean)'::regprocedure) AS set_global_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.purge_empty_guests(interval, integer)'::regprocedure) AS purge_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.merge_guest_account(uuid, uuid)'::regprocedure) AS merge_md5;
-- Expected on 5 Nov 2026: webhook_events null, pro_launched_rows 0, both
-- checks list social and custom_exercises only, non_tester_rows 0,
-- set_flag_md5 548a70af80dc3feadeddb0d42ade99a2,
-- set_global_md5 eb45a315c2440dce8617939d049e9ab5,
-- purge_md5 901e91d1b8c3b76e8d8da6f303b736db,
-- merge_md5 3d4fcf548903a59119efaeb2135cca9a.

-- =====================================================================
-- Section 1. The pro_launched flag
-- =====================================================================
-- Three things refuse a new flag name: the two CHECK constraints and the
-- list inside each admin function. All are widened here, so the switch in
-- /admin Feature flags works.
ALTER TABLE public.user_flags DROP CONSTRAINT IF EXISTS user_flags_flag_check;
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched'));
ALTER TABLE public.app_flags DROP CONSTRAINT IF EXISTS app_flags_flag_check;
ALTER TABLE public.app_flags ADD CONSTRAINT app_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched'));

INSERT INTO public.app_flags (flag, enabled_for_all) VALUES ('pro_launched', false)
ON CONFLICT (flag) DO NOTHING;

-- The only change to each function is the flag list. The live definition
-- is patched in place, which keeps the rest of the body and the grants.
DO $$
DECLARE
  v_old text := $q$('social', 'custom_exercises')$q$;
  v_new text := $q$('social', 'custom_exercises', 'pro_launched')$q$;
  v_def text;
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_flag(text, text, text)'::regprocedure)
     = '548a70af80dc3feadeddb0d42ade99a2' THEN
    v_def := pg_get_functiondef('public.admin_set_flag(text, text, text)'::regprocedure);
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position(v_new IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.admin_set_flag(text, text, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'admin_set_flag changed since 5 Nov 2026; read its body first';
  END IF;

  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_global_flag(text, boolean)'::regprocedure)
     = 'eb45a315c2440dce8617939d049e9ab5' THEN
    v_def := pg_get_functiondef('public.admin_set_global_flag(text, boolean)'::regprocedure);
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position(v_new IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.admin_set_global_flag(text, boolean)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'admin_set_global_flag changed since 5 Nov 2026; read its body first';
  END IF;
END $$;

-- What the app reads. app_flags is closed to guests, and guests can buy,
-- so this is a function. A revoke wins; then the global switch, which
-- reaches guests; then a personal grant, for testing on one account or
-- for the App Review demo account while the switch is off.
CREATE OR REPLACE FUNCTION public.pro_launched()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NOT EXISTS (
      SELECT 1 FROM public.user_flags f
      WHERE f.user_id = auth.uid() AND f.flag = 'pro_launched' AND f.state = 'revoked'
    )
    AND (
      EXISTS (SELECT 1 FROM public.app_flags a WHERE a.flag = 'pro_launched' AND a.enabled_for_all)
      OR EXISTS (
        SELECT 1 FROM public.user_flags f
        WHERE f.user_id = auth.uid() AND f.flag = 'pro_launched' AND f.state = 'granted'
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.pro_launched() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pro_launched() TO authenticated, service_role;

-- =====================================================================
-- Section 2. revenuecat_webhook_events
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  app_user_id  text,
  environment  text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  -- Null until every user the event names has been synced. A delivery that
  -- finds this set answers 200 and does nothing.
  processed_at timestamptz
);

ALTER TABLE public.revenuecat_webhook_events ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: nobody but service_role touches it.
REVOKE ALL ON public.revenuecat_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenuecat_webhook_events TO service_role;

-- =====================================================================
-- Section 3. private.purge_empty_guests keeps anyone who has had Pro
-- =====================================================================
-- A guest who bought Pro without finishing a workout would otherwise be
-- purged, leaving the purchase on a deleted id until a Restore. The body is
-- the live one plus the user_entitlements line, with the live 90 day
-- default. The md5 does not cover the default, so it is written out here.
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc
       WHERE oid = 'private.purge_empty_guests(interval, integer)'::regprocedure)
     <> '901e91d1b8c3b76e8d8da6f303b736db'
     AND position('user_entitlements' IN (SELECT prosrc FROM pg_proc
       WHERE oid = 'private.purge_empty_guests(interval, integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'purge_empty_guests changed since 5 Nov 2026; read its body first';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.purge_empty_guests(max_age interval DEFAULT '90 days'::interval, batch integer DEFAULT 500)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  WITH doomed AS (
    SELECT u.id
    FROM auth.users u
    WHERE u.is_anonymous
      AND u.created_at < now() - max_age
      AND NOT EXISTS (SELECT 1 FROM public.workouts w WHERE w.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.templates t WHERE t.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_entitlements ue WHERE ue.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.page_views p
                      WHERE p.user_id = u.id AND p.created_at > now() - max_age)
      AND NOT EXISTS (SELECT 1 FROM public.app_events e
                      WHERE e.user_id = u.id AND e.created_at > now() - max_age)
    ORDER BY u.created_at
    LIMIT batch
  ), gone AS (
    DELETE FROM auth.users u USING doomed d WHERE u.id = d.id RETURNING u.id
  )
  SELECT count(*)::integer FROM gone;
$function$;

-- =====================================================================
-- Section 4. merge_guest_account drops the guest's entitlement row
-- =====================================================================
-- The merge refuses to delete a guest while any public table keyed to
-- auth.users holds a guest row, so a guest who bought Pro could never be
-- merged. The row is deleted, not moved: RevenueCat's TRANSFER event writes
-- the account's row. The one line goes in before the leftover check, into
-- the live definition, so the rest of the body and the grants stay.
DO $$
DECLARE
  v_oid    regprocedure := 'public.merge_guest_account(uuid, uuid)'::regprocedure;
  v_marker text := $q$  -- Nothing of the guest's may be left for the delete to cascade away.$q$;
  v_line   text := $q$  -- Pro stays with the purchase. RevenueCat's TRANSFER writes the account's row.
  DELETE FROM public.user_entitlements WHERE user_id = p_guest;

$q$;
  v_src    text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
  IF position('public.user_entitlements' IN v_src) > 0 THEN
    RETURN;
  END IF;
  IF md5(v_src) <> '3d4fcf548903a59119efaeb2135cca9a' THEN
    RAISE EXCEPTION 'merge_guest_account changed since 5 Nov 2026; read its body first';
  END IF;
  EXECUTE replace(pg_get_functiondef(v_oid), v_marker, v_line || v_marker);
END $$;

-- =====================================================================
-- Section 5. Checks
-- =====================================================================
SELECT
  (SELECT enabled_for_all FROM public.app_flags WHERE flag = 'pro_launched') AS pro_launched_global,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.revenuecat_webhook_events'::regclass) AS events_rls,
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_name = 'revenuecat_webhook_events' AND grantee IN ('anon', 'authenticated')) AS events_client_grants,
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public.pro_launched()'::regprocedure) AS pro_launched_acl,
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public.merge_guest_account(uuid, uuid)'::regprocedure) AS merge_acl,
  (SELECT prosrc LIKE '%public.user_entitlements%' FROM pg_proc
    WHERE oid = 'public.merge_guest_account(uuid, uuid)'::regprocedure) AS merge_handles_entitlements,
  (SELECT prosrc LIKE '%public.user_entitlements%' FROM pg_proc
    WHERE oid = 'private.purge_empty_guests(interval, integer)'::regprocedure) AS purge_handles_entitlements,
  (SELECT pg_get_function_arguments('private.purge_empty_guests(interval, integer)'::regprocedure)) AS purge_args;
-- Expected: pro_launched_global false, events_rls true, events_client_grants
-- 0, pro_launched_acl {postgres=X/postgres,authenticated=X/postgres,
-- service_role=X/postgres}, merge_acl {postgres=X/postgres,
-- service_role=X/postgres}, both handles true, purge_args with '90 days'.
