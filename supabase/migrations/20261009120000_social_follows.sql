-- Social follows: two gaps in 20261004120000_social_schema.sql, found while
-- planning the social-follows branch. Run by Alan in SUPABASE (SQL editor)
-- on 9 Oct 2026; Section 0 then showed invite_landing present.
--
-- 1. invite_landing(p_code): the /i/<code> web page is visited signed out
--    and needs the inviter's username. It answers only the username, only
--    for an exact code, only when the inviter has social on. The one social
--    function anon may execute, a deliberate exception to the schema's rule
--    (the same shape as get_shared_template). 32^8 codes against at most
--    one per social user, so guessing a valid one is not practical.
-- 2. private.open_follow: a tap that meets a pending request the other
--    person started, in the same direction, approves it (the caller is its
--    approver), so tapping both invite buttons never leaves two requests
--    stuck. Callers pass auth.uid() as p_me through require_member; the
--    function stays revoked from every client role.

-- =====================================================================
-- Section 0. Diagnostics, read only.
-- =====================================================================
SELECT to_regprocedure('public.invite_landing(text)')::text AS invite_landing_exists,
       pg_get_functiondef('private.open_follow(uuid,uuid,uuid,text)'::regprocedure) AS open_follow_body;

-- =====================================================================
-- Section 1. Changes
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.invite_landing(p_code text)
RETURNS TABLE (username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.username
  FROM public.invite_codes c
  JOIN public.user_profiles p ON p.user_id = c.user_id
  WHERE c.code = upper(btrim(coalesce(p_code, '')))
    AND private.social_on(c.user_id);
$function$;

REVOKE ALL ON FUNCTION public.invite_landing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_landing(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.open_follow(
  p_me uuid, p_follower uuid, p_followee uuid, p_code text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_other uuid := CASE WHEN p_follower = p_me THEN p_followee ELSE p_follower END;
  v_row   public.follows%ROWTYPE;
BEGIN
  IF v_other = p_me THEN
    RAISE EXCEPTION 'That is your own account.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.social_on(v_other) THEN
    RAISE EXCEPTION 'That account cannot take follow requests yet.' USING ERRCODE = '42501';
  END IF;
  IF private.blocked_between(p_me, v_other) THEN
    RAISE EXCEPTION 'You cannot follow this account.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.follows (follower_id, followee_id, status, requested_by, invite_code)
  VALUES (p_follower, p_followee, 'pending', p_me, p_code)
  ON CONFLICT (follower_id, followee_id) DO NOTHING;

  SELECT * INTO v_row FROM public.follows f
  WHERE f.follower_id = p_follower AND f.followee_id = p_followee
  FOR UPDATE;

  IF v_row.status = 'pending' AND v_row.requested_by <> p_me THEN
    UPDATE public.follows
    SET status = 'accepted', accepted_at = now(), declined_at = NULL
    WHERE follower_id = p_follower AND followee_id = p_followee;
    RETURN 'accepted';
  END IF;
  RETURN v_row.status;
END
$function$;

COMMIT;
