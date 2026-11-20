-- Profile photos from Google sign-in (docs/profile-photos-spec.md).
-- Run in the Supabase SQL editor, one section at a time, in order.
-- Every section is safe to run twice.


-- ============================================================
-- Section 1. Photo columns on user_profiles
-- ============================================================
-- avatar_url        the sign-in photo, copied from auth.users by Section 3
-- avatar_status     pending until the moderation check, then ok or flagged
-- avatar_hidden     the user's own "Show my Google photo" switch, off = hidden
-- avatar_removed_at set by an admin from the Reports queue; the photo stays
--                   hidden even if a later sign-in copies it again

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_status text,
  ADD COLUMN IF NOT EXISTS avatar_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_removed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_avatar_status_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_avatar_status_check
      CHECK (avatar_status IS NULL OR avatar_status IN ('pending', 'ok', 'flagged'));
  END IF;
END
$$;


-- ============================================================
-- Section 2. Clients can't set the photo or its status
-- ============================================================
-- The owner-update policy lets a user write their own row, which would let
-- them set avatar_status to ok and skip the check. Writes from the app
-- (role authenticated or anon) keep the old photo fields; avatar_hidden
-- stays writable. Server functions run as their owner and are not affected.
-- SECURITY INVOKER on purpose, so current_user is the caller's role.

CREATE OR REPLACE FUNCTION private.guard_avatar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.avatar_url := NULL;
      NEW.avatar_status := NULL;
      NEW.avatar_removed_at := NULL;
    ELSE
      NEW.avatar_url := OLD.avatar_url;
      NEW.avatar_status := OLD.avatar_status;
      NEW.avatar_removed_at := OLD.avatar_removed_at;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS user_profiles_guard_avatar ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_avatar
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_avatar();


-- ============================================================
-- Section 3. Copy the sign-in photo, then queue the check
-- ============================================================
-- Google puts the photo in raw_user_meta_data as avatar_url and picture.
-- Apple never sends one. An email account with Google linked carries it too.
-- Only https addresses are taken. A changed photo goes back to pending and
-- is checked again (the OpenAI moderation endpoint is free).
-- Never raises: a failure here must not block a sign-in.

CREATE OR REPLACE FUNCTION private.avatar_from_meta(p_meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE WHEN v LIKE 'https://%' THEN v END
  FROM (
    SELECT coalesce(
      nullif(btrim(p_meta ->> 'avatar_url'), ''),
      nullif(btrim(p_meta ->> 'picture'), '')
    ) AS v
  ) s;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_avatar(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_url text;
BEGIN
  SELECT private.avatar_from_meta(u.raw_user_meta_data) INTO v_url
  FROM auth.users u WHERE u.id = p_user;

  UPDATE public.user_profiles p
  SET avatar_url = v_url,
      avatar_status = CASE WHEN v_url IS NULL THEN NULL ELSE 'pending' END
  WHERE p.user_id = p_user
    AND p.avatar_url IS DISTINCT FROM v_url;

  IF FOUND AND v_url IS NOT NULL THEN
    PERFORM private.post_moderation('avatars', p_user);
  END IF;
EXCEPTION WHEN others THEN
  RETURN;
END
$function$;

CREATE OR REPLACE FUNCTION private.on_auth_user_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.refresh_avatar(NEW.id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION private.on_profile_avatar_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.refresh_avatar(NEW.user_id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS on_auth_user_avatar ON auth.users;
CREATE TRIGGER on_auth_user_avatar
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.on_auth_user_avatar();

DROP TRIGGER IF EXISTS user_profiles_avatar_insert ON public.user_profiles;
CREATE TRIGGER user_profiles_avatar_insert
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION private.on_profile_avatar_insert();


-- ============================================================
-- Section 4. The lookup the app calls
-- ============================================================
-- Photos the caller may see, for up to 200 user ids: their own, and anyone
-- they follow, who follows them, or with a pending (not declined) request
-- either way, unless either has blocked the other. Only checked photos
-- (ok), not hidden by the owner, not removed by an admin, for accounts
-- with social on. The caller needs social on too.

CREATE OR REPLACE FUNCTION public.social_avatars(p_ids uuid[])
RETURNS TABLE(user_id uuid, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.user_id, p.avatar_url
  FROM public.user_profiles p
  WHERE auth.uid() IS NOT NULL
    AND private.social_on(auth.uid())
    AND p.user_id = ANY (p_ids[1:200])
    AND p.avatar_url IS NOT NULL
    AND p.avatar_status = 'ok'
    AND NOT p.avatar_hidden
    AND p.avatar_removed_at IS NULL
    AND private.social_on(p.user_id)
    AND (
      p.user_id = auth.uid()
      OR (
        EXISTS (
          SELECT 1 FROM public.follows f
          WHERE ((f.follower_id = auth.uid() AND f.followee_id = p.user_id)
              OR (f.followee_id = auth.uid() AND f.follower_id = p.user_id))
            AND (f.status = 'accepted' OR f.declined_at IS NULL)
        )
        AND NOT private.blocked_between(auth.uid(), p.user_id)
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.social_avatars(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_avatars(uuid[]) TO authenticated;


-- ============================================================
-- Section 5. One open auto-flag report per photo
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open_autoflag_avatar
  ON public.reports (target_user_id, (detail ->> 'avatar_url'))
  WHERE reason = 'auto_flag' AND status = 'open' AND (detail ->> 'field') = 'avatar';


-- ============================================================
-- Section 6. Admin: see a reported user's photo, and remove it
-- ============================================================
-- admin_resolve_report gains remove_avatar (remove_photo is kept for
-- Phase 3 workout photos), and dismissing a photo
-- auto-flag marks that photo ok. Everything else is unchanged.

CREATE OR REPLACE FUNCTION public.admin_user_avatar(p_user uuid)
RETURNS TABLE(avatar_url text, avatar_status text, avatar_hidden boolean, avatar_removed_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.avatar_url, p.avatar_status, p.avatar_hidden, p.avatar_removed_at
  FROM public.user_profiles p WHERE p.user_id = p_user;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_user_avatar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_avatar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_id uuid, p_action text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_report public.reports%ROWTYPE;
  v_name   text;
  v_try    integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'remove_follow', 'disable_social', 'hide_workout', 'reset_username', 'remove_avatar') THEN
    RAISE EXCEPTION 'Action must be dismiss, remove_follow, disable_social, hide_workout, reset_username or remove_avatar.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_report FROM public.reports WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such report.' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'remove_follow' AND v_report.reporter_id IS NOT NULL AND v_report.target_user_id IS NOT NULL THEN
    DELETE FROM public.follows
    WHERE (follower_id = v_report.reporter_id AND followee_id = v_report.target_user_id)
       OR (follower_id = v_report.target_user_id AND followee_id = v_report.reporter_id);
  ELSIF p_action = 'disable_social' AND v_report.target_user_id IS NOT NULL THEN
    INSERT INTO public.user_flags AS f (user_id, flag, state, granted_at, granted_by)
    VALUES (v_report.target_user_id, 'social', 'revoked', now(), auth.uid())
    ON CONFLICT (user_id, flag) DO UPDATE
      SET state = 'revoked', granted_at = now(), granted_by = auth.uid();
  ELSIF p_action = 'hide_workout' THEN
    IF v_report.target_workout_id IS NULL THEN
      RAISE EXCEPTION 'This report has no workout to hide.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.workouts SET hidden_at = coalesce(hidden_at, now())
    WHERE id = v_report.target_workout_id;
  ELSIF p_action = 'reset_username' THEN
    IF v_report.target_user_id IS NULL THEN
      RAISE EXCEPTION 'This report has no account.' USING ERRCODE = '22023';
    END IF;
    LOOP
      v_try := v_try + 1;
      v_name := 'lifter' || (10000 + floor(random() * 90000))::integer::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.user_profiles p WHERE lower(p.username) = v_name
      );
      IF v_try >= 20 THEN
        RAISE EXCEPTION 'Could not find a free lifter username.' USING ERRCODE = '23505';
      END IF;
    END LOOP;
    UPDATE public.user_profiles SET username = v_name WHERE user_id = v_report.target_user_id;
  ELSIF p_action = 'remove_avatar' THEN
    IF v_report.target_user_id IS NULL THEN
      RAISE EXCEPTION 'This report has no account.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.user_profiles SET avatar_removed_at = coalesce(avatar_removed_at, now())
    WHERE user_id = v_report.target_user_id;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag' AND v_report.target_workout_id IS NOT NULL THEN
    UPDATE public.workouts SET moderation_flagged_at = NULL
    WHERE id = v_report.target_workout_id;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag'
        AND (v_report.detail ->> 'field') = 'avatar' AND v_report.target_user_id IS NOT NULL THEN
    -- A false flag: show the photo it was raised for, if it is still current.
    UPDATE public.user_profiles SET avatar_status = 'ok'
    WHERE user_id = v_report.target_user_id
      AND avatar_url = (v_report.detail ->> 'avatar_url')
      AND avatar_status = 'flagged';
  END IF;

  UPDATE public.reports
  SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = p_id;
  RETURN CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END;
END
$function$;


-- ============================================================
-- Section 7. Backfill (run after the moderate-text update is deployed)
-- ============================================================
-- Copies every existing sign-in photo and queues its check. About 6 accounts.
-- Running it before the edge function knows 'avatars' leaves them pending;
-- run it again afterwards, or use the re-check below.

SELECT private.refresh_avatar(p.user_id) FROM public.user_profiles p;

-- Check: expect one row per Google-photo account, status ok after a few seconds.
SELECT u.email, p.username, p.avatar_status, left(p.avatar_url, 60) AS avatar
FROM public.user_profiles p JOIN auth.users u ON u.id = p.user_id
WHERE p.avatar_url IS NOT NULL;

-- Re-check anything still pending (safe to repeat):
-- SELECT private.post_moderation('avatars', user_id) FROM public.user_profiles WHERE avatar_status = 'pending';
