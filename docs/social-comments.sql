-- Social comments (branch social-comments). Spec: docs/social-v2-spec.md.
-- Run in SUPABASE (SQL editor) AFTER docs/social-safety.sql, one section
-- at a time. Read Section 0's output before Section 1.
--
-- Built 19 Nov 2026 against the live database plus docs/social-safety.sql.
-- Bodies of social_feed, social_workout, admin_list_reports and
-- admin_resolve_report are the social-safety.sql versions with only the
-- marked changes ("-- comments").
--
-- What this adds:
--   1. public.workout_comments. No client policies: every read and write
--      goes through the functions below.
--   2. add_comment, delete_comment, workout_comments, social_comment_inbox.
--      Comments are delete-only (no edit). The workout's owner can delete
--      any comment on it. Mutual follows and the owner can comment.
--      A blocklisted comment is refused (23514). 30 comments an hour.
--      Commenting and reading comments need a mutual follow with the owner.
--   3. comment_count on social_feed and social_workout.
--   4. Comment reports: reports.target_comment_id and file_comment_report.
--   5. The moderation hook for new comments (moderate-text, same secret).
--   6. Admin: comment body and state in the report queue, hide_comment,
--      and dismissing an auto_flag on a comment clears its flag.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Expect:
--   - social-safety ran: text_blocked, workout_visible and hidden_at present
--   - workout_comments missing (null)
--   - reports.target_comment_id missing (0 rows)
-- ---------------------------------------------------------------------------
SELECT to_regprocedure('private.text_blocked(text)') AS text_blocked,
       to_regprocedure('private.post_moderation(text,uuid)') AS post_moderation,
       to_regclass('public.workout_comments') AS comments_table;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'workouts' AND column_name = 'hidden_at')
    OR (table_name = 'reports' AND column_name = 'target_comment_id'));

-- ---------------------------------------------------------------------------
-- Section 1: the table.
-- hidden_at: an admin hid it. moderation_flagged_at: the moderation check
-- flagged it; only its author still sees it. Both are written only by
-- SECURITY DEFINER functions and the Edge Function (no client grants).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('private.text_blocked(text)') IS NULL THEN
    RAISE EXCEPTION 'Run docs/social-safety.sql first.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.workout_comments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id            uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body                  text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at            timestamptz NOT NULL DEFAULT now(),
  hidden_at             timestamptz,
  moderation_flagged_at timestamptz,
  moderated_at          timestamptz
);

CREATE INDEX IF NOT EXISTS workout_comments_workout_idx ON public.workout_comments (workout_id, created_at);
CREATE INDEX IF NOT EXISTS workout_comments_user_idx ON public.workout_comments (user_id, created_at);

ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workout_comments FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Section 2: who can see a workout's comments, and how many there are.
-- A workout's comments are open to its owner (finished, not hidden) and to
-- anyone workout_visible lets in who also follows each other with the owner
-- (mutual follow, decided 19 Nov 2026). A comment is shown when it isn't hidden, isn't
-- flagged (except to its author), its author still has social on, and
-- nobody involved has blocked anybody: not the viewer and the author, and
-- not the workout's owner and the author.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.workout_open_to(p_viewer uuid, p_workout uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p_viewer IS NOT NULL AND (
    (
      private.workout_visible(p_viewer, p_workout)
      AND private.mutual(p_viewer, (SELECT w.user_id FROM public.workouts w WHERE w.id = p_workout))
    )
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = p_workout
        AND w.user_id = p_viewer
        AND w.finished_at IS NOT NULL
        AND w.hidden_at IS NULL
    )
  );
$function$;

CREATE OR REPLACE FUNCTION private.comment_shown(p_viewer uuid, p_owner uuid, p_author uuid, p_hidden timestamptz, p_flagged timestamptz)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p_hidden IS NULL
    AND (p_flagged IS NULL OR p_author = p_viewer)
    AND (
      p_author = p_viewer
      OR (
        private.social_on(p_author)
        AND NOT private.blocked_between(p_viewer, p_author)
        AND NOT private.blocked_between(p_owner, p_author)
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.comment_count(p_viewer uuid, p_workout uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(*)::integer
  FROM public.workout_comments c
  JOIN public.workouts w ON w.id = c.workout_id
  WHERE c.workout_id = p_workout
    AND private.comment_shown(p_viewer, w.user_id, c.user_id, c.hidden_at, c.moderation_flagged_at);
$function$;

REVOKE ALL ON FUNCTION private.workout_open_to(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.comment_shown(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.comment_count(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Section 3: write and read comments.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_comment(p_workout uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me   uuid := private.require_member(true);
  v_body text := btrim(coalesce(p_body, ''));
  v_id   uuid;
BEGIN
  IF v_body = '' OR char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'Comments are 1 to 500 characters.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.workout_open_to(v_me, p_workout) THEN
    RAISE EXCEPTION 'You can''t comment on this workout.' USING ERRCODE = '42501';
  END IF;
  IF private.text_blocked(v_body) THEN
    RAISE EXCEPTION 'Keep it friendly. That comment has words we don''t allow.' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('add_comment:' || v_me::text, 0));
  IF (
    SELECT count(*) FROM public.workout_comments c
    WHERE c.user_id = v_me AND c.created_at > now() - interval '1 hour'
  ) >= 30 THEN
    RAISE EXCEPTION 'You''re commenting a lot. Try again in a bit.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.workout_comments (workout_id, user_id, body)
  VALUES (p_workout, v_me, v_body)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- The author or the workout's owner. Works with social revoked, so people
-- can always clean up their own words. Returns false when nothing matched.
CREATE OR REPLACE FUNCTION public.delete_comment(p_comment uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me uuid := private.require_member(false);
BEGIN
  DELETE FROM public.workout_comments c
  USING public.workouts w
  WHERE c.id = p_comment
    AND w.id = c.workout_id
    AND (c.user_id = v_me OR w.user_id = v_me);
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.workout_comments(p_workout uuid)
 RETURNS TABLE(id uuid, user_id uuid, username text, body text, created_at timestamp with time zone, mine boolean, can_delete boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me    uuid := private.require_member(true);
  v_owner uuid;
BEGIN
  IF NOT private.workout_open_to(v_me, p_workout) THEN
    RETURN;
  END IF;
  SELECT w.user_id INTO v_owner FROM public.workouts w WHERE w.id = p_workout;
  RETURN QUERY
  SELECT c.id, c.user_id, p.username, c.body, c.created_at,
         c.user_id = v_me,
         c.user_id = v_me OR v_owner = v_me
  FROM public.workout_comments c
  LEFT JOIN public.user_profiles p ON p.user_id = c.user_id
  WHERE c.workout_id = p_workout
    AND private.comment_shown(v_me, v_owner, c.user_id, c.hidden_at, c.moderation_flagged_at)
  ORDER BY c.created_at, c.id
  LIMIT 200;
END
$function$;

-- Comments other people left on your workouts, for the bell. 30 days,
-- newest first, the same window as social_kudos_inbox.
CREATE OR REPLACE FUNCTION public.social_comment_inbox(p_limit integer DEFAULT 100)
 RETURNS TABLE(comment_id uuid, workout_id uuid, workout_name text, user_id uuid, username text, body text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := private.require_member(true);
BEGIN
  RETURN QUERY
  SELECT c.id, c.workout_id, w.name, c.user_id, p.username, left(c.body, 140), c.created_at
  FROM public.workout_comments c
  JOIN public.workouts w ON w.id = c.workout_id
  LEFT JOIN public.user_profiles p ON p.user_id = c.user_id
  WHERE w.user_id = v_me
    AND c.user_id <> v_me
    AND c.created_at >= now() - interval '30 days'
    AND private.comment_shown(v_me, v_me, c.user_id, c.hidden_at, c.moderation_flagged_at)
  ORDER BY c.created_at DESC, c.id
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 200);
END
$function$;

REVOKE ALL ON FUNCTION public.add_comment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_comment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workout_comments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.social_comment_inbox(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workout_comments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_comment_inbox(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 4: comment_count on the feed and the read-only workout.
-- social_feed's return type gains a column, so it is dropped and recreated
-- with the same grants. Old builds ignore the extra field.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.social_feed(timestamp with time zone, uuid, integer, uuid);

CREATE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_user uuid DEFAULT NULL::uuid)
 RETURNS TABLE(workout_id uuid, user_id uuid, username text, name text, note text, workout_date date, created_at timestamp with time zone, finished_at timestamp with time zone, completed_sets integer, volume numeric, volume_unit text, pr_count integer, exercises jsonb, kudos_count integer, kudos_given boolean, can_interact boolean, comment_count integer)
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
         private.mutual(v_me, w.user_id),
         CASE WHEN private.mutual(v_me, w.user_id) THEN private.comment_count(v_me, w.id) ELSE 0 END -- comments
  FROM owners o
  JOIN public.workouts w ON w.user_id = o.uid
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
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
    'can_interact', private.mutual(v_me, w.user_id),
    'comment_count', CASE WHEN private.mutual(v_me, w.user_id) THEN private.comment_count(v_me, w.id) ELSE 0 END, -- comments
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', we.id,
        'position', we.position,
        'pr', CASE WHEN w.pr_exercise_ids IS NULL THEN NULL ELSE we.id = ANY (w.pr_exercise_ids) END,
        'exercise', jsonb_build_object(
          'id', e.id, 'name', e.name, 'weight_type', e.weight_type, 'is_unilateral', e.is_unilateral,
          'mechanic', e.mechanic, 'level', e.level, 'equipment', e.equipment,
          'primary_muscle', e.primary_muscle, 'secondary_muscles', e.secondary_muscles,
          'gif_url_sm', e.gif_url_sm, 'gif_url', e.gif_url, 'image_url', e.image_url,
          'is_custom', e.owner_id IS NOT NULL
        ),
        'sets', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weight', s.weight, 'weight_value', s.weight_value,
            'weight_unit', s.weight_unit, 'reps', s.reps, 'completed', s.completed,
            'set_type', s.set_type, 'duration_seconds', s.duration_seconds,
            'distance_meters', s.distance_meters, 'incline_percent', s.incline_percent
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
-- Section 5: reporting a comment. A separate function so file_report's
-- signature (used by shipped builds) never changes. Same reasons, the same
-- 10-a-day limit shared with file_report.
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_comment_id uuid
  REFERENCES public.workout_comments(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.file_comment_report(p_comment uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me      uuid := private.require_member(false);
  v_author  uuid;
  v_workout uuid;
  v_id      uuid;
BEGIN
  IF p_reason NOT IN ('inappropriate', 'harassment', 'spam', 'other') THEN
    RAISE EXCEPTION 'Pick a reason.' USING ERRCODE = '22023';
  END IF;
  SELECT c.user_id, c.workout_id INTO v_author, v_workout
  FROM public.workout_comments c WHERE c.id = p_comment;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'That comment is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_author = v_me THEN
    RAISE EXCEPTION 'Pick someone else to report.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.workout_open_to(v_me, v_workout) AND NOT private.blocked_between(v_me, v_author) THEN
    RAISE EXCEPTION 'You can only report comments you can see.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('file_report:' || v_me::text, 0));
  IF (
    SELECT count(*) FROM public.reports r
    WHERE r.reporter_id = v_me AND r.created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'Too many reports today. Try again tomorrow.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.reports (reporter_id, target_user_id, target_workout_id, target_comment_id, reason)
  VALUES (v_me, v_author, v_workout, p_comment, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.file_comment_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.file_comment_report(uuid, text) TO authenticated;

-- The report email shows the comment. Same as social-safety.sql's version
-- plus the comment line.
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
  END IF;
  IF NEW.target_comment_id IS NOT NULL THEN
    SELECT c.body INTO v_comment FROM public.workout_comments c WHERE c.id = NEW.target_comment_id;
  END IF;

  v_subject := CASE
    WHEN NEW.reason = 'auto_flag' THEN format('LiftCamp: auto-flagged @%s', coalesce(v_target, 'unknown'))
    ELSE format('LiftCamp: report (%s) on @%s', NEW.reason, coalesce(v_target, 'unknown'))
  END;
  v_body := format(
    E'Reason: %s\nReported: @%s\nBy: %s\nWorkout: %s\nNote: %s\nComment: %s\nDetail: %s\nFiled: %s\n\nReview within 24 hours: https://liftcamp.app/admin',
    NEW.reason,
    coalesce(v_target, 'unknown'),
    CASE WHEN NEW.reporter_id IS NULL THEN 'moderation check' ELSE '@' || coalesce(v_reporter, 'unknown') END,
    coalesce(v_name, '(none)'),
    coalesce(left(v_note, 500), '(none)'),
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
-- Section 6: the moderation hook for comments. Posts {table, id} to
-- moderate-text when someone with social on adds a comment.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.queue_comment_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.social_on(NEW.user_id) THEN
    RETURN NULL;
  END IF;
  PERFORM private.post_moderation('workout_comments', NEW.id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION private.queue_comment_moderation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER workout_comments_queue_moderation
  AFTER INSERT ON public.workout_comments
  FOR EACH ROW EXECUTE FUNCTION private.queue_comment_moderation();

-- ---------------------------------------------------------------------------
-- Section 7: admin. The queue gains comment_id, comment_body and
-- comment_hidden. New action hide_comment. Dismissing an auto_flag report
-- on a comment clears the comment's flag.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_reports(text);

CREATE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open'::text)
 RETURNS TABLE(id uuid, reporter_id uuid, reporter_email text, reporter_username text, target_user_id uuid, target_email text, target_username text, target_workout_id uuid, workout_name text, workout_note text, workout_hidden boolean, workout_flagged boolean, comment_id uuid, comment_body text, comment_hidden boolean, reason text, detail jsonb, status text, created_at timestamp with time zone, resolved_at timestamp with time zone)
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
         r.target_comment_id, c.body, c.hidden_at IS NOT NULL, -- comments
         r.reason, r.detail, r.status, r.created_at, r.resolved_at
  FROM public.reports r
  LEFT JOIN auth.users ru ON ru.id = r.reporter_id
  LEFT JOIN public.user_profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN auth.users tu ON tu.id = r.target_user_id
  LEFT JOIN public.user_profiles tp ON tp.user_id = r.target_user_id
  LEFT JOIN public.workouts w ON w.id = r.target_workout_id
  LEFT JOIN public.workout_comments c ON c.id = r.target_comment_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated;

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
  IF p_action NOT IN ('dismiss', 'remove_follow', 'disable_social', 'hide_workout', 'reset_username', 'hide_comment') THEN
    RAISE EXCEPTION 'Action must be dismiss, remove_follow, disable_social, hide_workout, reset_username or hide_comment.' USING ERRCODE = '22023';
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
  -- comments: from here to the dismiss branch
  ELSIF p_action = 'hide_comment' THEN
    IF v_report.target_comment_id IS NULL THEN
      RAISE EXCEPTION 'This report has no comment to hide.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.workout_comments SET hidden_at = coalesce(hidden_at, now())
    WHERE id = v_report.target_comment_id;
  ELSIF p_action = 'dismiss' AND v_report.reason = 'auto_flag' AND v_report.target_comment_id IS NOT NULL THEN
    UPDATE public.workout_comments SET moderation_flagged_at = NULL
    WHERE id = v_report.target_comment_id;
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

-- ---------------------------------------------------------------------------
-- Section 8: checks. Expect the comments table, all five functions, the
-- trigger, and social_feed returning comment_count.
-- ---------------------------------------------------------------------------
SELECT to_regclass('public.workout_comments') AS comments_table;

SELECT p.proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('add_comment', 'delete_comment', 'workout_comments', 'social_comment_inbox', 'file_comment_report')
ORDER BY p.proname;

SELECT tgname FROM pg_trigger WHERE tgname = 'workout_comments_queue_moderation';

SELECT pg_get_function_result('public.social_feed(timestamp with time zone, uuid, integer, uuid)'::regprocedure) LIKE '%comment_count%' AS feed_has_comments;
