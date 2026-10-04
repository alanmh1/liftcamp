-- Social v0: the flag, follows, blocks, kudos, reports, invite codes, and
-- workouts.pr_count. The spec is docs/social-spec.md.
--
-- Run in SUPABASE (SQL editor). Idempotent; safe to run twice. Read Section
-- 0's output before running Section 1. Nothing here has been run.
--
-- The shape:
--   - No client writes any new table. Every write is a SECURITY DEFINER
--     function that checks the caller is signed up (not anonymous), has
--     social on where the action needs it, and is not blocked.
--   - Every read of another person's data is a SECURITY DEFINER function
--     gated on an accepted follow with no block either way. The workouts,
--     sets and user_profiles RLS stays owner-only.
--   - Helpers live in schema `private`, which PostgREST does not expose.
--   - Every function sets search_path to '' and names everything in full.
--     EXECUTE is revoked from PUBLIC and anon on every function, because
--     the default privileges in public grant it to anon.
--   - Grants are explicit. No GRANT ALL.
--
-- Account deletion. Every user column has a foreign key to auth.users with
-- ON DELETE CASCADE, so the delete-account function needs no change. The
-- exception is reports: reporter_id and target_user_id are ON DELETE SET
-- NULL, so a report stays in the queue when either side deletes their
-- account. kudos.workout_id cascades from workouts; a report's
-- target_workout_id is set null.
--
-- Guest merge. merge_guest_account is not changed. Its leftover check reads
-- the foreign keys to auth.users live and refuses a guest with a row in any
-- of them, which is the zero-rows rule each new table needs. Guests can
-- never hold a row: every write function refuses anonymous callers.
--
-- Not here, on purpose:
--   - The report email trigger. It calls an Edge Function through pg_net,
--     and that function is built in social-safety, with the trigger.
--   - user_profiles.username rules. The username-fix branch merges first.

-- =====================================================================
-- Section 0. Diagnostics, read only. Run on its own and read the output.
-- =====================================================================
-- Expect, as of 4 Oct 2026: every new table null, pr_count absent,
-- pgcrypto in extensions, pg_cron 1.6.4, has_role present, one cron job
-- (purge-empty-guests), and no new function.
--
-- SELECT
--   (SELECT json_agg(coalesce(to_regclass('public.' || t)::text, t || ' (absent)'))
--      FROM unnest(ARRAY['user_flags','app_flags','invite_codes','follows','blocks','kudos','reports']) t) AS tables,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'workouts' AND column_name = 'pr_count') AS pr_count_cols,
--   (SELECT json_agg(extname || '@' || n.nspname || ' ' || extversion) FROM pg_extension e
--      JOIN pg_namespace n ON n.oid = e.extnamespace WHERE extname IN ('pgcrypto','pg_cron')) AS exts,
--   to_regprocedure('public.has_role(uuid, public.app_role)')::text AS has_role,
--   (SELECT json_agg(jobname) FROM cron.job) AS cron_jobs,
--   (SELECT json_agg(p.proname ORDER BY p.proname) FROM pg_proc p
--      WHERE p.pronamespace IN ('public'::regnamespace, 'private'::regnamespace)
--        AND p.proname IN ('social_access','social_on','is_member','blocked_between','workout_visible',
--          'new_invite_code','my_invite_code','regenerate_invite_code','invite_preview',
--          'request_follow','request_follow_user','respond_follow','end_follow','list_follows',
--          'block_user','unblock_user','list_blocks','toggle_kudos','workout_kudos',
--          'social_feed','social_workout','social_profile','social_streak','file_report',
--          'admin_list_flags','admin_set_flag','admin_set_global_flag','admin_list_reports',
--          'admin_resolve_report','expire_follow_requests')) AS existing_fns;

-- =====================================================================
-- Section 1. Changes
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1a. Tables
-- ---------------------------------------------------------------------

-- Per-user flag state. 'granted' turns the flag on for this user while the
-- global switch is off; 'revoked' turns it off whatever the switch says.
CREATE TABLE IF NOT EXISTS public.user_flags (
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  flag       text NOT NULL,
  state      text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, flag)
);
ALTER TABLE public.user_flags ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.user_flags ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_flags ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- The global switch, one row per flag.
CREATE TABLE IF NOT EXISTS public.app_flags (
  flag            text PRIMARY KEY,
  enabled_for_all boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- One active invite code per user. Regenerating replaces the row.
CREATE TABLE IF NOT EXISTS public.invite_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  code       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per direction. requested_by is whoever started it; the other
-- person approves. declined_at hides a declined request from the person who
-- declined while the sender still sees it pending, until it expires.
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invite_code  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  declined_at  timestamptz,
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.kudos (
  workout_id uuid NOT NULL REFERENCES public.workouts (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workout_id, user_id)
);

-- SET NULL on both people, so a report outlives either account.
CREATE TABLE IF NOT EXISTS public.reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  target_user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  target_workout_id uuid REFERENCES public.workouts (id) ON DELETE SET NULL,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'open',
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  resolved_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- PRs set in the workout, written by the owner's phone at finish from the
-- summary's PR logic. Null for every workout before that, and the feed
-- hides the stat when null. The owner writes it through the existing
-- workouts UPDATE policy.
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS pr_count integer;

-- ---------------------------------------------------------------------
-- 1b. Constraints, added only when missing so a second run is a no-op
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('public.user_flags',   'user_flags_flag_check',      'CHECK (flag IN (''social''))'),
      ('public.user_flags',   'user_flags_state_check',     'CHECK (state IN (''granted'', ''revoked''))'),
      ('public.app_flags',    'app_flags_flag_check',       'CHECK (flag IN (''social''))'),
      ('public.invite_codes', 'invite_codes_code_key',      'UNIQUE (code)'),
      ('public.invite_codes', 'invite_codes_code_check',    'CHECK (code ~ ''^[A-HJ-NP-Z2-9]{8}$'')'),
      ('public.follows',      'follows_status_check',       'CHECK (status IN (''pending'', ''accepted''))'),
      ('public.follows',      'follows_not_self',           'CHECK (follower_id <> followee_id)'),
      ('public.follows',      'follows_requested_by_party', 'CHECK (requested_by IN (follower_id, followee_id))'),
      ('public.follows',      'follows_accepted_has_time',  'CHECK ((status = ''accepted'') = (accepted_at IS NOT NULL))'),
      ('public.follows',      'follows_declined_pending',   'CHECK (declined_at IS NULL OR status = ''pending'')'),
      ('public.blocks',       'blocks_not_self',            'CHECK (blocker_id <> blocked_id)'),
      ('public.reports',      'reports_reason_check',       'CHECK (reason IN (''inappropriate'', ''harassment'', ''spam'', ''other''))'),
      ('public.reports',      'reports_status_check',       'CHECK (status IN (''open'', ''dismissed'', ''actioned''))'),
      ('public.workouts',     'workouts_pr_count_check',    'CHECK (pr_count IS NULL OR pr_count >= 0)')
    ) AS v(tbl, name, def)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = c.name AND conrelid = c.tbl::regclass
    ) THEN
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', c.tbl, c.name, c.def);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 1c. Indexes. The primary keys cover lookups by their first column; these
-- cover the second, which the cascades and the reads need.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS follows_followee_idx    ON public.follows (followee_id, status);
CREATE INDEX IF NOT EXISTS follows_requested_by_idx ON public.follows (requested_by);
CREATE INDEX IF NOT EXISTS follows_pending_age_idx ON public.follows (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS blocks_blocked_idx      ON public.blocks (blocked_id);
CREATE INDEX IF NOT EXISTS kudos_user_idx          ON public.kudos (user_id);
CREATE INDEX IF NOT EXISTS user_flags_granted_by_idx ON public.user_flags (granted_by);
CREATE INDEX IF NOT EXISTS reports_open_idx        ON public.reports (created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS reports_reporter_idx    ON public.reports (reporter_id, created_at);
CREATE INDEX IF NOT EXISTS reports_target_user_idx ON public.reports (target_user_id);
CREATE INDEX IF NOT EXISTS reports_target_workout_idx ON public.reports (target_workout_id);
-- The feed reads finished workouts of followed users by finished_at.
CREATE INDEX IF NOT EXISTS workouts_user_finished_idx
  ON public.workouts (user_id, finished_at DESC) WHERE finished_at IS NOT NULL;

-- The switch starts off. A second run leaves its value alone.
INSERT INTO public.app_flags (flag, enabled_for_all) VALUES ('social', false)
ON CONFLICT (flag) DO NOTHING;

-- ---------------------------------------------------------------------
-- 1d. RLS and grants
-- ---------------------------------------------------------------------
ALTER TABLE public.user_flags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports      ENABLE ROW LEVEL SECURITY;

-- Nothing for anon on any new table, and no client writes at all.
REVOKE ALL ON public.user_flags, public.app_flags, public.invite_codes, public.follows,
  public.blocks, public.kudos, public.reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_flags, public.app_flags, public.invite_codes,
  public.follows, public.blocks, public.kudos, public.reports TO service_role;

-- A signed-up user reads their own flag rows, as tester Pro reads its row.
-- The app asks social_access() instead, which applies the switch and the
-- revoke; this is for debugging from the client.
GRANT SELECT ON public.user_flags TO authenticated;
DROP POLICY IF EXISTS "Members read their own flags" ON public.user_flags;
CREATE POLICY "Members read their own flags"
  ON public.user_flags
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND coalesce(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

-- The switch is not secret; /admin shows it.
GRANT SELECT ON public.app_flags TO authenticated;
DROP POLICY IF EXISTS "Members read the global flags" ON public.app_flags;
CREATE POLICY "Members read the global flags"
  ON public.app_flags
  FOR SELECT
  TO authenticated
  USING (coalesce(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

-- invite_codes, follows, blocks, kudos and reports have RLS on and no
-- policy and no grant: no client reads or writes them except through the
-- functions below.

-- ---------------------------------------------------------------------
-- 1e. Private helpers. Not exposed through PostgREST.
-- ---------------------------------------------------------------------

-- Signed up: an auth user who is not anonymous.
CREATE OR REPLACE FUNCTION private.is_member(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user AND u.is_anonymous IS NOT TRUE
  );
$function$;

-- Social on: a member, not revoked, and the switch on or a grant held.
CREATE OR REPLACE FUNCTION private.social_on(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.is_member(p_user)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_flags f
      WHERE f.user_id = p_user AND f.flag = 'social' AND f.state = 'revoked'
    )
    AND (
      EXISTS (SELECT 1 FROM public.app_flags a WHERE a.flag = 'social' AND a.enabled_for_all)
      OR EXISTS (
        SELECT 1 FROM public.user_flags f
        WHERE f.user_id = p_user AND f.flag = 'social' AND f.state = 'granted'
      )
    );
$function$;

-- A block in either direction.
CREATE OR REPLACE FUNCTION private.blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = p_a AND b.blocked_id = p_b)
       OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$function$;

-- Whether `p_viewer` may see `p_owner`'s social data: two different
-- users, both with social on, an accepted follow viewer to owner, and no
-- block either way.
CREATE OR REPLACE FUNCTION private.can_view(p_viewer uuid, p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_viewer IS NOT NULL
    AND p_owner IS NOT NULL
    AND p_viewer <> p_owner
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = p_viewer AND f.followee_id = p_owner AND f.status = 'accepted'
    )
    AND NOT private.blocked_between(p_viewer, p_owner)
    AND private.social_on(p_viewer)
    AND private.social_on(p_owner);
$function$;

-- A workout another person may see: finished, at least one completed set,
-- and its owner viewable by `p_viewer`. No age limit; the feed adds its own.
CREATE OR REPLACE FUNCTION private.workout_visible(p_viewer uuid, p_workout uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = p_workout
      AND w.finished_at IS NOT NULL
      AND private.can_view(p_viewer, w.user_id)
      AND EXISTS (
        SELECT 1 FROM public.sets s
        JOIN public.workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = w.id AND s.completed
      )
  );
$function$;

-- Eight characters from an alphabet without 0, O, 1 and I, so a code
-- read off the /i page cannot be mistyped that way. 32 characters, so a
-- byte mod 32 is uniform; 32^8 codes.
CREATE OR REPLACE FUNCTION private.new_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code  text;
BEGIN
  LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    FOR i IN 0..7 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invite_codes c WHERE c.code = v_code);
  END LOOP;
  RETURN v_code;
END
$function$;

-- Refuses an anonymous or signed-out caller, and, when `p_social`, a caller
-- without social on. Returns the caller's id.
CREATE OR REPLACE FUNCTION private.require_member(p_social boolean)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR NOT private.is_member(v_me) THEN
    RAISE EXCEPTION 'Sign up to use this.' USING ERRCODE = '42501';
  END IF;
  IF p_social AND NOT private.social_on(v_me) THEN
    RAISE EXCEPTION 'Social is not on for this account.' USING ERRCODE = '42501';
  END IF;
  RETURN v_me;
END
$function$;

-- Pending requests older than 30 days. Nightly, from pg_cron.
CREATE OR REPLACE FUNCTION private.expire_follow_requests()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.follows WHERE status = 'pending' AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$function$;

-- ---------------------------------------------------------------------
-- 1f. The flag
-- ---------------------------------------------------------------------

-- Whether social is on for the caller. The app caches the answer per user
-- (liftcamp:social:<userId>) so the tabs know it before they draw.
CREATE OR REPLACE FUNCTION public.social_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce(private.social_on(auth.uid()), false);
$function$;

-- Every user with a flag row, newest first, and the switch. Admins only.
CREATE OR REPLACE FUNCTION public.admin_list_flags(p_flag text DEFAULT 'social')
RETURNS TABLE (
  email           text,
  user_id         uuid,
  state           text,
  granted_at      timestamptz,
  granted_by      text,
  enabled_for_all boolean
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
  SELECT u.email::text, f.user_id, f.state, f.granted_at, g.email::text,
         (SELECT a.enabled_for_all FROM public.app_flags a WHERE a.flag = p_flag)
  FROM public.user_flags f
  JOIN auth.users u ON u.id = f.user_id
  LEFT JOIN auth.users g ON g.id = f.granted_by
  WHERE f.flag = p_flag
  ORDER BY f.granted_at DESC;
END
$function$;

-- Grants ('granted'), revokes ('revoked') or clears (null) a user's flag
-- state, by email. Admins only, signed-up accounts only. Returns the state
-- after the change.
CREATE OR REPLACE FUNCTION public.admin_set_flag(p_email text, p_flag text, p_state text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_user    uuid;
  v_matches integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_flag IS DISTINCT FROM 'social' THEN
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

-- The launch switch. Admins only.
CREATE OR REPLACE FUNCTION public.admin_set_global_flag(p_flag text, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_flag IS DISTINCT FROM 'social' OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'Name the flag and say on or off.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.app_flags AS a (flag, enabled_for_all, updated_at, updated_by)
  VALUES (p_flag, p_enabled, now(), auth.uid())
  ON CONFLICT (flag) DO UPDATE
    SET enabled_for_all = excluded.enabled_for_all, updated_at = now(), updated_by = auth.uid();
  RETURN p_enabled;
END
$function$;

-- ---------------------------------------------------------------------
-- 1g. Invite codes
-- ---------------------------------------------------------------------

-- The caller's code, created on first use.
CREATE OR REPLACE FUNCTION public.my_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me   uuid := private.require_member(true);
  v_code text;
BEGIN
  SELECT c.code INTO v_code FROM public.invite_codes c WHERE c.user_id = v_me;
  IF FOUND THEN
    RETURN v_code;
  END IF;
  INSERT INTO public.invite_codes (user_id, code) VALUES (v_me, private.new_invite_code())
  ON CONFLICT (user_id) DO NOTHING;
  SELECT c.code INTO v_code FROM public.invite_codes c WHERE c.user_id = v_me;
  RETURN v_code;
END
$function$;

-- A new code for the caller. The old link stops working.
CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me   uuid := private.require_member(true);
  v_code text := private.new_invite_code();
BEGIN
  INSERT INTO public.invite_codes (user_id, code, created_at) VALUES (v_me, v_code, now())
  ON CONFLICT (user_id) DO UPDATE SET code = excluded.code, created_at = now();
  RETURN v_code;
END
$function$;

-- Who an invite code belongs to, for the in-app invite screen, with where
-- the caller already stands with them. No row for an unknown code, the
-- caller's own code, an inviter without social on, or a block either way.
-- The caller needs social on: the app shows "Friends are coming soon"
-- before it gets here.
CREATE OR REPLACE FUNCTION public.invite_preview(p_code text)
RETURNS TABLE (
  user_id    uuid,
  username   text,
  i_follow   text,
  follows_me text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  SELECT c.user_id,
         p.username,
         (SELECT f.status FROM public.follows f WHERE f.follower_id = v_me AND f.followee_id = c.user_id),
         (SELECT f.status FROM public.follows f WHERE f.follower_id = c.user_id AND f.followee_id = v_me)
  FROM public.invite_codes c
  LEFT JOIN public.user_profiles p ON p.user_id = c.user_id
  WHERE c.code = upper(btrim(coalesce(p_code, '')))
    AND c.user_id <> v_me
    AND private.social_on(c.user_id)
    AND NOT private.blocked_between(v_me, c.user_id);
END
$function$;

-- ---------------------------------------------------------------------
-- 1h. Follows
-- ---------------------------------------------------------------------

-- Opens a request, or leaves the existing row as it is (an accepted
-- follow stays accepted; a declined request stays pending to its sender).
-- Returns the row's status. Both sides need social on and no block.
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
  v_other  uuid := CASE WHEN p_follower = p_me THEN p_followee ELSE p_follower END;
  v_status text;
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

  SELECT f.status INTO v_status FROM public.follows f
  WHERE f.follower_id = p_follower AND f.followee_id = p_followee;
  RETURN v_status;
END
$function$;

-- From an invite code. 'follow': the caller asks to follow the inviter,
-- who approves. 'let_follow': the caller offers to let the inviter follow
-- them; the inviter approves, since the caller started it.
CREATE OR REPLACE FUNCTION public.request_follow(p_code text, p_direction text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me      uuid := private.require_member(true);
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_inviter uuid;
BEGIN
  IF p_direction NOT IN ('follow', 'let_follow') THEN
    RAISE EXCEPTION 'Direction must be follow or let_follow.' USING ERRCODE = '22023';
  END IF;
  SELECT c.user_id INTO v_inviter FROM public.invite_codes c WHERE c.code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invite code does not work.' USING ERRCODE = 'P0002';
  END IF;
  IF p_direction = 'follow' THEN
    RETURN private.open_follow(v_me, v_me, v_inviter, v_code);
  END IF;
  RETURN private.open_follow(v_me, v_inviter, v_me, v_code);
END
$function$;

-- Follow back, or Follow on a profile sheet: by user id, but only toward
-- someone the caller is already connected to by a follow row in either
-- direction. There is no search in v0, so a stranger's id is refused.
CREATE OR REPLACE FUNCTION public.request_follow_user(p_user uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.follows f
    WHERE (f.follower_id = v_me AND f.followee_id = p_user)
       OR (f.follower_id = p_user AND f.followee_id = v_me)
  ) THEN
    RAISE EXCEPTION 'Use their invite link to follow them.' USING ERRCODE = '42501';
  END IF;
  RETURN private.open_follow(v_me, v_me, p_user, NULL);
END
$function$;

-- Approve or decline a pending request the caller is the approver of (the
-- party who did not start it). Decline is silent: the row stays pending for
-- the sender and expires after 30 days. Returns the status after.
CREATE OR REPLACE FUNCTION public.respond_follow(p_follower uuid, p_followee uuid, p_accept boolean)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me  uuid := private.require_member(true);
  v_row public.follows%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.follows f
  WHERE f.follower_id = p_follower AND f.followee_id = p_followee
  FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'pending' OR v_row.declined_at IS NOT NULL
     OR v_me NOT IN (v_row.follower_id, v_row.followee_id) OR v_row.requested_by = v_me THEN
    RAISE EXCEPTION 'No request to answer.' USING ERRCODE = 'P0002';
  END IF;
  IF p_accept IS NULL THEN
    RAISE EXCEPTION 'Say whether to approve or decline.' USING ERRCODE = '22023';
  END IF;

  IF p_accept THEN
    IF private.blocked_between(p_follower, p_followee)
       OR NOT private.social_on(p_follower) OR NOT private.social_on(p_followee) THEN
      RAISE EXCEPTION 'This request can no longer be approved.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.follows SET status = 'accepted', accepted_at = now()
    WHERE follower_id = p_follower AND followee_id = p_followee;
    RETURN 'accepted';
  END IF;

  UPDATE public.follows SET declined_at = now()
  WHERE follower_id = p_follower AND followee_id = p_followee;
  RETURN 'pending';
END
$function$;

-- Withdraw a request, unfollow, or remove a follower: either party deletes
-- the row, whatever its state. Silent, and it does not stop a new request.
CREATE OR REPLACE FUNCTION public.end_follow(p_follower uuid, p_followee uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  IF v_me NOT IN (p_follower, p_followee) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.follows WHERE follower_id = p_follower AND followee_id = p_followee;
END
$function$;

-- Every follow row the caller is a party to, with the other person's
-- username: followers, following and requests in one read. A request the
-- caller declined is left out; the sender still sees it. The app splits
-- the rows with the rules in packages/shared social.ts.
CREATE OR REPLACE FUNCTION public.list_follows()
RETURNS TABLE (
  follower_id    uuid,
  followee_id    uuid,
  other_id       uuid,
  other_username text,
  status         text,
  requested_by   uuid,
  created_at     timestamptz,
  accepted_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  SELECT f.follower_id, f.followee_id, o.other, p.username, f.status, f.requested_by,
         f.created_at, f.accepted_at
  FROM public.follows f
  CROSS JOIN LATERAL (
    SELECT CASE WHEN f.follower_id = v_me THEN f.followee_id ELSE f.follower_id END AS other
  ) o
  LEFT JOIN public.user_profiles p ON p.user_id = o.other
  WHERE v_me IN (f.follower_id, f.followee_id)
    AND NOT (f.declined_at IS NOT NULL AND f.requested_by <> v_me)
    AND NOT private.blocked_between(v_me, o.other)
  ORDER BY f.created_at DESC;
END
$function$;

-- ---------------------------------------------------------------------
-- 1i. Blocks. Open to any signed-up user, social on or not, so a revoked
-- account can still block.
-- ---------------------------------------------------------------------

-- Blocks `p_user`: removes follows both ways (pending requests included)
-- and stops new ones.
CREATE OR REPLACE FUNCTION public.block_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  IF p_user IS NULL OR p_user = v_me THEN
    RAISE EXCEPTION 'Pick someone else to block.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (v_me, p_user)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  DELETE FROM public.follows
  WHERE (follower_id = v_me AND followee_id = p_user)
     OR (follower_id = p_user AND followee_id = v_me);
END
$function$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  DELETE FROM public.blocks WHERE blocker_id = v_me AND blocked_id = p_user;
END
$function$;

-- The people the caller has blocked, for Settings, Blocked.
CREATE OR REPLACE FUNCTION public.list_blocks()
RETURNS TABLE (user_id uuid, username text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  RETURN QUERY
  SELECT b.blocked_id, p.username, b.created_at
  FROM public.blocks b
  LEFT JOIN public.user_profiles p ON p.user_id = b.blocked_id
  WHERE b.blocker_id = v_me
  ORDER BY b.created_at DESC;
END
$function$;

-- ---------------------------------------------------------------------
-- 1j. Kudos
-- ---------------------------------------------------------------------

-- Gives kudos, or takes it back if already given. Only on a workout the
-- caller can see, never their own. Returns the state after.
CREATE OR REPLACE FUNCTION public.toggle_kudos(p_workout uuid)
RETURNS TABLE (given boolean, kudos_count integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me    uuid := private.require_member(true);
  v_given boolean;
BEGIN
  IF NOT private.workout_visible(v_me, p_workout) THEN
    RAISE EXCEPTION 'You cannot give kudos on this workout.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.kudos WHERE workout_id = p_workout AND user_id = v_me;
  IF FOUND THEN
    v_given := false;
  ELSE
    INSERT INTO public.kudos (workout_id, user_id) VALUES (p_workout, v_me)
    ON CONFLICT (workout_id, user_id) DO NOTHING;
    v_given := true;
  END IF;
  RETURN QUERY
  SELECT v_given, (SELECT count(*)::integer FROM public.kudos k WHERE k.workout_id = p_workout);
END
$function$;

-- Who gave kudos on one of the caller's own workouts, newest first. A
-- giver blocked either way is left out. Open to any signed-up owner, so
-- the count on the last workout card keeps working if social is revoked.
CREATE OR REPLACE FUNCTION public.workout_kudos(p_workout uuid)
RETURNS TABLE (user_id uuid, username text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = p_workout AND w.user_id = v_me) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT k.user_id, p.username, k.created_at
  FROM public.kudos k
  LEFT JOIN public.user_profiles p ON p.user_id = k.user_id
  WHERE k.workout_id = p_workout
    AND NOT private.blocked_between(v_me, k.user_id)
  ORDER BY k.created_at DESC;
END
$function$;

-- ---------------------------------------------------------------------
-- 1k. Reads of other people
-- ---------------------------------------------------------------------

-- The following feed: finished workouts from the last 14 days of people
-- the caller follows, newest first, with at least one completed set.
-- `p_before` is the previous page's last finished_at. pr_count is null for
-- workouts finished before the phone wrote it; the app hides it then.
CREATE OR REPLACE FUNCTION public.social_feed(p_before timestamptz DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE (
  workout_id     uuid,
  user_id        uuid,
  username       text,
  name           text,
  workout_date   date,
  created_at     timestamptz,
  finished_at    timestamptz,
  completed_sets integer,
  pr_count       integer,
  kudos_count    integer,
  kudos_given    boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  SELECT w.id, w.user_id, p.username, w.name, w.workout_date, w.created_at, w.finished_at,
         s.n, w.pr_count,
         (SELECT count(*)::integer FROM public.kudos k WHERE k.workout_id = w.id),
         EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me)
  FROM public.follows f
  JOIN public.workouts w ON w.user_id = f.followee_id
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS n FROM public.sets x
    JOIN public.workout_exercises xe ON xe.id = x.workout_exercise_id
    WHERE xe.workout_id = w.id AND x.completed
  ) s
  WHERE f.follower_id = v_me
    AND f.status = 'accepted'
    AND w.finished_at IS NOT NULL
    AND w.finished_at >= now() - interval '14 days'
    AND (p_before IS NULL OR w.finished_at < p_before)
    AND s.n > 0
    AND NOT private.blocked_between(v_me, w.user_id)
    AND private.social_on(w.user_id)
  ORDER BY w.finished_at DESC, w.id
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
END
$function$;

-- One workout another person can see, read-only, as jsonb: the workout,
-- its exercises in position order with their sets. No notes, no volume, no
-- PR marks. Null when the caller cannot see it.
CREATE OR REPLACE FUNCTION public.social_workout(p_workout uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(true);
  v    jsonb;
BEGIN
  IF NOT private.workout_visible(v_me, p_workout) THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', w.id,
    'user_id', w.user_id,
    'username', p.username,
    'name', w.name,
    'workout_date', w.workout_date,
    'created_at', w.created_at,
    'finished_at', w.finished_at,
    'completed_sets', (
      SELECT count(*) FROM public.sets s
      JOIN public.workout_exercises se ON se.id = s.workout_exercise_id
      WHERE se.workout_id = w.id AND s.completed
    ),
    'kudos_count', (SELECT count(*) FROM public.kudos k WHERE k.workout_id = w.id),
    'kudos_given', EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', we.id,
        'position', we.position,
        'exercise', jsonb_build_object(
          'id', e.id, 'name', e.name, 'weight_type', e.weight_type, 'is_unilateral', e.is_unilateral,
          'mechanic', e.mechanic, 'level', e.level, 'equipment', e.equipment,
          'primary_muscle', e.primary_muscle, 'secondary_muscles', e.secondary_muscles,
          'gif_url_sm', e.gif_url_sm, 'gif_url', e.gif_url, 'image_url', e.image_url
        ),
        'sets', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weight', s.weight, 'weight_value', s.weight_value,
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed
          ) ORDER BY s.position)
          FROM public.sets s WHERE s.workout_exercise_id = we.id
        ), '[]'::jsonb)
      ) ORDER BY we.position)
      FROM public.workout_exercises we
      JOIN public.exercises e ON e.id = we.exercise_id
      WHERE we.workout_id = w.id
    ), '[]'::jsonb)
  ) INTO v
  FROM public.workouts w
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  WHERE w.id = p_workout;
  RETURN v;
END
$function$;

-- A person's profile sheet. Anyone the caller is connected to by a follow
-- row (either direction, any state) gets a row with their username and
-- where the two stand; `can_view` and the latest workout only when the
-- caller follows them. No row for a stranger, a block, or a user without
-- social on.
CREATE OR REPLACE FUNCTION public.social_profile(p_user uuid)
RETURNS TABLE (
  user_id            uuid,
  username           text,
  i_follow           text,
  follows_me         text,
  can_view           boolean,
  latest_workout_id  uuid,
  latest_name        text,
  latest_finished_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me       uuid := private.require_member(true);
  v_view     boolean;
  v_i_follow text;
  v_follows  text;
BEGIN
  IF p_user IS NULL OR p_user = v_me OR private.blocked_between(v_me, p_user) OR NOT private.social_on(p_user) THEN
    RETURN;
  END IF;
  SELECT f.status INTO v_i_follow FROM public.follows f WHERE f.follower_id = v_me AND f.followee_id = p_user;
  SELECT f.status INTO v_follows FROM public.follows f
  WHERE f.follower_id = p_user AND f.followee_id = v_me
    AND NOT (f.declined_at IS NOT NULL AND f.requested_by <> v_me);
  IF v_i_follow IS NULL AND v_follows IS NULL THEN
    RETURN;
  END IF;
  v_view := private.can_view(v_me, p_user);

  RETURN QUERY
  SELECT p_user, p.username, v_i_follow, v_follows, v_view, l.id, l.name, l.finished_at
  FROM (SELECT 1) one
  LEFT JOIN public.user_profiles p ON p.user_id = p_user
  LEFT JOIN LATERAL (
    SELECT w.id, w.name, w.finished_at
    FROM public.workouts w
    WHERE v_view
      AND w.user_id = p_user
      AND w.finished_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sets s
        JOIN public.workout_exercises se ON se.id = s.workout_exercise_id
        WHERE se.workout_id = w.id AND s.completed
      )
    ORDER BY w.finished_at DESC
    LIMIT 1
  ) l ON true;
END
$function$;

-- The streak read for the comparison: a followed person's finished workout
-- dates (one per workout, newest first) and weekly target. Nothing else.
-- No row when the caller cannot see them.
CREATE OR REPLACE FUNCTION public.social_streak(p_user uuid)
RETURNS TABLE (weekly_target integer, dates date[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  IF NOT private.can_view(v_me, p_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT coalesce((SELECT p.weekly_target FROM public.user_profiles p WHERE p.user_id = p_user), 3),
         coalesce((
           SELECT array_agg(w.workout_date ORDER BY w.workout_date DESC)
           FROM public.workouts w
           WHERE w.user_id = p_user AND w.finished_at IS NOT NULL
         ), ARRAY[]::date[]);
END
$function$;

-- ---------------------------------------------------------------------
-- 1l. Reports
-- ---------------------------------------------------------------------

-- Files a report on a person, optionally on one of their workouts. Open to
-- any signed-up user, social on or not. A workout must belong to the person
-- named. Returns the report id.
--
-- Only people the reporter is connected to: a follow row in either
-- direction, any status, or a block in either direction (block_user
-- deletes the follows, so a block is how a past connection shows, and a
-- person who blocked you can still be reported). And at most 10
-- reports per reporter in any rolling 24 hours; a per-reporter advisory
-- lock makes the count and the insert one step, so two calls at once
-- cannot both pass at 9.
CREATE OR REPLACE FUNCTION public.file_report(p_target_user uuid, p_target_workout uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
  v_id uuid;
BEGIN
  IF p_target_user IS NULL OR p_target_user = v_me THEN
    RAISE EXCEPTION 'Pick someone else to report.' USING ERRCODE = '22023';
  END IF;
  IF p_reason NOT IN ('inappropriate', 'harassment', 'spam', 'other') THEN
    RAISE EXCEPTION 'Pick a reason.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.follows f
    WHERE (f.follower_id = v_me AND f.followee_id = p_target_user)
       OR (f.follower_id = p_target_user AND f.followee_id = v_me)
  ) AND NOT private.blocked_between(v_me, p_target_user) THEN
    RAISE EXCEPTION 'You can only report people you''re connected to.' USING ERRCODE = '42501';
  END IF;
  IF p_target_workout IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workouts w WHERE w.id = p_target_workout AND w.user_id = p_target_user
  ) THEN
    RAISE EXCEPTION 'That workout is not theirs.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('file_report:' || v_me::text, 0));
  IF (
    SELECT count(*) FROM public.reports r
    WHERE r.reporter_id = v_me AND r.created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'Too many reports today. Try again tomorrow.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.reports (reporter_id, target_user_id, target_workout_id, reason)
  VALUES (v_me, p_target_user, p_target_workout, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- The admin queue, oldest first. Admins only.
CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open')
RETURNS TABLE (
  id                uuid,
  reporter_id       uuid,
  reporter_email    text,
  reporter_username text,
  target_user_id    uuid,
  target_email      text,
  target_username   text,
  target_workout_id uuid,
  reason            text,
  status            text,
  created_at        timestamptz,
  resolved_at       timestamptz
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
  SELECT r.id, r.reporter_id, ru.email::text, rp.username,
         r.target_user_id, tu.email::text, tp.username,
         r.target_workout_id, r.reason, r.status, r.created_at, r.resolved_at
  FROM public.reports r
  LEFT JOIN auth.users ru ON ru.id = r.reporter_id
  LEFT JOIN public.user_profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN auth.users tu ON tu.id = r.target_user_id
  LEFT JOIN public.user_profiles tp ON tp.user_id = r.target_user_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at;
END
$function$;

-- Resolves a report. 'dismiss' closes it. 'remove_follow' deletes the
-- follows between reporter and target in both directions. 'disable_social'
-- revokes the target's social flag, which wins over grants and the global
-- switch. Admins only.
CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_id uuid, p_action text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_report public.reports%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'remove_follow', 'disable_social') THEN
    RAISE EXCEPTION 'Action must be dismiss, remove_follow or disable_social.' USING ERRCODE = '22023';
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
  END IF;

  UPDATE public.reports
  SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = p_id;
  RETURN CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END;
END
$function$;

-- ---------------------------------------------------------------------
-- 1m. Function privileges. Private helpers: nobody but their owner and the
-- definer functions that call them. Public functions: signed-in users
-- only; each checks anonymous callers and admin rights itself.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  private.is_member(uuid),
  private.social_on(uuid),
  private.blocked_between(uuid, uuid),
  private.can_view(uuid, uuid),
  private.workout_visible(uuid, uuid),
  private.new_invite_code(),
  private.require_member(boolean),
  private.expire_follow_requests(),
  private.open_follow(uuid, uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.social_access(),
  public.admin_list_flags(text),
  public.admin_set_flag(text, text, text),
  public.admin_set_global_flag(text, boolean),
  public.my_invite_code(),
  public.regenerate_invite_code(),
  public.invite_preview(text),
  public.request_follow(text, text),
  public.request_follow_user(uuid),
  public.respond_follow(uuid, uuid, boolean),
  public.end_follow(uuid, uuid),
  public.list_follows(),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocks(),
  public.toggle_kudos(uuid),
  public.workout_kudos(uuid),
  public.social_feed(timestamptz, integer),
  public.social_workout(uuid),
  public.social_profile(uuid),
  public.social_streak(uuid),
  public.file_report(uuid, uuid, text),
  public.admin_list_reports(text),
  public.admin_resolve_report(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.social_access(),
  public.admin_list_flags(text),
  public.admin_set_flag(text, text, text),
  public.admin_set_global_flag(text, boolean),
  public.my_invite_code(),
  public.regenerate_invite_code(),
  public.invite_preview(text),
  public.request_follow(text, text),
  public.request_follow_user(uuid),
  public.respond_follow(uuid, uuid, boolean),
  public.end_follow(uuid, uuid),
  public.list_follows(),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocks(),
  public.toggle_kudos(uuid),
  public.workout_kudos(uuid),
  public.social_feed(timestamptz, integer),
  public.social_workout(uuid),
  public.social_profile(uuid),
  public.social_streak(uuid),
  public.file_report(uuid, uuid, text),
  public.admin_list_reports(text),
  public.admin_resolve_report(uuid, text)
TO authenticated;

COMMIT;

-- =====================================================================
-- Section 1b. Nightly expiry of pending follow requests
-- =====================================================================
-- pg_cron 1.6 replaces a job of the same name, so this is safe to run
-- twice. 11:27 UTC, ten minutes after purge-empty-guests.
SELECT cron.schedule('expire-follow-requests', '27 11 * * *', 'SELECT private.expire_follow_requests()');

-- =====================================================================
-- Section 2. Checks
-- =====================================================================
-- 2a. Structure. Expect RLS on for all seven tables, policies only on
-- user_flags and app_flags (SELECT), table grants for authenticated only
-- SELECT on those two, no grant for anon, the social row in app_flags with
-- enabled_for_all false, pr_count present, and no EXECUTE for anon on any
-- new public function.
--
-- SELECT
--   (SELECT json_agg(c.relname || ':' || c.relrowsecurity ORDER BY c.relname) FROM pg_class c
--      WHERE c.oid IN ('public.user_flags'::regclass, 'public.app_flags'::regclass, 'public.invite_codes'::regclass,
--        'public.follows'::regclass, 'public.blocks'::regclass, 'public.kudos'::regclass, 'public.reports'::regclass)) AS rls,
--   (SELECT json_agg(tablename || ':' || policyname || ':' || cmd) FROM pg_policies
--      WHERE tablename IN ('user_flags','app_flags','invite_codes','follows','blocks','kudos','reports')) AS policies,
--   (SELECT json_agg(table_name || ':' || grantee || ':' || privilege_type ORDER BY table_name, grantee)
--      FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
--        AND table_name IN ('user_flags','app_flags','invite_codes','follows','blocks','kudos','reports')) AS grants,
--   (SELECT row_to_json(a) FROM public.app_flags a WHERE a.flag = 'social') AS switch,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'workouts' AND column_name = 'pr_count') AS pr_count,
--   (SELECT json_agg(p.proname) FROM pg_proc p
--      WHERE p.pronamespace = 'public'::regnamespace
--        AND p.proname IN ('social_access','my_invite_code','social_feed','social_workout','toggle_kudos',
--          'request_follow','list_follows','block_user','file_report','admin_set_flag')
--        AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_can_execute,   -- expect null
--   (SELECT json_agg(jobname || ' @ ' || schedule) FROM cron.job) AS cron_jobs;
--
-- 2b. Every new user column cascades to auth.users, except reports
-- (set null). Expect cascade everywhere but reports.reporter_id,
-- reports.target_user_id, reports.resolved_by, user_flags.granted_by and
-- app_flags.updated_by.
--
-- SELECT c.conrelid::regclass AS tbl, a.attname AS col,
--        CASE c.confdeltype WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set null' ELSE c.confdeltype::text END AS on_delete
-- FROM pg_constraint c
-- JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
-- WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
--   AND c.conrelid::regclass::text IN ('user_flags','app_flags','invite_codes','follows','blocks','kudos','reports')
-- ORDER BY 1, 2;
--
-- 2c. An anonymous caller is refused. Each block should end in an error;
-- the rollback leaves nothing behind.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'is_anonymous', true, 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT public.my_invite_code();                     -- expect: Sign up to use this.
-- ROLLBACK;
--
-- 2d. A signed-up user without social on is refused social actions, and
-- cannot read or write the tables directly.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_flags f WHERE f.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT public.social_access();                      -- expect: false
-- SELECT * FROM public.social_feed();                  -- expect: Social is not on for this account.
-- ROLLBACK;
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT * FROM public.follows;                        -- expect: permission denied
-- ROLLBACK;
--
-- 2e. file_report refuses a stranger. The reporter is any signed-up user;
-- the target is a signed-up user with no follow row with them in either
-- direction and no block in either direction.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE ORDER BY u.created_at LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT public.file_report(
--   (SELECT u.id FROM auth.users u
--    WHERE u.is_anonymous IS NOT TRUE AND u.id <> auth.uid()
--      AND NOT EXISTS (SELECT 1 FROM public.follows f
--        WHERE (f.follower_id = auth.uid() AND f.followee_id = u.id) OR (f.follower_id = u.id AND f.followee_id = auth.uid()))
--      AND NOT EXISTS (SELECT 1 FROM public.blocks b
--        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = auth.uid()))
--    LIMIT 1),
--   NULL, 'spam');                                     -- expect: You can only report people you're connected to.
-- ROLLBACK;
--
-- 2f. file_report counts a block in either direction as a connection
-- (block_user removed the follows), and stops the 11th report in 24 hours.
-- Each block runs as postgres inside a transaction that rolls back, between
-- the two oldest signed-up accounts, with any reports by the reporter
-- cleared first.
--
-- The reporter blocked the target: one report goes through.
--
-- BEGIN;
-- CREATE TEMP TABLE t_pair ON COMMIT DROP AS
--   SELECT (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE ORDER BY u.created_at LIMIT 1) AS reporter,
--          (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE ORDER BY u.created_at OFFSET 1 LIMIT 1) AS target;
-- DELETE FROM public.follows f USING t_pair t
--   WHERE (f.follower_id = t.reporter AND f.followee_id = t.target) OR (f.follower_id = t.target AND f.followee_id = t.reporter);
-- DELETE FROM public.blocks b USING t_pair t
--   WHERE (b.blocker_id = t.reporter AND b.blocked_id = t.target) OR (b.blocker_id = t.target AND b.blocked_id = t.reporter);
-- DELETE FROM public.reports WHERE reporter_id = (SELECT reporter FROM t_pair);
-- INSERT INTO public.blocks (blocker_id, blocked_id) SELECT reporter, target FROM t_pair;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT reporter FROM t_pair))::text, true);
-- GRANT SELECT ON t_pair TO authenticated;
-- SET LOCAL ROLE authenticated;
-- SELECT public.file_report((SELECT target FROM t_pair), NULL, 'spam') IS NOT NULL AS filed;
--                                                    -- expect: true
-- ROLLBACK;
--
-- The target blocked the reporter: ten reports go through, the 11th is
-- refused.
--
-- BEGIN;
-- CREATE TEMP TABLE t_pair ON COMMIT DROP AS
--   SELECT (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE ORDER BY u.created_at LIMIT 1) AS reporter,
--          (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE ORDER BY u.created_at OFFSET 1 LIMIT 1) AS target;
-- DELETE FROM public.follows f USING t_pair t
--   WHERE (f.follower_id = t.reporter AND f.followee_id = t.target) OR (f.follower_id = t.target AND f.followee_id = t.reporter);
-- DELETE FROM public.blocks b USING t_pair t
--   WHERE (b.blocker_id = t.reporter AND b.blocked_id = t.target) OR (b.blocker_id = t.target AND b.blocked_id = t.reporter);
-- DELETE FROM public.reports WHERE reporter_id = (SELECT reporter FROM t_pair);
-- INSERT INTO public.blocks (blocker_id, blocked_id) SELECT target, reporter FROM t_pair;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT reporter FROM t_pair))::text, true);
-- GRANT SELECT ON t_pair TO authenticated;
-- SET LOCAL ROLE authenticated;
-- SELECT count(public.file_report((SELECT target FROM t_pair), NULL, 'spam')) FROM generate_series(1, 10);
--                                                    -- expect: 10
-- SELECT public.file_report((SELECT target FROM t_pair), NULL, 'spam');
--                                                    -- expect: Too many reports today. Try again tomorrow.
-- ROLLBACK;
--
-- 2g. A non-admin cannot set flags.
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--   (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS NOT TRUE
--      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id) LIMIT 1))::text, true);
-- SET LOCAL ROLE authenticated;
-- SELECT public.admin_set_flag('you@example.com', 'social', 'granted');   -- expect: not authorized
-- ROLLBACK;
