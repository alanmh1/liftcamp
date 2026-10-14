-- Delete user from /admin: two admin functions, shaped like
-- admin_set_entitlement (20261003120000_tester_entitlements.sql).
--
-- Run in SUPABASE (SQL editor). Idempotent; safe to run twice. Read Section
-- 0's output before running Section 1.
--
--   admin_user_summary   looks an account up by email, for the page to show
--                        before anything is deleted.
--   admin_delete_user    deletes it, once the admin has typed its username.
--
-- The delete is the same one private.purge_empty_guests runs: DELETE FROM
-- auth.users, and every per-user table goes with it through its ON DELETE
-- CASCADE key (reports and app_flags set their user columns to null). The
-- only rows no key reaches are the email-keyed ones, email_send_log and
-- email_unsubscribe_tokens, which are deleted first, the way the
-- delete-account Edge Function does it. suppressed_emails is kept, as there.
--
-- What the Edge Function does that this cannot: revoke the Apple token (that
-- needs a fresh authorization code from the user's device) and send the
-- confirmation email. An Apple account deleted here stays listed under the
-- person's Apple ID until they remove it.
--
-- The confirmation is the username. An account with no username (no
-- profile row, or a null username) is confirmed with its email instead.
--
-- Refused: your own account, an admin, and anyone whose user_entitlements
-- row has a source other than 'tester' (a purchase or a RevenueCat
-- promotional grant). Those go through the SQL editor on purpose.

-- =====================================================================
-- Section 0. Diagnostics, read only. Run on its own and read the output.
-- =====================================================================
-- Expect: has_role present, both new functions null on the first run, the
-- two email tables present with the columns named below, and every
-- foreign key to auth.users from public either CASCADE (c) or SET NULL (n).
-- A key with any other action (a, r) would make the delete fail; stop and
-- look if one shows up.
--
-- SELECT
--   to_regprocedure('public.has_role(uuid, public.app_role)')::text AS has_role,
--   to_regprocedure('public.admin_user_summary(text)')::text AS summary_fn,
--   to_regprocedure('public.admin_delete_user(text, text)')::text AS delete_fn,
--   (SELECT count(*) FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'email_send_log'
--       AND column_name = 'recipient_email') AS send_log_col,
--   (SELECT count(*) FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'email_unsubscribe_tokens'
--       AND column_name = 'email') AS tokens_col,
--   (SELECT json_agg(c.conrelid::regclass::text || ':' || c.confdeltype ORDER BY 1)
--      FROM pg_constraint c
--      WHERE c.contype = 'f'
--        AND c.confrelid = 'auth.users'::regclass
--        AND c.connamespace IN ('public'::regnamespace, 'private'::regnamespace)) AS user_fkeys;

-- =====================================================================
-- Section 1. Changes
-- =====================================================================
BEGIN;

-- One signed-up account, by email, with what the page shows before a
-- delete. Admins only.
CREATE OR REPLACE FUNCTION public.admin_user_summary(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_user    uuid;
  v_matches integer;
  v_result  jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'Enter an email address.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), min(u.id::text)::uuid INTO v_matches, v_user
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.is_anonymous IS NOT TRUE;
  IF v_matches = 0 THEN
    RAISE EXCEPTION 'No signed-up account uses %.', v_email USING ERRCODE = 'P0002';
  END IF;
  IF v_matches > 1 THEN
    RAISE EXCEPTION '% accounts use %; look them up by user id in the SQL editor instead.', v_matches, v_email
      USING ERRCODE = '21000';
  END IF;

  SELECT jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'username', p.username,
    'created_at', u.created_at,
    'workout_count', (SELECT count(*) FROM public.workouts w WHERE w.user_id = u.id),
    'last_workout_at', (SELECT max(w.created_at) FROM public.workouts w WHERE w.user_id = u.id),
    'entitlement_source', (SELECT e.source FROM public.user_entitlements e WHERE e.user_id = u.id),
    'is_admin', public.has_role(u.id, 'admin'::public.app_role)
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.user_id = u.id
  WHERE u.id = v_user;

  RETURN v_result;
END
$function$;

-- Deletes one signed-up account, by email, once p_confirm_username matches
-- its username (its email when it has no username). Admins only. Every
-- refusal is a sentence the page shows as is.
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_email            text,
  p_confirm_username text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email      text := lower(btrim(coalesce(p_email, '')));
  v_confirm    text := lower(btrim(coalesce(p_confirm_username, '')));
  v_user       uuid;
  v_matches    integer;
  v_user_email text;
  v_username   text;
  v_existing   public.user_entitlements%ROWTYPE;
  v_emails     text[];
  v_workouts   bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'Enter an email address.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), min(u.id::text)::uuid INTO v_matches, v_user
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.is_anonymous IS NOT TRUE;
  IF v_matches = 0 THEN
    RAISE EXCEPTION 'No signed-up account uses %.', v_email USING ERRCODE = 'P0002';
  END IF;
  IF v_matches > 1 THEN
    RAISE EXCEPTION '% accounts use %; delete by user id in the SQL editor instead.', v_matches, v_email
      USING ERRCODE = '21000';
  END IF;

  -- Locked, so a second delete or a sign-in change waits for this one.
  SELECT u.email INTO v_user_email FROM auth.users u WHERE u.id = v_user FOR UPDATE;
  SELECT p.username INTO v_username FROM public.user_profiles p WHERE p.user_id = v_user;

  IF v_confirm = '' OR v_confirm IS DISTINCT FROM lower(btrim(coalesce(v_username, v_user_email))) THEN
    RAISE EXCEPTION 'Username does not match.' USING ERRCODE = '22023';
  END IF;
  IF v_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account from here.' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'That account is an admin. Remove the role first.' USING ERRCODE = '42501';
  END IF;

  -- Locked, so a webhook write cannot land between this check and the delete.
  SELECT * INTO v_existing FROM public.user_entitlements WHERE user_id = v_user FOR UPDATE;
  IF FOUND AND v_existing.source IS DISTINCT FROM 'tester' THEN
    RAISE EXCEPTION '% has Pro from %. Use the SQL editor if you mean it.', v_email, v_existing.source
      USING ERRCODE = '42501';
  END IF;

  -- Every address the account has used: its own and each identity's. Both
  -- spellings of each, as stored and lowercased, matching the Edge
  -- Function, since the log keeps whatever address a send went to.
  SELECT coalesce(array_agg(DISTINCT x.addr), '{}') INTO v_emails
  FROM (
    SELECT a.addr
    FROM (
      SELECT v_user_email AS raw
      UNION ALL
      SELECT i.identity_data->>'email' FROM auth.identities i WHERE i.user_id = v_user
    ) r
    CROSS JOIN LATERAL (VALUES (r.raw), (lower(r.raw))) a(addr)
    WHERE r.raw IS NOT NULL AND r.raw <> ''
  ) x;

  DELETE FROM public.email_send_log WHERE recipient_email = ANY (v_emails);
  DELETE FROM public.email_unsubscribe_tokens WHERE email = ANY (v_emails);

  SELECT count(*) INTO v_workouts FROM public.workouts w WHERE w.user_id = v_user;

  -- The account. Every per-user table cascades from here.
  DELETE FROM auth.users WHERE id = v_user;

  RETURN jsonb_build_object(
    'user_id', v_user,
    'email', v_user_email,
    'username', v_username,
    'workouts_deleted', v_workouts
  );
END
$function$;

-- Each function checks the admin role itself, so any signed-in user may
-- call it and a non-admin gets 'not authorized'. Never anon or PUBLIC.
REVOKE ALL ON FUNCTION public.admin_user_summary(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(text, text) TO authenticated;

COMMIT;
