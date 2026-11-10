-- LiftCamp: RevenueCat billing and the pro_launched flag.
-- SUPABASE (SQL editor). Not applied. Idempotent, safe to run twice.
-- Written against the live database on 5 Nov 2026 (read only).
--
-- Run Section 0 alone first and read it. Then run Sections 1 to 6 together:
-- they sit in one transaction, so a guard that raises changes nothing. Then
-- Section 7. Deploy revenuecat-webhook after this file, because its upsert
-- needs the new key.
--
--   Section 1  guards: every function this file patches, checked by md5
--   Section 2  function patches
--   Section 3  user_entitlements: the (user_id, source) key and source values
--   Section 4  the pro_launched flag, off, and pro_launched() for the app
--   Section 5  revenuecat_webhook_events, the webhook's ledger
--   Section 6  commit
--   Section 7  checks
--
-- The migration to (user_id, source)
--   Today the key is (user_id), so a user holds one row. A tester who bought
--   Pro would need a tester row and a purchase row at once, and the webhook
--   would have to choose between overwriting the grant and dropping the
--   purchase. With (user_id, source) both exist and neither writer can reach
--   the other's row.
--   The 6 live rows are all 'tester', one per user, and stay as they are.
--   source is already NOT NULL, the new key leads with user_id, so lookups by
--   user still use it, and the foreign key is unchanged. The swap takes a
--   brief lock on a 6-row table.
--   Four things assumed one row and are patched in Section 2: admin_set_entitlement
--   (ON CONFLICT (user_id) would fail outright), admin_user_summary (a scalar
--   subquery that would error on two rows), admin_delete_user (it would check an
--   arbitrary row), and merge_guest_account. private.is_pro and
--   admin_list_entitlements already handle several rows.
--   The app on this branch reads all rows. Builds already shipped use
--   maybeSingle(), which fails on two rows and keeps their cached row, so a
--   tester on an old build who has two rows keeps Pro from the cache. They
--   cannot buy on an old build, so this needs a tester who bought on a new one.
--
-- Source values
--   'purchase' and 'promotional' are written by the webhook and 'tester' by
--   admin_set_entitlement. The check is narrowed to those three; the store
--   names it listed before were never used (Section 3 refuses if one was).

-- =====================================================================
-- Section 0. Diagnostics. Run this alone first and read the output.
-- =====================================================================
SELECT
  to_regclass('public.revenuecat_webhook_events')::text AS webhook_events,
  (SELECT count(*) FROM public.app_flags WHERE flag = 'pro_launched') AS pro_launched_rows,
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'user_entitlements_pkey') AS entitlement_key,
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'user_entitlements_source_check') AS source_check,
  (SELECT jsonb_object_agg(source, n) FROM (SELECT source, count(*) AS n FROM public.user_entitlements GROUP BY 1) s) AS rows_by_source,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_entitlement(text, boolean, timestamptz)'::regprocedure) AS set_entitlement_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_user_summary(text)'::regprocedure) AS user_summary_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_delete_user(text, text)'::regprocedure) AS delete_user_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_flag(text, text, text)'::regprocedure) AS set_flag_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_global_flag(text, boolean)'::regprocedure) AS set_global_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.purge_empty_guests(interval, integer)'::regprocedure) AS purge_md5,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.merge_guest_account(uuid, uuid)'::regprocedure) AS merge_md5;
-- Expected on 5 Nov 2026: webhook_events null, pro_launched_rows 0,
-- entitlement_key PRIMARY KEY (user_id), rows_by_source {"tester": 6},
-- set_entitlement_md5 4db5e7334f2c67a08870ea38d23570a0,
-- user_summary_md5    19a664b9cde9e2d02b7fa9056b16f7e6,
-- delete_user_md5     b8826282313ec1812f015770591bbe21,
-- set_flag_md5        548a70af80dc3feadeddb0d42ade99a2,
-- set_global_md5      eb45a315c2440dce8617939d049e9ab5,
-- purge_md5           901e91d1b8c3b76e8d8da6f303b736db,
-- merge_md5           3d4fcf548903a59119efaeb2135cca9a.

BEGIN;

-- =====================================================================
-- Sections 1 and 2. Guards, then function patches
-- =====================================================================
-- Each patch swaps one piece of text in the live definition, so the rest
-- of the body and the grants stay. Every function is checked before any is
-- changed. A patch already applied is skipped, which is what makes a second
-- run safe. Anything else raises: the function changed, so read its body.
CREATE TEMP TABLE rc_patches (
  ord     serial,
  fn      regprocedure NOT NULL,
  old_md5 text NOT NULL,
  find    text NOT NULL,
  put     text NOT NULL
) ON COMMIT DROP;

INSERT INTO rc_patches (fn, old_md5, find, put) VALUES
-- The flag lists. Three things refuse a new flag name: the two CHECK
-- constraints (Section 4) and the list in each of these.
('public.admin_set_flag(text, text, text)', '548a70af80dc3feadeddb0d42ade99a2',
 $q$('social', 'custom_exercises')$q$,
 $q$('social', 'custom_exercises', 'pro_launched')$q$),
('public.admin_set_global_flag(text, boolean)', 'eb45a315c2440dce8617939d049e9ab5',
 $q$('social', 'custom_exercises')$q$,
 $q$('social', 'custom_exercises', 'pro_launched')$q$),

-- /admin grants. Still refuses when the user has any non-tester row, and
-- still writes only 'tester' rows.
('public.admin_set_entitlement(text, boolean, timestamptz)', '4db5e7334f2c67a08870ea38d23570a0',
 $q$SELECT * INTO v_existing FROM public.user_entitlements WHERE user_id = v_user FOR UPDATE;
  IF FOUND AND v_existing.source IS DISTINCT FROM 'tester' THEN$q$,
 $q$SELECT * INTO v_existing FROM public.user_entitlements
  WHERE user_id = v_user AND source <> 'tester' ORDER BY source LIMIT 1 FOR UPDATE;
  IF FOUND THEN$q$),
('public.admin_set_entitlement(text, boolean, timestamptz)', '4db5e7334f2c67a08870ea38d23570a0',
 $q$ON CONFLICT (user_id) DO UPDATE$q$,
 $q$ON CONFLICT (user_id, source) DO UPDATE$q$),

-- /admin user lookup: every source, instead of an error on two rows.
('public.admin_user_summary(text)', '19a664b9cde9e2d02b7fa9056b16f7e6',
 $q$(SELECT e.source FROM public.user_entitlements e WHERE e.user_id = u.id)$q$,
 $q$(SELECT string_agg(e.source, ', ' ORDER BY e.source) FROM public.user_entitlements e WHERE e.user_id = u.id)$q$),

-- /admin delete: refuses on any non-tester row, whichever row comes first.
('public.admin_delete_user(text, text)', 'b8826282313ec1812f015770591bbe21',
 $q$SELECT * INTO v_existing FROM public.user_entitlements WHERE user_id = v_user FOR UPDATE;
  IF FOUND AND v_existing.source IS DISTINCT FROM 'tester' THEN$q$,
 $q$SELECT * INTO v_existing FROM public.user_entitlements
  WHERE user_id = v_user AND source <> 'tester' ORDER BY source LIMIT 1 FOR UPDATE;
  IF FOUND THEN$q$),

-- A guest who bought Pro without finishing a workout would otherwise be
-- purged, leaving the purchase on a deleted id until a Restore.
('private.purge_empty_guests(interval, integer)', '901e91d1b8c3b76e8d8da6f303b736db',
 $q$      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
$q$,
 $q$      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_entitlements ue WHERE ue.user_id = u.id)
$q$),

-- The merge's entitlement rule, before its leftover check, so that check
-- never fires for this table. Rows are matched by source. Where both sides
-- hold one, the account's row stays and takes the later expiry, with no
-- expiry beating any date; a lapsed row (is_pro false) never beats a live
-- one. Any other non-tester row moves. A tester grant is personal and never
-- moves, so whatever is left of the guest's is deleted.
('public.merge_guest_account(uuid, uuid)', '3d4fcf548903a59119efaeb2135cca9a',
 $q$  -- Nothing of the guest's may be left for the delete to cascade away.$q$,
 $q$  -- Pro follows the person. Where both hold a row for a source, the
  -- account's row stays and takes the later expiry (none beats any date),
  -- and a lapsed row never beats a live one. Other non-tester rows move.
  -- Tester grants are personal, so any left on the guest go.
  UPDATE public.user_entitlements t
  SET is_pro = g.is_pro, product_id = g.product_id, expires_at = g.expires_at, updated_at = now()
  FROM public.user_entitlements g
  WHERE g.user_id = p_guest AND t.user_id = p_target
    AND g.source = t.source AND g.source <> 'tester'
    AND g.is_pro
    AND (NOT t.is_pro
         OR (t.expires_at IS NOT NULL AND (g.expires_at IS NULL OR g.expires_at > t.expires_at)));
  UPDATE public.user_entitlements g SET user_id = p_target, updated_at = now()
  WHERE g.user_id = p_guest AND g.source <> 'tester'
    AND NOT EXISTS (SELECT 1 FROM public.user_entitlements t
                    WHERE t.user_id = p_target AND t.source = g.source);
  DELETE FROM public.user_entitlements WHERE user_id = p_guest;

  -- Nothing of the guest's may be left for the delete to cascade away.$q$);

DO $$
DECLARE
  r     record;
  v_src text;
BEGIN
  -- Section 1. Nothing is changed until every function has passed.
  FOR r IN SELECT * FROM rc_patches ORDER BY ord LOOP
    SELECT prosrc INTO v_src FROM pg_proc WHERE oid = r.fn;
    IF v_src IS NULL THEN
      RAISE EXCEPTION '% is missing', r.fn;
    END IF;
    IF position(r.put IN v_src) = 0 AND md5(v_src) IS DISTINCT FROM r.old_md5 THEN
      RAISE EXCEPTION '% changed since 5 Nov 2026; read its body first', r.fn;
    END IF;
  END LOOP;

  -- Section 2.
  FOR r IN SELECT * FROM rc_patches ORDER BY ord LOOP
    SELECT prosrc INTO v_src FROM pg_proc WHERE oid = r.fn;
    IF position(r.put IN v_src) = 0 THEN
      EXECUTE replace(pg_get_functiondef(r.fn), r.find, r.put);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- Section 3. user_entitlements
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('public.user_entitlements') IS NULL THEN
    RAISE EXCEPTION 'public.user_entitlements is missing; apply 20261003120000_tester_entitlements.sql first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_entitlements WHERE source NOT IN ('purchase', 'promotional', 'tester')) THEN
    RAISE EXCEPTION 'user_entitlements holds a source this file does not know; read the rows first';
  END IF;
END $$;

ALTER TABLE public.user_entitlements DROP CONSTRAINT IF EXISTS user_entitlements_source_check;
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_source_check
  CHECK (source IN ('purchase', 'promotional', 'tester'));

DO $$
BEGIN
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'user_entitlements_pkey')
     IS DISTINCT FROM 'PRIMARY KEY (user_id, source)' THEN
    ALTER TABLE public.user_entitlements DROP CONSTRAINT IF EXISTS user_entitlements_pkey;
    ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (user_id, source);
  END IF;
END $$;

COMMENT ON TABLE public.user_entitlements IS
  'Pro per user and source. tester rows come from admin_set_entitlement; purchase and promotional rows from the revenuecat-webhook function. Pro now = any row with is_pro and (expires_at is null or expires_at > now()).';

-- =====================================================================
-- Section 4. The pro_launched flag
-- =====================================================================
ALTER TABLE public.user_flags DROP CONSTRAINT IF EXISTS user_flags_flag_check;
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched'));
ALTER TABLE public.app_flags DROP CONSTRAINT IF EXISTS app_flags_flag_check;
ALTER TABLE public.app_flags ADD CONSTRAINT app_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched'));

INSERT INTO public.app_flags (flag, enabled_for_all) VALUES ('pro_launched', false)
ON CONFLICT (flag) DO NOTHING;

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
-- Section 5. revenuecat_webhook_events
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
-- Section 6. Commit
-- =====================================================================
COMMIT;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Section 7. Checks
-- =====================================================================
SELECT
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'user_entitlements_pkey') AS entitlement_key,
  (SELECT count(*) FROM public.user_entitlements WHERE source = 'tester') AS tester_rows,
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
-- Expected: entitlement_key PRIMARY KEY (user_id, source), tester_rows 6,
-- pro_launched_global false, events_rls true, events_client_grants 0,
-- pro_launched_acl {postgres=X/postgres,authenticated=X/postgres,
-- service_role=X/postgres}, merge_acl {postgres=X/postgres,
-- service_role=X/postgres}, both handles true, purge_args with '90 days'.
