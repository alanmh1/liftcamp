-- SUPABASE (SQL editor)
-- Custom exercises: schema, gate, cap and admin controls. Copy to docs/custom-exercises.sql.
-- Spec: docs/custom-exercises-spec.md.
--
-- What this does
--   1. app_settings: a small key/value table. Seeds free_custom_exercise_limit = 5.
--   2. Flags: allows 'custom_exercises' next to 'social' in app_flags / user_flags and the
--      two admin flag functions. Seeds the global switch OFF.
--   3. exercises.owner_id (null = catalog, user id = that user's custom exercise) and
--      exercises.archived_at (a custom exercise the user deleted; history keeps it).
--   4. A guard trigger that runs on every client insert and update. Signed-up users only,
--      flag on, under the cap unless Pro. Forces custom rows into a safe shape.
--   5. RLS: everyone reads the catalog, each user also reads their own custom rows, users
--      insert and update only their own. Nobody can change a catalog row from the app.
--   6. custom_exercise_status() for the app, admin_list_settings() / admin_set_setting()
--      for /admin.
--
-- Safe to run with the feature off: no app code reads owner_id yet, and the flag is off.
-- IMPORTANT: apps/web reads exercises with the service role key, which skips RLS. No custom
-- rows exist until the flag is on, but the web branch must add owner_id IS NULL filters
-- before you turn the flag on for anyone.
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
COMMENT ON TABLE public.app_settings IS
  'Values the app reads that can change without a build. Written only through admin_set_setting.';

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
DROP POLICY IF EXISTS "Settings readable by signed-in users" ON public.app_settings;
CREATE POLICY "Settings readable by signed-in users" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings (key, value) VALUES ('free_custom_exercise_limit', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Flags
-- ---------------------------------------------------------------------
ALTER TABLE public.user_flags DROP CONSTRAINT IF EXISTS user_flags_flag_check;
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises'));
ALTER TABLE public.app_flags DROP CONSTRAINT IF EXISTS app_flags_flag_check;
ALTER TABLE public.app_flags ADD CONSTRAINT app_flags_flag_check
  CHECK (flag IN ('social', 'custom_exercises'));

INSERT INTO public.app_flags (flag, enabled_for_all) VALUES ('custom_exercises', false)
ON CONFLICT (flag) DO NOTHING;

-- Same bodies as the social migration, with the flag check widened.
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
  IF p_flag IS NULL OR p_flag NOT IN ('social', 'custom_exercises') THEN
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
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_flag IS NULL OR p_flag NOT IN ('social', 'custom_exercises') OR p_enabled IS NULL THEN
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
-- 3. Columns
-- ---------------------------------------------------------------------
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS exercises_owner_id_idx ON public.exercises (owner_id) WHERE owner_id IS NOT NULL;
COMMENT ON COLUMN public.exercises.owner_id IS
  'Null for the catalog. A user id for that user''s custom exercise, which only they can read.';
COMMENT ON COLUMN public.exercises.archived_at IS
  'Set when a user deletes a custom exercise. Hidden from the library and picker; history keeps it. Catalog rows leave it null.';

-- ---------------------------------------------------------------------
-- 4. Gate and guard
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_pro(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_entitlements e
    WHERE e.user_id = p_user AND e.is_pro AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$function$;

-- Signed up, not revoked, and the global switch on or a personal grant.
CREATE OR REPLACE FUNCTION private.custom_exercises_on(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.is_member(p_user)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_flags f
      WHERE f.user_id = p_user AND f.flag = 'custom_exercises' AND f.state = 'revoked'
    )
    AND (
      EXISTS (SELECT 1 FROM public.app_flags a WHERE a.flag = 'custom_exercises' AND a.enabled_for_all)
      OR EXISTS (
        SELECT 1 FROM public.user_flags f
        WHERE f.user_id = p_user AND f.flag = 'custom_exercises' AND f.state = 'granted'
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.free_custom_exercise_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT (s.value #>> '{}')::integer FROM public.app_settings s
                   WHERE s.key = 'free_custom_exercise_limit'), 5);
$function$;

-- Active (not archived) custom exercises a user has.
CREATE OR REPLACE FUNCTION private.custom_exercise_count(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT count(*)::integer FROM public.exercises e
  WHERE e.owner_id = p_user AND e.archived_at IS NULL;
$function$;

-- Runs on every insert and update. The SQL editor and the service role (auth.uid() null)
-- pass straight through, so catalog work is unchanged. App writes are held to this:
--   * catalog rows: never written from the app (RLS also refuses)
--   * custom rows: owner is the caller, flag on, under the cap unless Pro
--   * shape: slug custom-<id>, no media, no catalog-only fields, sane name and types
-- Errors the app keys on (SQLSTATE P0001, message first word):
--   custom_exercise_off, custom_exercise_limit, custom_exercise_invalid
CREATE OR REPLACE FUNCTION private.exercises_guard_custom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.owner_id IS NULL OR OLD.owner_id <> v_uid THEN
      RAISE EXCEPTION 'custom_exercise_invalid: not yours' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.id <> OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'custom_exercise_invalid: id and owner are fixed' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NEW.owner_id IS NULL OR NEW.owner_id <> v_uid THEN
      RAISE EXCEPTION 'custom_exercise_invalid: owner must be you' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Creating, or bringing back a deleted one, counts against the cap.
  IF TG_OP = 'INSERT' OR (OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL) THEN
    IF NOT private.custom_exercises_on(v_uid) THEN
      RAISE EXCEPTION 'custom_exercise_off' USING ERRCODE = 'P0001';
    END IF;
    IF NOT private.is_pro(v_uid) THEN
      PERFORM pg_advisory_xact_lock(hashtext('custom_exercise:' || v_uid::text));
      v_limit := private.free_custom_exercise_limit();
      IF private.custom_exercise_count(v_uid) >= v_limit THEN
        RAISE EXCEPTION 'custom_exercise_limit: %', v_limit USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  NEW.name := btrim(regexp_replace(coalesce(NEW.name, ''), '\s+', ' ', 'g'));
  IF char_length(NEW.name) < 2 OR char_length(NEW.name) > 60 THEN
    RAISE EXCEPTION 'custom_exercise_invalid: name must be 2 to 60 characters' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.primary_muscle IS NULL THEN
    RAISE EXCEPTION 'custom_exercise_invalid: pick a primary muscle' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.weight_type NOT IN ('standard', 'bodyweight') THEN
    RAISE EXCEPTION 'custom_exercise_invalid: weight type' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.set_type IS NOT NULL AND NEW.set_type NOT IN ('strength', 'cardio') THEN
    RAISE EXCEPTION 'custom_exercise_invalid: set type' USING ERRCODE = 'P0001';
  END IF;

  NEW.slug := 'custom-' || NEW.id::text;
  NEW.all_primary_muscles := NEW.primary_muscle;
  NEW.category := CASE WHEN NEW.set_type = 'cardio' THEN 'cardio' ELSE 'strength' END;
  NEW.image_url := NULL;
  NEW.image_url_2 := NULL;
  NEW.gif_url := NULL;
  NEW.gif_url_sm := NULL;
  NEW.description := NULL;
  NEW.level := NULL;
  NEW.ppl_day := NULL;
  NEW.has_incline := false;
  NEW.alias_text := NULL;
  RETURN NEW;
END
$function$;

-- Named to sort before exercises_set_slug_trg, so the custom slug is set first.
DROP TRIGGER IF EXISTS exercises_guard_custom_trg ON public.exercises;
CREATE TRIGGER exercises_guard_custom_trg
  BEFORE INSERT OR UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION private.exercises_guard_custom();

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Exercises readable by anyone" ON public.exercises;
DROP POLICY IF EXISTS "Exercises readable by authenticated users" ON public.exercises;
DROP POLICY IF EXISTS "Catalog and own custom exercises readable" ON public.exercises;
DROP POLICY IF EXISTS "Users add their own custom exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users edit their own custom exercises" ON public.exercises;

CREATE POLICY "Catalog and own custom exercises readable" ON public.exercises
  FOR SELECT TO anon, authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Users add their own custom exercises" ON public.exercises
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users edit their own custom exercises" ON public.exercises
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
-- No DELETE policy. Deleting in the app sets archived_at, so history never loses a row.

-- ---------------------------------------------------------------------
-- 6. RPCs
-- ---------------------------------------------------------------------
-- What the app needs to draw the Create row and the cap sheet.
CREATE OR REPLACE FUNCTION public.custom_exercise_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'enabled', coalesce(private.custom_exercises_on(auth.uid()), false),
    'member',  coalesce(private.is_member(auth.uid()), false),
    'pro',     coalesce(private.is_pro(auth.uid()), false),
    'used',    coalesce(private.custom_exercise_count(auth.uid()), 0),
    'limit',   private.free_custom_exercise_limit()
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_settings()
RETURNS TABLE (key text, value jsonb, updated_at timestamptz, updated_by text)
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
  SELECT s.key, s.value, s.updated_at, u.email::text
  FROM public.app_settings s
  LEFT JOIN auth.users u ON u.id = s.updated_by
  ORDER BY s.key;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_key IS DISTINCT FROM 'free_custom_exercise_limit' THEN
    RAISE EXCEPTION 'Unknown setting %.', p_key USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_value) <> 'number'
     OR (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric)
     OR (p_value #>> '{}')::integer NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'The limit must be a whole number from 0 to 100.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.app_settings AS s (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value, updated_at = now(), updated_by = auth.uid();
  RETURN p_value;
END
$function$;

REVOKE ALL ON FUNCTION public.custom_exercise_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custom_exercise_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_setting(text, jsonb) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------
-- Check. Expect one row: limit 5, flag off, 0 custom rows, 1 select policy, trigger present.
-- ---------------------------------------------------------------------
SELECT
  (SELECT value FROM public.app_settings WHERE key = 'free_custom_exercise_limit') AS free_limit,
  (SELECT enabled_for_all FROM public.app_flags WHERE flag = 'custom_exercises') AS flag_on,
  (SELECT count(*) FROM public.exercises WHERE owner_id IS NOT NULL) AS custom_rows,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'exercises' AND cmd = 'SELECT') AS select_policies,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'exercises_guard_custom_trg') AS guard_trigger;
