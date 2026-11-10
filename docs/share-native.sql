-- Adds the tiktok_share flag: the TikTok button under share cards on iOS.
-- Global switch OFF. Dev builds show the button whatever this says.
--
-- SUPABASE (SQL editor). Run Section 0, read it, then run the rest.
-- Function bodies are the live ones from pg_get_functiondef on 6 Nov 2026 with
-- 'tiktok_share' added to the list. The live lists also carry 'pro_launched',
-- which docs/custom-exercises.sql predates. admin_list_flags has no flag list,
-- so it stays as it is.

-- Section 0. Expect the three allowed flags in each CHECK, three app_flags rows
-- (social, custom_exercises, pro_launched) and no tiktok_share.
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN ('app_flags_flag_check', 'user_flags_flag_check');

SELECT flag, enabled_for_all FROM public.app_flags ORDER BY flag;

-- Section 1. Allow the flag.
BEGIN;

ALTER TABLE public.user_flags DROP CONSTRAINT IF EXISTS user_flags_flag_check;
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched', 'tiktok_share'));
ALTER TABLE public.app_flags DROP CONSTRAINT IF EXISTS app_flags_flag_check;
ALTER TABLE public.app_flags ADD CONSTRAINT app_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises', 'pro_launched', 'tiktok_share'));

-- Section 2. Seed the switch off.
INSERT INTO public.app_flags (flag, enabled_for_all) VALUES ('tiktok_share', false)
ON CONFLICT (flag) DO NOTHING;

-- Section 3. The two admin functions, with the list widened.
CREATE OR REPLACE FUNCTION public.admin_set_flag(p_email text, p_flag text, p_state text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_user    uuid;
  v_matches integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_flag IS NULL OR p_flag NOT IN ('social', 'custom_exercises', 'pro_launched', 'tiktok_share') THEN
    RAISE EXCEPTION 'Unknown flag %.', p_flag USING ERRCODE = '22023';
  END IF;
  IF p_state IS NOT NULL AND p_state NOT IN ('granted', 'revoked') THEN
    RAISE EXCEPTION 'State must be granted, revoked or null.' USING ERRCODE = '22023';
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
    RAISE EXCEPTION '% accounts use %; set the flag by user id in the SQL editor instead.', v_matches, v_email
      USING ERRCODE = '21000';
  END IF;

  IF p_state IS NULL THEN
    DELETE FROM public.user_flags WHERE user_id = v_user AND flag = p_flag;
    RETURN NULL;
  END IF;

  INSERT INTO public.user_flags AS f (user_id, flag, state, granted_at, granted_by)
  VALUES (v_user, p_flag, p_state, now(), auth.uid())
  ON CONFLICT (user_id, flag) DO UPDATE
    SET state = excluded.state, granted_at = now(), granted_by = auth.uid();
  RETURN p_state;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_global_flag(p_flag text, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_flag IS NULL OR p_flag NOT IN ('social', 'custom_exercises', 'pro_launched', 'tiktok_share') OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'Name the flag and say on or off.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.app_flags AS a (flag, enabled_for_all, updated_at, updated_by)
  VALUES (p_flag, p_enabled, now(), auth.uid())
  ON CONFLICT (flag) DO UPDATE
    SET enabled_for_all = excluded.enabled_for_all, updated_at = now(), updated_by = auth.uid();
  RETURN p_enabled;
END
$function$;

COMMIT;

-- Section 4. Check. Expect one row with enabled_for_all false.
SELECT flag, enabled_for_all FROM public.app_flags WHERE flag = 'tiktok_share';
