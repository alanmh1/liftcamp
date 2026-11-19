-- Social photos and takedown requests (branch social-photos).
-- Spec: docs/social-v2-spec.md. Run in SUPABASE (SQL editor) AFTER
-- docs/social-safety.sql and docs/social-comments.sql, one section at a
-- time. Read Section 0's output before Section 1.
--
-- Built 19 Nov 2026 against the live database plus the two files above.
-- Bodies of social_feed, social_workout, file_report, notify_admin_report,
-- admin_list_reports and admin_resolve_report are the previous files'
-- versions with only the marked changes ("-- photos").
--
-- What this adds:
--   1. A private storage bucket, workout-photos: JPEG only, 3 MB max.
--      Paths are <user_id>/<workout_id>/<random>.jpg.
--   2. public.workout_photos, one photo per workout. Every photo starts
--      'pending' and friends only ever see 'approved' ones. The
--      moderate-text function decides: approved, rejected (flagged, or a
--      copy of a removed image), or quarantined (possible CSAM, kept as
--      evidence and never shown or deleted).
--   3. Upload flow: begin_workout_photo hands out a path, the app uploads
--      to it, commit_workout_photo records it. remove_workout_photo drops
--      it. Storage policies let the owner upload only to a path they were
--      handed, let friends read only approved photos of workouts they can
--      see, and let the owner delete only files no row points at.
--   4. private.blocked_image_hashes: SHA-256 of removed images, so an
--      identical copy is rejected on upload (TAKE IT DOWN asks for
--      reasonable efforts to remove known identical copies).
--   5. The report reason 'intimate_image', with a 48-hour clock in the
--      email.
--   6. public.takedown_requests, filled from the liftcamp.app/report-content
--      form by anyone (no account needed): intimate images, copyright
--      (DMCA) and other. Emails hello@liftcamp.app at once.
--   7. Photo fields on social_feed and social_workout.
--   8. Admin: photo in the report queue, remove_photo, a takedown queue,
--      a per-user content lookup, and standalone hide and remove tools.
--   9. A weekly job that asks the sweep-photos function to delete files
--      nothing points at.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Expect:
--   - comments ran: workout_comments and private.workout_open_to present
--   - workout_photos and takedown_requests missing (null)
--   - bucket workout-photos missing (0 rows)
--   - pg_cron installed
-- ---------------------------------------------------------------------------
SELECT to_regclass('public.workout_comments') AS comments_table,
       to_regprocedure('private.workout_open_to(uuid,uuid)') AS workout_open_to,
       to_regclass('public.workout_photos') AS photos_table,
       to_regclass('public.takedown_requests') AS takedowns_table;

SELECT id FROM storage.buckets WHERE id = 'workout-photos';

SELECT extname FROM pg_extension WHERE extname = 'pg_cron';

-- ---------------------------------------------------------------------------
-- Section 1: bucket and tables.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.workout_comments') IS NULL THEN
    RAISE EXCEPTION 'Run docs/social-comments.sql first.';
  END IF;
END
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('workout-photos', 'workout-photos', false, 3145728, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.workout_photos (
  workout_id        uuid PRIMARY KEY REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path      text NOT NULL UNIQUE,
  width             integer CHECK (width > 0),
  height            integer CHECK (height > 0),
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'quarantined')),
  sha256            text,
  moderation_detail jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  moderated_at      timestamptz,
  hidden_at         timestamptz
);

CREATE INDEX IF NOT EXISTS workout_photos_user_idx ON public.workout_photos (user_id);
CREATE INDEX IF NOT EXISTS workout_photos_sha_idx ON public.workout_photos (sha256);

ALTER TABLE public.workout_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workout_photos FROM PUBLIC, anon, authenticated;

-- Paths handed out by begin_workout_photo and not yet committed.
CREATE TABLE IF NOT EXISTS private.photo_uploads (
  path       text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photo_uploads_user_idx ON private.photo_uploads (user_id, created_at);

CREATE TABLE IF NOT EXISTS private.blocked_image_hashes (
  sha256   text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  reason   text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid
);

-- Quarantined photos, kept even if the workout or account is deleted.
-- No foreign keys on purpose. Nothing in the app or the sweep deletes a
-- path listed here.
CREATE TABLE IF NOT EXISTS private.photo_evidence (
  path           text PRIMARY KEY,
  user_id        uuid,
  workout_id     uuid,
  sha256         text,
  detail         jsonb,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.photo_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.blocked_image_hashes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.photo_evidence FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.keep_photo_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'quarantined' THEN
    INSERT INTO private.photo_evidence (path, user_id, workout_id, sha256, detail)
    VALUES (NEW.storage_path, NEW.user_id, NEW.workout_id, NEW.sha256, NEW.moderation_detail)
    ON CONFLICT (path) DO NOTHING;
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION private.keep_photo_evidence() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER workout_photos_keep_evidence
  AFTER INSERT OR UPDATE OF status ON public.workout_photos
  FOR EACH ROW EXECUTE FUNCTION private.keep_photo_evidence();

-- ---------------------------------------------------------------------------
-- Section 2: upload, commit, remove, and the owner's own view.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.own_open_workout(p_me uuid, p_workout uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = p_workout
      AND w.user_id = p_me
      AND w.finished_at IS NOT NULL
      AND w.hidden_at IS NULL
  );
$function$;

REVOKE ALL ON FUNCTION private.own_open_workout(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Hands out a fresh path. 20 a day.
CREATE OR REPLACE FUNCTION public.begin_workout_photo(p_workout uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me   uuid := private.require_member(true);
  v_path text;
BEGIN
  IF NOT private.own_open_workout(v_me, p_workout) THEN
    RAISE EXCEPTION 'Finish the workout before adding a photo.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workout_photos ph
    WHERE ph.workout_id = p_workout AND ph.status = 'quarantined'
  ) THEN
    RAISE EXCEPTION 'This workout''s photo can''t be changed right now.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('begin_workout_photo:' || v_me::text, 0));
  IF (
    SELECT count(*) FROM private.photo_uploads u
    WHERE u.user_id = v_me AND u.created_at > now() - interval '24 hours'
  ) + (
    SELECT count(*) FROM public.workout_photos ph
    WHERE ph.user_id = v_me AND ph.created_at > now() - interval '24 hours'
  ) >= 20 THEN
    RAISE EXCEPTION 'That''s a lot of photos today. Try again tomorrow.' USING ERRCODE = '54000';
  END IF;

  v_path := v_me::text || '/' || p_workout::text || '/' || gen_random_uuid()::text || '.jpg';
  INSERT INTO private.photo_uploads (path, user_id, workout_id) VALUES (v_path, v_me, p_workout);
  RETURN v_path;
END
$function$;

-- Records an uploaded file as the workout's photo, pending moderation.
-- Returns the path of the photo it replaced (null if none), which the app
-- then deletes from storage.
CREATE OR REPLACE FUNCTION public.commit_workout_photo(p_workout uuid, p_path text, p_width integer, p_height integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me  uuid := private.require_member(true);
  v_old text;
BEGIN
  IF NOT private.own_open_workout(v_me, p_workout) THEN
    RAISE EXCEPTION 'Finish the workout before adding a photo.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.photo_uploads u
    WHERE u.path = p_path AND u.user_id = v_me AND u.workout_id = p_workout
  ) THEN
    RAISE EXCEPTION 'Start the upload again.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'workout-photos' AND o.name = p_path
  ) THEN
    RAISE EXCEPTION 'The photo didn''t finish uploading.' USING ERRCODE = 'P0002';
  END IF;

  SELECT ph.storage_path INTO v_old FROM public.workout_photos ph
  WHERE ph.workout_id = p_workout FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.workout_photos ph
    WHERE ph.workout_id = p_workout AND ph.status = 'quarantined'
  ) THEN
    RAISE EXCEPTION 'This workout''s photo can''t be changed right now.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_photos (workout_id, user_id, storage_path, width, height)
  VALUES (p_workout, v_me, p_path,
          CASE WHEN p_width > 0 THEN p_width END,
          CASE WHEN p_height > 0 THEN p_height END)
  ON CONFLICT (workout_id) DO UPDATE
    SET storage_path = excluded.storage_path,
        width = excluded.width,
        height = excluded.height,
        status = 'pending',
        sha256 = NULL,
        moderation_detail = NULL,
        moderated_at = NULL,
        hidden_at = NULL,
        created_at = now();

  DELETE FROM private.photo_uploads WHERE path = p_path;
  RETURN v_old;
END
$function$;

-- Returns the removed photo's path for the app to delete from storage.
CREATE OR REPLACE FUNCTION public.remove_workout_photo(p_workout uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me   uuid := private.require_member(false);
  v_path text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workout_photos ph
    WHERE ph.workout_id = p_workout AND ph.user_id = v_me AND ph.status = 'quarantined'
  ) THEN
    RAISE EXCEPTION 'This workout''s photo can''t be changed right now.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.workout_photos ph
  WHERE ph.workout_id = p_workout AND ph.user_id = v_me
  RETURNING ph.storage_path INTO v_path;
  RETURN v_path;
END
$function$;

-- The owner's own photo and its state, for the summary and their detail.
-- status 'quarantined' is reported to the owner as 'rejected'.
CREATE OR REPLACE FUNCTION public.my_workout_photo(p_workout uuid)
 RETURNS TABLE(path text, width integer, height integer, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  RETURN QUERY
  SELECT CASE WHEN ph.status = 'quarantined' THEN NULL ELSE ph.storage_path END,
         ph.width, ph.height,
         CASE WHEN ph.status = 'quarantined' OR ph.hidden_at IS NOT NULL THEN 'rejected' ELSE ph.status END
  FROM public.workout_photos ph
  WHERE ph.workout_id = p_workout AND ph.user_id = v_me;
END
$function$;

REVOKE ALL ON FUNCTION public.begin_workout_photo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.commit_workout_photo(uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_workout_photo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_workout_photo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_workout_photo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_workout_photo(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workout_photo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_workout_photo(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 3: storage policies for the bucket.
-- The checks live in SECURITY DEFINER functions, since policies run as the
-- caller and the caller can't read workout_photos or the private tables.
-- The Edge Functions use the service role and skip these.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.photo_upload_allowed(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM private.photo_uploads u
    WHERE u.path = p_name
      AND u.user_id = auth.uid()
      AND u.created_at > now() - interval '1 hour'
  );
$function$;

CREATE OR REPLACE FUNCTION public.photo_readable(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.photo_upload_allowed(p_name)
    OR EXISTS (
      SELECT 1 FROM public.workout_photos ph
      WHERE ph.storage_path = p_name
        AND (
          (ph.user_id = auth.uid() AND ph.status <> 'quarantined')
          OR (
            ph.status = 'approved'
            AND ph.hidden_at IS NULL
            AND private.workout_visible(auth.uid(), ph.workout_id)
          )
        )
    )
  );
$function$;

-- The owner may delete a file in their folder once no photo row points at
-- it, unless it is kept as evidence.
CREATE OR REPLACE FUNCTION public.photo_deletable(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND split_part(p_name, '/', 1) = auth.uid()::text
    AND NOT EXISTS (SELECT 1 FROM public.workout_photos ph WHERE ph.storage_path = p_name)
    AND NOT EXISTS (SELECT 1 FROM private.photo_evidence e WHERE e.path = p_name);
$function$;

REVOKE ALL ON FUNCTION public.photo_upload_allowed(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.photo_readable(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.photo_deletable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.photo_upload_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_readable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_deletable(text) TO authenticated;

DROP POLICY IF EXISTS "workout photos upload" ON storage.objects;
DROP POLICY IF EXISTS "workout photos read" ON storage.objects;
DROP POLICY IF EXISTS "workout photos delete" ON storage.objects;

CREATE POLICY "workout photos upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workout-photos' AND public.photo_upload_allowed(name));

CREATE POLICY "workout photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'workout-photos' AND public.photo_readable(name));

CREATE POLICY "workout photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'workout-photos' AND public.photo_deletable(name));

-- ---------------------------------------------------------------------------
-- Section 4: moderation hook, and two service-role helpers for the Edge
-- Functions (they can't read the private schema through the API).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.queue_photo_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NULL;
  END IF;
  PERFORM private.post_moderation('workout_photos', NEW.workout_id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION private.queue_photo_moderation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER workout_photos_queue_moderation
  AFTER INSERT OR UPDATE OF storage_path ON public.workout_photos
  FOR EACH ROW EXECUTE FUNCTION private.queue_photo_moderation();

CREATE OR REPLACE FUNCTION public.photo_hash_blocked(p_sha text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM private.blocked_image_hashes b WHERE b.sha256 = lower(p_sha));
$function$;

-- Every path the sweep must keep: current photos, evidence, and uploads
-- handed out in the last day.
CREATE OR REPLACE FUNCTION public.photo_paths_to_keep()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT ph.storage_path FROM public.workout_photos ph
  UNION SELECT e.path FROM private.photo_evidence e
  UNION SELECT u.path FROM private.photo_uploads u WHERE u.created_at > now() - interval '1 day';
$function$;

-- Files in the bucket older than a day that nothing keeps, oldest first.
-- The sweep-photos function deletes these.
CREATE OR REPLACE FUNCTION public.photo_orphans(p_limit integer DEFAULT 500)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'workout-photos'
    AND o.created_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM public.photo_paths_to_keep() k WHERE k = o.name)
  ORDER BY o.created_at
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 1000);
$function$;

REVOKE ALL ON FUNCTION public.photo_hash_blocked(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.photo_paths_to_keep() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.photo_orphans(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.photo_hash_blocked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.photo_paths_to_keep() TO service_role;
GRANT EXECUTE ON FUNCTION public.photo_orphans(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Section 5: the intimate image report reason.
-- file_report: same body as live, reasons list gains 'intimate_image'.
-- file_comment_report keeps the four reasons (comments have no images).
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check
  CHECK (reason = ANY (ARRAY['inappropriate'::text, 'harassment'::text, 'spam'::text, 'other'::text, 'auto_flag'::text, 'intimate_image'::text]));

CREATE OR REPLACE FUNCTION public.file_report(p_target_user uuid, p_target_workout uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
  v_id uuid;
BEGIN
  IF p_target_user IS NULL OR p_target_user = v_me THEN
    RAISE EXCEPTION 'Pick someone else to report.' USING ERRCODE = '22023';
  END IF;
  IF p_reason NOT IN ('inappropriate', 'harassment', 'spam', 'other', 'intimate_image') THEN -- photos
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

CREATE OR REPLACE FUNCTION private.notify_admin_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_key      text;
  v_reporter text;
  v_target   text;
  v_name     text;
  v_note     text;
  v_comment  text;
  v_photo    text;
  v_subject  text;
  v_body     text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.username INTO v_reporter FROM public.user_profiles p WHERE p.user_id = NEW.reporter_id;
  SELECT p.username INTO v_target FROM public.user_profiles p WHERE p.user_id = NEW.target_user_id;
  IF NEW.target_workout_id IS NOT NULL THEN
    SELECT w.name, w.notes INTO v_name, v_note FROM public.workouts w WHERE w.id = NEW.target_workout_id;
    SELECT ph.status INTO v_photo FROM public.workout_photos ph WHERE ph.workout_id = NEW.target_workout_id; -- photos
  END IF;
  IF NEW.target_comment_id IS NOT NULL THEN
    SELECT c.body INTO v_comment FROM public.workout_comments c WHERE c.id = NEW.target_comment_id;
  END IF;

  v_subject := CASE
    -- photos: the 48-hour clock goes in the subject
    WHEN NEW.reason = 'intimate_image' THEN format(
      'URGENT LiftCamp: intimate image report on @%s, remove by %s PT',
      coalesce(v_target, 'unknown'),
      to_char((NEW.created_at + interval '48 hours') AT TIME ZONE 'America/Los_Angeles', 'Dy Mon DD HH24:MI'))
    WHEN NEW.reason = 'auto_flag' AND NEW.detail ->> 'csam' = 'true' THEN format(
      'URGENT LiftCamp: photo quarantined (possible CSAM) from @%s', coalesce(v_target, 'unknown'))
    WHEN NEW.reason = 'auto_flag' THEN format('LiftCamp: auto-flagged @%s', coalesce(v_target, 'unknown'))
    ELSE format('LiftCamp: report (%s) on @%s', NEW.reason, coalesce(v_target, 'unknown'))
  END;
  v_body := format(
    E'Reason: %s\nReported: @%s\nBy: %s\nWorkout: %s\nNote: %s\nPhoto: %s\nComment: %s\nDetail: %s\nFiled: %s\n\nReview: https://liftcamp.app/admin',
    NEW.reason,
    coalesce(v_target, 'unknown'),
    CASE WHEN NEW.reporter_id IS NULL THEN 'moderation check' ELSE '@' || coalesce(v_reporter, 'unknown') END,
    coalesce(v_name, '(none)'),
    coalesce(left(v_note, 500), '(none)'),
    coalesce(v_photo, '(none)'),
    coalesce(v_comment, '(none)'),
    coalesce(NEW.detail::text, '(none)'),
    to_char(NEW.created_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI')
  );

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'LiftCamp <hello@liftcamp.app>',
      'to', 'hello@liftcamp.app',
      'subject', v_subject,
      'text', v_body
    )
  );
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

-- ---------------------------------------------------------------------------
-- Section 6: photos on the feed and the read-only workout. Friends get an
-- approved, unhidden photo only. social_feed's return type gains three
-- columns, so it is dropped and recreated.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.social_feed(timestamp with time zone, uuid, integer, uuid);

CREATE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_user uuid DEFAULT NULL::uuid)
 RETURNS TABLE(workout_id uuid, user_id uuid, username text, name text, note text, workout_date date, created_at timestamp with time zone, finished_at timestamp with time zone, completed_sets integer, volume numeric, volume_unit text, pr_count integer, exercises jsonb, kudos_count integer, kudos_given boolean, comment_count integer, photo_path text, photo_width integer, photo_height integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  WITH owners AS (
    SELECT f.followee_id AS uid
    FROM public.follows f
    WHERE p_user IS NULL
      AND f.follower_id = v_me
      AND f.status = 'accepted'
      AND NOT private.blocked_between(v_me, f.followee_id)
      AND private.social_on(f.followee_id)
    UNION
    SELECT p_user
    WHERE p_user IS NOT NULL
      AND private.can_view(v_me, p_user)
  )
  SELECT w.id, w.user_id, p.username,
         private.shown_name(w.name, w.moderation_flagged_at),
         private.shown_note(w.notes, w.platform, w.moderation_flagged_at),
         w.workout_date, w.created_at, w.finished_at,
         s.n, w.volume, w.volume_unit, w.pr_count,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
             'workout_exercise_id', we.id,
             'exercise_id', e.id,
             'name', e.name,
             'sets', c.n,
             'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END
           ) ORDER BY we.position, we.id)
           FROM public.workout_exercises we
           JOIN public.exercises e ON e.id = we.exercise_id
           CROSS JOIN LATERAL (
             SELECT count(*)::integer AS n FROM public.sets x
             WHERE x.workout_exercise_id = we.id AND x.completed
               AND x.set_type IS DISTINCT FROM 'warmup'
           ) c
           WHERE we.workout_id = w.id AND c.n > 0
         ), '[]'::jsonb),
         (SELECT count(*)::integer FROM public.kudos k WHERE k.workout_id = w.id),
         EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
         private.comment_count(v_me, w.id),
         ph.storage_path, ph.width, ph.height -- photos
  FROM owners o
  JOIN public.workouts w ON w.user_id = o.uid
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  LEFT JOIN public.workout_photos ph -- photos
    ON ph.workout_id = w.id AND ph.status = 'approved' AND ph.hidden_at IS NULL
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS n FROM public.sets x
    JOIN public.workout_exercises xe ON xe.id = x.workout_exercise_id
    WHERE xe.workout_id = w.id AND x.completed
      AND x.set_type IS DISTINCT FROM 'warmup'
  ) s
  WHERE w.finished_at IS NOT NULL
    AND w.hidden_at IS NULL
    AND (p_user IS NOT NULL OR w.finished_at >= now() - interval '14 days')
    AND (
      p_before IS NULL
      OR w.finished_at < p_before
      OR (p_before_id IS NOT NULL AND w.finished_at = p_before AND w.id < p_before_id)
    )
    AND s.n > 0
  ORDER BY w.finished_at DESC, w.id DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
END
$function$;

REVOKE ALL ON FUNCTION public.social_feed(timestamp with time zone, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_feed(timestamp with time zone, uuid, integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.social_workout(p_workout uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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
    'name', private.shown_name(w.name, w.moderation_flagged_at),
    'note', private.shown_note(w.notes, w.platform, w.moderation_flagged_at),
    'workout_date', w.workout_date,
    'created_at', w.created_at,
    'finished_at', w.finished_at,
    'volume', w.volume,
    'volume_unit', w.volume_unit,
    'pr_count', w.pr_count,
    'completed_sets', (
      SELECT count(*) FROM public.sets s
      JOIN public.workout_exercises se ON se.id = s.workout_exercise_id
      WHERE se.workout_id = w.id AND s.completed
        AND s.set_type IS DISTINCT FROM 'warmup'
    ),
    'kudos_count', (SELECT count(*) FROM public.kudos k WHERE k.workout_id = w.id),
    'kudos_given', EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me),
    'comment_count', private.comment_count(v_me, w.id),
    'photo', ( -- photos
      SELECT jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
      FROM public.workout_photos ph
      WHERE ph.workout_id = w.id AND ph.status = 'approved' AND ph.hidden_at IS NULL
    ),
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', we.id,
        'position', we.position,
        'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END,
        'exercise', jsonb_build_object(
          'id', e.id, 'name', e.name, 'weight_type', e.weight_type, 'is_unilateral', e.is_unilateral,
          'mechanic', e.mechanic, 'level', e.level, 'equipment', e.equipment,
          'primary_muscle', e.primary_muscle, 'secondary_muscles', e.secondary_muscles,
          'gif_url_sm', e.gif_url_sm, 'gif_url', e.gif_url, 'image_url', e.image_url
        ),
        'sets', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weight', s.weight, 'weight_value', s.weight_value,
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed,
            'set_type', s.set_type
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

-- ---------------------------------------------------------------------------
-- Section 7: takedown requests from the web form (no account needed).
-- kind 'intimate_image' (TAKE IT DOWN Act, 48 hours), 'copyright' (DMCA)
-- or 'other'. The requester confirms the statements each kind needs; the
-- form sends which ones in p_statements. Five per email a day, 30 in all
-- an hour.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.takedown_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN ('intimate_image', 'copyright', 'other')),
  requester_name  text NOT NULL CHECK (char_length(btrim(requester_name)) BETWEEN 2 AND 200),
  requester_email text NOT NULL CHECK (char_length(requester_email) <= 320 AND requester_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  target          text NOT NULL CHECK (char_length(btrim(target)) BETWEEN 1 AND 1000),
  details         text CHECK (char_length(details) <= 4000),
  signature       text NOT NULL CHECK (char_length(btrim(signature)) BETWEEN 2 AND 200),
  statements      jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'rejected')),
  due_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.takedown_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_takedown_request(p_kind text, p_name text, p_email text, p_target text, p_details text, p_signature text, p_statements jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_need  text[];
  v_id    uuid;
BEGIN
  IF p_kind NOT IN ('intimate_image', 'copyright', 'other') THEN
    RAISE EXCEPTION 'Pick what kind of request this is.' USING ERRCODE = '22023';
  END IF;
  -- The statements each kind needs, as checkboxes on the form.
  v_need := CASE p_kind
    WHEN 'intimate_image' THEN ARRAY['depicted_or_authorized', 'not_consented', 'good_faith']
    WHEN 'copyright' THEN ARRAY['good_faith', 'accurate_under_penalty', 'owner_or_authorized']
    ELSE ARRAY['good_faith']
  END;
  IF p_statements IS NULL OR jsonb_typeof(p_statements) <> 'object' OR EXISTS (
    SELECT 1 FROM unnest(v_need) k WHERE coalesce((p_statements ->> k)::boolean, false) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Confirm each statement to send the request.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('takedown', 0));
  IF (SELECT count(*) FROM public.takedown_requests t
      WHERE lower(t.requester_email) = v_email AND t.created_at > now() - interval '24 hours') >= 5
     OR (SELECT count(*) FROM public.takedown_requests t
         WHERE t.created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Too many requests right now. Email hello@liftcamp.app instead.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.takedown_requests
    (kind, requester_name, requester_email, target, details, signature, statements, due_at)
  VALUES
    (p_kind, btrim(p_name), v_email, btrim(p_target), nullif(btrim(coalesce(p_details, '')), ''),
     btrim(p_signature), p_statements,
     CASE WHEN p_kind = 'intimate_image' THEN now() + interval '48 hours' END)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.submit_takedown_request(text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_takedown_request(text, text, text, text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_admin_takedown()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_key     text;
  v_subject text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;
  v_subject := CASE NEW.kind
    WHEN 'intimate_image' THEN format('URGENT LiftCamp takedown (intimate image), remove by %s PT',
      to_char(NEW.due_at AT TIME ZONE 'America/Los_Angeles', 'Dy Mon DD HH24:MI'))
    WHEN 'copyright' THEN 'LiftCamp: copyright (DMCA) notice'
    ELSE 'LiftCamp: content removal request'
  END;
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'LiftCamp <hello@liftcamp.app>',
      'to', 'hello@liftcamp.app',
      'reply_to', NEW.requester_email,
      'subject', v_subject,
      'text', format(
        E'Kind: %s\nFrom: %s <%s>\nContent: %s\nDetails: %s\nSigned: %s\nStatements: %s\nReceived: %s PT\n\nHandle it: https://liftcamp.app/admin',
        NEW.kind, NEW.requester_name, NEW.requester_email, NEW.target,
        coalesce(NEW.details, '(none)'), NEW.signature, NEW.statements::text,
        to_char(NEW.created_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI'))
    )
  );
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION private.notify_admin_takedown() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER takedown_requests_notify_admin
  AFTER INSERT ON public.takedown_requests
  FOR EACH ROW EXECUTE FUNCTION private.notify_admin_takedown();

-- ---------------------------------------------------------------------------
-- Section 8: admin tools.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_reports(text);

CREATE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open'::text)
 RETURNS TABLE(id uuid, reporter_id uuid, reporter_email text, reporter_username text, target_user_id uuid, target_email text, target_username text, target_workout_id uuid, workout_name text, workout_note text, workout_hidden boolean, workout_flagged boolean, photo_path text, photo_status text, comment_id uuid, comment_body text, comment_hidden boolean, reason text, detail jsonb, status text, created_at timestamp with time zone, resolved_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.reporter_id, ru.email::text, rp.username,
         r.target_user_id, tu.email::text, tp.username,
         r.target_workout_id, w.name, w.notes,
         w.hidden_at IS NOT NULL, w.moderation_flagged_at IS NOT NULL,
         ph.storage_path, -- photos
         CASE WHEN ph.hidden_at IS NOT NULL AND ph.status = 'approved' THEN 'removed' ELSE ph.status END, -- photos
         r.target_comment_id, c.body, c.hidden_at IS NOT NULL,
         r.reason, r.detail, r.status, r.created_at, r.resolved_at
  FROM public.reports r
  LEFT JOIN auth.users ru ON ru.id = r.reporter_id
  LEFT JOIN public.user_profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN auth.users tu ON tu.id = r.target_user_id
  LEFT JOIN public.user_profiles tp ON tp.user_id = r.target_user_id
  LEFT JOIN public.workouts w ON w.id = r.target_workout_id
  LEFT JOIN public.workout_photos ph ON ph.workout_id = r.target_workout_id -- photos
  LEFT JOIN public.workout_comments c ON c.id = r.target_comment_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY (r.reason = 'intimate_image') DESC, r.created_at; -- photos: urgent first
END
$function$;

REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated;

-- Removes a workout's photo for everyone but its owner and, when the
-- photo was hashed, blocks identical copies. Used by remove_photo below
-- and by the takedown tools.
CREATE OR REPLACE FUNCTION private.remove_photo(p_workout uuid, p_reason text, p_by uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_sha text;
BEGIN
  UPDATE public.workout_photos
  SET hidden_at = coalesce(hidden_at, now()),
      status = CASE WHEN status = 'quarantined' THEN status ELSE 'rejected' END
  WHERE workout_id = p_workout
  RETURNING sha256 INTO v_sha;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_sha IS NOT NULL THEN
    INSERT INTO private.blocked_image_hashes (sha256, reason, added_by)
    VALUES (lower(v_sha), p_reason, p_by)
    ON CONFLICT (sha256) DO NOTHING;
  END IF;
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION private.remove_photo(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

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
  IF p_action NOT IN ('dismiss', 'remove_follow', 'disable_social', 'hide_workout', 'reset_username', 'hide_comment', 'remove_photo') THEN -- photos
    RAISE EXCEPTION 'Action must be dismiss, remove_follow, disable_social, hide_workout, reset_username, hide_comment or remove_photo.' USING ERRCODE = '22023';
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
  ELSIF p_action = 'hide_comment' THEN
    IF v_report.target_comment_id IS NULL THEN
      RAISE EXCEPTION 'This report has no comment to hide.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.workout_comments SET hidden_at = coalesce(hidden_at, now())
    WHERE id = v_report.target_comment_id;
  -- photos: from here to the dismiss branches
  ELSIF p_action = 'remove_photo' THEN
    IF v_report.target_workout_id IS NULL
       OR NOT private.remove_photo(v_report.target_workout_id, 'report:' || v_report.reason, auth.uid()) THEN
      RAISE EXCEPTION 'This report has no photo to remove.' USING ERRCODE = '22023';
    END IF;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag' AND v_report.target_comment_id IS NOT NULL THEN
    UPDATE public.workout_comments SET moderation_flagged_at = NULL
    WHERE id = v_report.target_comment_id;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag' AND v_report.detail ->> 'field' = 'photo' THEN -- photos
    -- A false positive on a photo: approve it, unless it was quarantined.
    UPDATE public.workout_photos SET status = 'approved'
    WHERE workout_id = v_report.target_workout_id AND status = 'rejected' AND hidden_at IS NULL;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag' AND v_report.target_workout_id IS NOT NULL THEN
    UPDATE public.workouts SET moderation_flagged_at = NULL
    WHERE id = v_report.target_workout_id;
  END IF;

  UPDATE public.reports
  SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = p_id;
  RETURN CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_takedowns(p_status text DEFAULT 'open'::text)
 RETURNS TABLE(id uuid, kind text, requester_name text, requester_email text, target text, details text, signature text, statements jsonb, status text, due_at timestamp with time zone, created_at timestamp with time zone, resolved_at timestamp with time zone, resolution_note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.id, t.kind, t.requester_name, t.requester_email, t.target, t.details, t.signature,
         t.statements, t.status, t.due_at, t.created_at, t.resolved_at, t.resolution_note
  FROM public.takedown_requests t
  WHERE p_status IS NULL OR t.status = p_status
  ORDER BY t.due_at NULLS LAST, t.created_at;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_takedown(p_id uuid, p_status text, p_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('actioned', 'rejected', 'open') THEN
    RAISE EXCEPTION 'Status must be actioned, rejected or open.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.takedown_requests
  SET status = p_status,
      resolution_note = nullif(btrim(coalesce(p_note, '')), ''),
      resolved_at = CASE WHEN p_status = 'open' THEN NULL ELSE now() END,
      resolved_by = CASE WHEN p_status = 'open' THEN NULL ELSE auth.uid() END
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such request.' USING ERRCODE = 'P0002';
  END IF;
  RETURN p_status;
END
$function$;

-- Everything a user shares, for acting on a takedown that names them.
CREATE OR REPLACE FUNCTION public.admin_user_content(p_username text)
 RETURNS TABLE(user_id uuid, username text, workout_id uuid, finished_at timestamp with time zone, name text, note text, workout_hidden boolean, photo_path text, photo_status text, photo_hidden boolean, comments jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT p.user_id INTO v_user FROM public.user_profiles p
  WHERE lower(p.username) = lower(btrim(ltrim(coalesce(p_username, ''), '@')));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user is called %.', p_username USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT w.user_id, p.username, w.id, w.finished_at, w.name, w.notes, w.hidden_at IS NOT NULL,
         ph.storage_path, ph.status, ph.hidden_at IS NOT NULL,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'hidden', c.hidden_at IS NOT NULL,
                                               'created_at', c.created_at) ORDER BY c.created_at)
           FROM public.workout_comments c WHERE c.workout_id = w.id AND c.user_id = v_user
         ), '[]'::jsonb)
  FROM public.workouts w
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  LEFT JOIN public.workout_photos ph ON ph.workout_id = w.id
  WHERE w.user_id = v_user AND w.finished_at IS NOT NULL
  ORDER BY w.finished_at DESC
  LIMIT 100;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_photo(p_workout uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT private.remove_photo(p_workout, coalesce(nullif(btrim(p_reason), ''), 'admin'), auth.uid()) THEN
    RAISE EXCEPTION 'That workout has no photo.' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_comment_hidden(p_comment uuid, p_hidden boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.workout_comments
  SET hidden_at = CASE WHEN p_hidden THEN coalesce(hidden_at, now()) END
  WHERE id = p_comment;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such comment.' USING ERRCODE = 'P0002';
  END IF;
  RETURN p_hidden;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_list_takedowns(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_takedown(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_user_content(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_photo(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_comment_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_takedowns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_takedown(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_content(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_photo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_comment_hidden(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 9: the weekly sweep. Sundays 03:23 PT (11:23 UTC), asks the
-- sweep-photos function to delete files that no photo row, evidence row
-- or recent upload points at. Uses the moderation hook secret, so it does
-- nothing until that secret exists. Run after sweep-photos is deployed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.post_job(p_function text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF p_function !~ '^[a-z][a-z0-9-]{1,40}$' THEN
    RAISE EXCEPTION 'Bad function name %.', p_function;
  END IF;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'moderation_hook_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://mnsigwjyskxfuszeegtp.supabase.co/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-moderation-secret', v_secret
    ),
    body := '{}'::jsonb
  );
END
$function$;

REVOKE ALL ON FUNCTION private.post_job(text) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('sweep-workout-photos', '23 11 * * 0', $$SELECT private.post_job('sweep-photos')$$);

-- ---------------------------------------------------------------------------
-- Section 10: checks. Expect the bucket (private, image/jpeg, 3145728),
-- three storage policies, the tables, the trigger list, the cron job, and
-- social_feed returning photo_path.
-- ---------------------------------------------------------------------------
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'workout-photos';

SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'workout photos%'
ORDER BY policyname;

SELECT to_regclass('public.workout_photos') AS photos, to_regclass('public.takedown_requests') AS takedowns,
       to_regclass('private.blocked_image_hashes') AS hashes, to_regclass('private.photo_evidence') AS evidence;

SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal AND tgname IN (
  'workout_photos_keep_evidence', 'workout_photos_queue_moderation', 'takedown_requests_notify_admin'
)
ORDER BY tgname;

SELECT jobname, schedule FROM cron.job WHERE jobname = 'sweep-workout-photos';

SELECT pg_get_function_result('public.social_feed(timestamp with time zone, uuid, integer, uuid)'::regprocedure) LIKE '%photo_path%' AS feed_has_photos;
