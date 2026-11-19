-- Social safety: text filtering, hidden workouts, report emails, the
-- moderation hook and the admin report queue (branch social-safety).
-- Spec: docs/social-v1-spec.md. Run in SUPABASE (SQL editor) one section
-- at a time, top to bottom. Read Section 0's output before Section 1.
--
-- Built 19 Nov 2026 against the live database. Function bodies changed
-- here (social_feed, social_workout, social_profile, workout_visible,
-- admin_resolve_report) are the live ones read that day with only the
-- marked changes. social_feed and social_workout keep the warm-up filter
-- from docs/pro-warmup-social-counts.sql.
--
-- What this adds:
--   1. private.moderation_terms, a blocklist, and private.text_blocked().
--      Seeded from the LDNOOBW English list (CC BY 4.0,
--      github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
--      minus fitness false positives (butt, snatch, hardcore, suck...).
--   2. public.text_allowed(), so the app can check a username or note
--      before saving it.
--   3. A username trigger that refuses blocklisted usernames (23514).
--   4. workouts.hidden_at, moderation_flagged_at, moderated_at, which only
--      the server can write, and user_profiles.community_rules_accepted_at.
--   5. Friends never see a hidden workout. A blocklisted or flagged
--      workout shows as "Workout" with no note.
--   6. reports.detail and the 'auto_flag' reason, for reports the
--      moderation function files.
--   7. An email to hello@liftcamp.app for every new report.
--   8. A trigger that sends finished workouts' names and notes, and new
--      usernames, to the moderate-text Edge Function. Only for users with
--      social on. It does nothing until Section 9 creates the secret.
--   9. admin_list_reports with workout name, note and moderation state,
--      and admin_resolve_report with hide_workout and reset_username.
--      admin_set_workout_hidden for undoing a hide.

-- ---------------------------------------------------------------------------
-- Section 0: diagnostic. Expect:
--   - columns: none of hidden_at, moderation_flagged_at, moderated_at,
--     community_rules_accepted_at, detail (0 rows)
--   - reports_reason_check without 'auto_flag'
--   - private.moderation_terms missing (to_regclass is null)
--   - vault secret moderation_hook_secret missing (0 rows)
--   - pg_net and supabase_vault installed
-- ---------------------------------------------------------------------------
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('workouts', 'hidden_at'), ('workouts', 'moderation_flagged_at'),
    ('workouts', 'moderated_at'), ('user_profiles', 'community_rules_accepted_at'),
    ('reports', 'detail')
  );

SELECT pg_get_constraintdef(oid) AS reason_check
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass AND conname = 'reports_reason_check';

SELECT to_regclass('private.moderation_terms') AS terms_table;

SELECT name FROM vault.secrets WHERE name IN ('moderation_hook_secret', 'resend_api_key');

SELECT extname FROM pg_extension WHERE extname IN ('pg_net', 'supabase_vault');

-- ---------------------------------------------------------------------------
-- Section 1: the blocklist.
-- Terms are stored normalised: lowercase letters and single spaces.
-- 'word' terms match whole words. 'any' terms match inside a word too, so
-- "fuckyou" as a username is caught; keep 'any' to terms that never sit
-- inside an ordinary word.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.moderation_terms (
  term       text PRIMARY KEY CHECK (term ~ '^[a-z]+( [a-z]+)*$'),
  match      text NOT NULL DEFAULT 'word' CHECK (match IN ('word', 'any')),
  source     text NOT NULL DEFAULT 'ldnoobw',
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.moderation_terms FROM PUBLIC, anon, authenticated;

INSERT INTO private.moderation_terms (term, match) VALUES
  ('acrotomophilia', 'word'), ('alabama hot pocket', 'word'), ('alaskan pipeline', 'word'), ('anal', 'word'), ('anilingus', 'word'), ('anus', 'word'),
  ('apeshit', 'word'), ('arsehole', 'word'), ('asshole', 'word'), ('assmunch', 'word'), ('auto erotic', 'word'), ('autoerotic', 'word'),
  ('babeland', 'word'), ('baby batter', 'word'), ('baby juice', 'word'), ('ball gag', 'word'), ('ball gravy', 'word'), ('ball kicking', 'word'),
  ('ball licking', 'word'), ('ball sack', 'word'), ('ball sucking', 'word'), ('bangbros', 'word'), ('bangbus', 'word'), ('bareback', 'word'),
  ('barely legal', 'word'), ('barenaked', 'word'), ('bastard', 'word'), ('bastardo', 'word'), ('bastinado', 'word'), ('bbw', 'word'),
  ('bdsm', 'word'), ('beaner', 'word'), ('beaners', 'word'), ('beastiality', 'word'), ('beaver cleaver', 'word'), ('beaver lips', 'word'),
  ('bestiality', 'word'), ('big breasts', 'word'), ('big knockers', 'word'), ('big tits', 'word'), ('bimbos', 'word'), ('birdlock', 'word'),
  ('bitch', 'word'), ('bitches', 'word'), ('black cock', 'word'), ('blonde action', 'word'), ('blonde on blonde action', 'word'), ('blow job', 'word'),
  ('blow your load', 'word'), ('blowjob', 'word'), ('blue waffle', 'word'), ('blumpkin', 'word'), ('bollocks', 'word'), ('bondage', 'word'),
  ('boner', 'word'), ('boob', 'word'), ('boobs', 'word'), ('booty call', 'word'), ('brown showers', 'word'), ('brunette action', 'word'),
  ('bukkake', 'word'), ('bulldyke', 'word'), ('bullet vibe', 'word'), ('bullshit', 'word'), ('bung hole', 'word'), ('bunghole', 'word'),
  ('busty', 'word'), ('buttcheeks', 'word'), ('butthole', 'word'), ('camel toe', 'word'), ('camgirl', 'word'), ('camslut', 'word'),
  ('camwhore', 'word'), ('carpet muncher', 'word'), ('carpetmuncher', 'word'), ('chocolate rosebuds', 'word'), ('cialis', 'word'), ('circlejerk', 'word'),
  ('cleveland steamer', 'word'), ('clit', 'word'), ('clitoris', 'word'), ('clover clamps', 'word'), ('clusterfuck', 'word'), ('cock', 'word'),
  ('cocks', 'word'), ('coon', 'word'), ('coons', 'word'), ('coprolagnia', 'word'), ('coprophilia', 'word'), ('cornhole', 'word'),
  ('creampie', 'word'), ('cum', 'word'), ('cumming', 'word'), ('cumshot', 'word'), ('cumshots', 'word'), ('cunnilingus', 'word'),
  ('cunt', 'any'), ('darkie', 'word'), ('date rape', 'word'), ('daterape', 'word'), ('deep throat', 'word'), ('deepthroat', 'word'),
  ('dendrophilia', 'word'), ('dick', 'word'), ('dildo', 'word'), ('dingleberries', 'word'), ('dingleberry', 'word'), ('dirty pillows', 'word'),
  ('dirty sanchez', 'word'), ('dog style', 'word'), ('doggie style', 'word'), ('doggiestyle', 'word'), ('doggy style', 'word'), ('doggystyle', 'word'),
  ('dolcett', 'word'), ('dominatrix', 'word'), ('dommes', 'word'), ('donkey punch', 'word'), ('double dong', 'word'), ('double penetration', 'word'),
  ('dp action', 'word'), ('dry hump', 'word'), ('dvda', 'word'), ('eat my ass', 'word'), ('ecchi', 'word'), ('ejaculation', 'word'),
  ('erotic', 'word'), ('erotism', 'word'), ('fag', 'word'), ('faggot', 'any'), ('fecal', 'word'), ('felch', 'word'),
  ('fellatio', 'word'), ('feltch', 'word'), ('female squirting', 'word'), ('femdom', 'word'), ('figging', 'word'), ('fingerbang', 'word'),
  ('fingering', 'word'), ('fisting', 'word'), ('foot fetish', 'word'), ('footjob', 'word'), ('frotting', 'word'), ('fuck', 'any'),
  ('fuck buttons', 'word'), ('fuckin', 'word'), ('fucking', 'word'), ('fucktards', 'word'), ('fudge packer', 'word'), ('fudgepacker', 'word'),
  ('futanari', 'word'), ('g spot', 'word'), ('gang bang', 'word'), ('gangbang', 'word'), ('gay sex', 'word'), ('genitals', 'word'),
  ('giant cock', 'word'), ('girl on top', 'word'), ('girls gone wild', 'word'), ('girls i cup', 'word'), ('goatcx', 'word'), ('goatse', 'word'),
  ('gokkun', 'word'), ('golden shower', 'word'), ('goo girl', 'word'), ('goodpoop', 'word'), ('goregasm', 'word'), ('grope', 'word'),
  ('group sex', 'word'), ('guro', 'word'), ('hand job', 'word'), ('handjob', 'word'), ('hentai', 'word'), ('homoerotic', 'word'),
  ('honkey', 'word'), ('hooker', 'word'), ('horny', 'word'), ('hot carl', 'word'), ('hot chick', 'word'), ('humping', 'word'),
  ('incest', 'word'), ('intercourse', 'word'), ('jack off', 'word'), ('jail bait', 'word'), ('jailbait', 'word'), ('jerk off', 'word'),
  ('jigaboo', 'any'), ('jiggaboo', 'any'), ('jiggerboo', 'any'), ('jizz', 'word'), ('juggs', 'word'), ('kike', 'word'),
  ('kinbaku', 'word'), ('kinkster', 'word'), ('kinky', 'word'), ('knobbing', 'word'), ('leather restraint', 'word'), ('leather straight jacket', 'word'),
  ('lemon party', 'word'), ('livesex', 'word'), ('lolita', 'word'), ('lovemaking', 'word'), ('make me come', 'word'), ('male squirting', 'word'),
  ('masturbate', 'word'), ('masturbating', 'word'), ('masturbation', 'word'), ('menage a trois', 'word'), ('milf', 'word'), ('missionary position', 'word'),
  ('mong', 'word'), ('motherfucker', 'word'), ('mound of venus', 'word'), ('mr hands', 'word'), ('muff diver', 'word'), ('muffdiving', 'word'),
  ('nambla', 'word'), ('nawashi', 'word'), ('negro', 'word'), ('neonazi', 'word'), ('nig nog', 'word'), ('nigga', 'any'),
  ('nigger', 'any'), ('nimphomania', 'word'), ('nipple', 'word'), ('nipples', 'word'), ('nsfw', 'word'), ('nsfw images', 'word'),
  ('nude', 'word'), ('nudity', 'word'), ('nutten', 'word'), ('nympho', 'word'), ('nymphomania', 'word'), ('octopussy', 'word'),
  ('omorashi', 'word'), ('one cup two girls', 'word'), ('one guy one jar', 'word'), ('orgasm', 'word'), ('orgy', 'word'), ('paedophile', 'any'),
  ('paki', 'word'), ('panties', 'word'), ('panty', 'word'), ('pedobear', 'word'), ('pedophile', 'any'), ('pegging', 'word'),
  ('penis', 'word'), ('phone sex', 'word'), ('piece of shit', 'word'), ('pikey', 'word'), ('piss pig', 'word'), ('pissing', 'word'),
  ('pisspig', 'word'), ('playboy', 'word'), ('pleasure chest', 'word'), ('pole smoker', 'word'), ('ponyplay', 'word'), ('poof', 'word'),
  ('poon', 'word'), ('poontang', 'word'), ('poop chute', 'word'), ('poopchute', 'word'), ('porn', 'any'), ('porno', 'word'),
  ('pornography', 'word'), ('prince albert piercing', 'word'), ('pthc', 'word'), ('pubes', 'word'), ('punany', 'word'), ('pussy', 'word'),
  ('queaf', 'word'), ('queef', 'word'), ('quim', 'word'), ('raghead', 'any'), ('raging boner', 'word'), ('rape', 'word'),
  ('raping', 'word'), ('rapist', 'word'), ('rectum', 'word'), ('reverse cowgirl', 'word'), ('rimjob', 'word'), ('rimming', 'word'),
  ('rosy palm', 'word'), ('rosy palm and her s sisters', 'word'), ('rusty trombone', 'word'), ('sadism', 'word'), ('santorum', 'word'), ('scat', 'word'),
  ('schlong', 'word'), ('scissoring', 'word'), ('semen', 'word'), ('sex', 'word'), ('sexcam', 'word'), ('sexo', 'word'),
  ('sexual', 'word'), ('sexuality', 'word'), ('sexually', 'word'), ('sexy', 'word'), ('shaved beaver', 'word'), ('shaved pussy', 'word'),
  ('shemale', 'any'), ('shibari', 'word'), ('shit', 'word'), ('shitblimp', 'word'), ('shitty', 'word'), ('shota', 'word'),
  ('shrimping', 'word'), ('skeet', 'word'), ('slanteye', 'word'), ('slut', 'any'), ('smut', 'word'), ('sodomize', 'word'),
  ('sodomy', 'word'), ('spastic', 'word'), ('spic', 'word'), ('splooge', 'word'), ('splooge moose', 'word'), ('spooge', 'word'),
  ('spunk', 'word'), ('strapon', 'word'), ('strappado', 'word'), ('strip club', 'word'), ('style doggy', 'word'), ('suicide girls', 'word'),
  ('sultry women', 'word'), ('swastika', 'word'), ('tea bagging', 'word'), ('threesome', 'word'), ('throating', 'word'), ('thumbzilla', 'word'),
  ('tit', 'word'), ('tits', 'word'), ('titties', 'word'), ('titty', 'word'), ('topless', 'word'), ('tosser', 'word'),
  ('towelhead', 'any'), ('tranny', 'any'), ('tribadism', 'word'), ('tub girl', 'word'), ('tubgirl', 'word'), ('tushy', 'word'),
  ('twat', 'word'), ('twink', 'word'), ('two girls one cup', 'word'), ('undressing', 'word'), ('upskirt', 'word'), ('urethra play', 'word'),
  ('urophilia', 'word'), ('vagina', 'word'), ('venus mound', 'word'), ('viagra', 'word'), ('vibrator', 'word'), ('violet wand', 'word'),
  ('vorarephilia', 'word'), ('voyeur', 'word'), ('voyeurweb', 'word'), ('voyuer', 'word'), ('vulva', 'word'), ('wank', 'word'),
  ('wet dream', 'word'), ('wetback', 'any'), ('white power', 'word'), ('whore', 'any'), ('worldsex', 'word'), ('wrapping men', 'word'),
  ('wrinkled starfish', 'word'), ('xxx', 'word'), ('yaoi', 'word'), ('yellow showers', 'word'), ('yiffy', 'word'), ('zoophilia', 'word')
ON CONFLICT (term) DO UPDATE SET match = excluded.match;

-- Lowercase, @ to a, $ to s, underscores and every other non-letter to a
-- space. Digits are not read as letters: "455" must not become "ass".
CREATE OR REPLACE FUNCTION private.mod_normalize(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT btrim(regexp_replace(translate(lower(coalesce(p, '')), '@$', 'as'), '[^a-z]+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION private.text_blocked(p text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v text := private.mod_normalize(p);
BEGIN
  IF v = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM private.moderation_terms t
    WHERE (t.match = 'word' AND v ~ ('\m' || t.term || '\M'))
       OR (t.match = 'any' AND strpos(v, t.term) > 0)
  );
END
$function$;

REVOKE ALL ON FUNCTION private.mod_normalize(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.text_blocked(text) FROM PUBLIC, anon, authenticated;

-- The app's pre-save check. Any signed-in user, guests included, since a
-- guest can write a note. Capped at 1,000 characters.
CREATE OR REPLACE FUNCTION public.text_allowed(p_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to use this.' USING ERRCODE = '42501';
  END IF;
  RETURN NOT private.text_blocked(left(coalesce(p_text, ''), 1000));
END
$function$;

REVOKE ALL ON FUNCTION public.text_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.text_allowed(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 2: usernames. A blocklisted username is refused on insert or
-- change with SQLSTATE 23514 and the message below. Existing usernames are
-- not touched; Section 10 lists any that would now be refused.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.guard_username()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.username IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
     AND private.text_blocked(NEW.username) THEN
    RAISE EXCEPTION 'That username isn''t allowed. Pick another.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION private.guard_username() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER user_profiles_guard_username
  BEFORE INSERT OR UPDATE OF username ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_username();

-- ---------------------------------------------------------------------------
-- Section 3: moderation columns.
-- workouts.hidden_at: set by an admin; friends never see the workout.
-- workouts.moderation_flagged_at: set by the moderate-text function when
--   the name or note is flagged; friends see "Workout" and no note.
-- workouts.moderated_at: when the function last checked the row.
-- The app writes workouts directly under owner RLS, so a trigger keeps
-- these three columns out of its reach: for the authenticated and anon
-- roles, an insert starts them null and an update keeps the old values.
-- SECURITY DEFINER functions (current_user postgres) and the Edge Function
-- (service_role) can still write them.
-- user_profiles.community_rules_accepted_at: written by the app when the
--   user agrees to the community rules. Owner RLS already allows it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS moderation_flagged_at timestamptz;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS community_rules_accepted_at timestamptz;

-- Not SECURITY DEFINER: it reads current_user, the caller's role.
CREATE OR REPLACE FUNCTION private.guard_workout_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.hidden_at := NULL;
      NEW.moderation_flagged_at := NULL;
      NEW.moderated_at := NULL;
    ELSE
      NEW.hidden_at := OLD.hidden_at;
      NEW.moderation_flagged_at := OLD.moderation_flagged_at;
      NEW.moderated_at := OLD.moderated_at;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION private.guard_workout_moderation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER workouts_guard_moderation
  BEFORE INSERT OR UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION private.guard_workout_moderation();

-- What a friend sees. A flagged or blocklisted name shows as "Workout".
-- A note shows only for app-made workouts with no flag and no blocklisted
-- word (the platform rule is the live one from social_feed).
CREATE OR REPLACE FUNCTION private.shown_name(p_name text, p_flagged timestamptz)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_name IS NULL THEN NULL
    WHEN p_flagged IS NOT NULL OR private.text_blocked(p_name) THEN 'Workout'
    ELSE p_name
  END;
$function$;

CREATE OR REPLACE FUNCTION private.shown_note(p_note text, p_platform text, p_flagged timestamptz)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_platform IN ('ios', 'android')
         AND p_flagged IS NULL
         AND NOT private.text_blocked(p_note)
    THEN nullif(btrim(p_note), '')
  END;
$function$;

REVOKE ALL ON FUNCTION private.shown_name(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.shown_note(text, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Section 4: reads honour hidden_at and the masks.
-- Changes from the live bodies are marked "-- safety".
-- workout_visible gates social_workout and toggle_kudos, so a hidden
-- workout can't be opened or given kudos either.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.workout_visible(p_viewer uuid, p_workout uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = p_workout
      AND w.finished_at IS NOT NULL
      AND w.hidden_at IS NULL -- safety
      AND private.can_view(p_viewer, w.user_id)
      AND EXISTS (
        SELECT 1 FROM public.sets s
        JOIN public.workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = w.id AND s.completed
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_user uuid DEFAULT NULL::uuid)
 RETURNS TABLE(workout_id uuid, user_id uuid, username text, name text, note text, workout_date date, created_at timestamp with time zone, finished_at timestamp with time zone, completed_sets integer, volume numeric, volume_unit text, pr_count integer, exercises jsonb, kudos_count integer, kudos_given boolean)
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
         private.shown_name(w.name, w.moderation_flagged_at), -- safety
         private.shown_note(w.notes, w.platform, w.moderation_flagged_at), -- safety
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
         EXISTS (SELECT 1 FROM public.kudos k WHERE k.workout_id = w.id AND k.user_id = v_me)
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
    AND w.hidden_at IS NULL -- safety
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
    'name', private.shown_name(w.name, w.moderation_flagged_at), -- safety
    'note', private.shown_note(w.notes, w.platform, w.moderation_flagged_at), -- safety
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

CREATE OR REPLACE FUNCTION public.social_profile(p_user uuid)
 RETURNS TABLE(user_id uuid, username text, i_follow text, follows_me text, can_view boolean, latest_workout_id uuid, latest_name text, latest_finished_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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
  SELECT p_user, p.username, v_i_follow, v_follows, v_view, l.id,
         private.shown_name(l.name, l.moderation_flagged_at), -- safety
         l.finished_at
  FROM (SELECT 1) one
  LEFT JOIN public.user_profiles p ON p.user_id = p_user
  LEFT JOIN LATERAL (
    SELECT w.id, w.name, w.moderation_flagged_at, w.finished_at -- safety: flag column
    FROM public.workouts w
    WHERE v_view
      AND w.user_id = p_user
      AND w.finished_at IS NOT NULL
      AND w.hidden_at IS NULL -- safety
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

-- ---------------------------------------------------------------------------
-- Section 5: reports carry automatic flags.
-- 'auto_flag' is filed only by the moderate-text function (reporter null).
-- file_report still accepts only the four user reasons, so the app can't
-- send it. detail holds what the function saw (field, categories).
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS detail jsonb;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check
  CHECK (reason = ANY (ARRAY['inappropriate'::text, 'harassment'::text, 'spam'::text, 'other'::text, 'auto_flag'::text]));

-- ---------------------------------------------------------------------------
-- Section 6: email on every new report, the same way
-- notify_admin_new_user does it (Resend through pg_net, key in Vault).
-- A failed email never blocks the report.
-- ---------------------------------------------------------------------------
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

  v_subject := CASE
    WHEN NEW.reason = 'auto_flag' THEN format('LiftCamp: auto-flagged @%s', coalesce(v_target, 'unknown'))
    ELSE format('LiftCamp: report (%s) on @%s', NEW.reason, coalesce(v_target, 'unknown'))
  END;
  v_body := format(
    E'Reason: %s\nReported: @%s\nBy: %s\nWorkout: %s\nNote: %s\nDetail: %s\nFiled: %s\n\nReview within 24 hours: https://liftcamp.app/admin',
    NEW.reason,
    coalesce(v_target, 'unknown'),
    CASE WHEN NEW.reporter_id IS NULL THEN 'moderation check' ELSE '@' || coalesce(v_reporter, 'unknown') END,
    coalesce(v_name, '(none)'),
    coalesce(left(v_note, 500), '(none)'),
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

REVOKE ALL ON FUNCTION private.notify_admin_report() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER reports_notify_admin
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION private.notify_admin_report();

-- ---------------------------------------------------------------------------
-- Section 7: the moderation hook. Sends the row's table and id (never the
-- text) to the moderate-text Edge Function, which reads the row itself
-- with the service role. Fires only for users with social on, only for
-- finished app-made workouts with a name or note, and only when the name,
-- note or finish changed. Does nothing until the moderation_hook_secret
-- exists (Section 9). A failed call never blocks the write.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.post_moderation(p_table text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'moderation_hook_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://mnsigwjyskxfuszeegtp.supabase.co/functions/v1/moderate-text',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-moderation-secret', v_secret
    ),
    body := jsonb_build_object('table', p_table, 'id', p_id)
  );
END
$function$;

CREATE OR REPLACE FUNCTION private.queue_workout_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.finished_at IS NULL
     OR coalesce(NEW.platform, '') NOT IN ('ios', 'android')
     OR (coalesce(btrim(NEW.name), '') = '' AND coalesce(btrim(NEW.notes), '') = '') THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.finished_at IS NOT NULL
     AND NEW.name IS NOT DISTINCT FROM OLD.name
     AND NEW.notes IS NOT DISTINCT FROM OLD.notes THEN
    RETURN NULL;
  END IF;
  IF NOT private.social_on(NEW.user_id) THEN
    RETURN NULL;
  END IF;
  PERFORM private.post_moderation('workouts', NEW.id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION private.queue_username_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.username IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username) THEN
    RETURN NULL;
  END IF;
  IF NOT private.social_on(NEW.user_id) THEN
    RETURN NULL;
  END IF;
  PERFORM private.post_moderation('user_profiles', NEW.user_id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION private.post_moderation(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_workout_moderation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_username_moderation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER workouts_queue_moderation
  AFTER INSERT OR UPDATE OF name, notes, finished_at ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION private.queue_workout_moderation();

CREATE OR REPLACE TRIGGER user_profiles_queue_moderation
  AFTER INSERT OR UPDATE OF username ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION private.queue_username_moderation();

-- ---------------------------------------------------------------------------
-- Section 8: the admin queue.
-- admin_list_reports gains the workout's raw name and note (admins see the
-- unmasked text), its hidden and flagged state, and detail. The return
-- type changes, so it is dropped and recreated with the same grants.
-- admin_resolve_report gains:
--   hide_workout    sets hidden_at on the reported workout
--   reset_username  gives the reported user a lifterNNNNN username
--   dismiss         on an auto_flag report, also clears the workout's flag
--                   (a false positive), so friends see the name again
-- admin_set_workout_hidden undoes or redoes a hide outside a report.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_reports(text);

CREATE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open'::text)
 RETURNS TABLE(id uuid, reporter_id uuid, reporter_email text, reporter_username text, target_user_id uuid, target_email text, target_username text, target_workout_id uuid, workout_name text, workout_note text, workout_hidden boolean, workout_flagged boolean, reason text, detail jsonb, status text, created_at timestamp with time zone, resolved_at timestamp with time zone)
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
         r.reason, r.detail, r.status, r.created_at, r.resolved_at
  FROM public.reports r
  LEFT JOIN auth.users ru ON ru.id = r.reporter_id
  LEFT JOIN public.user_profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN auth.users tu ON tu.id = r.target_user_id
  LEFT JOIN public.user_profiles tp ON tp.user_id = r.target_user_id
  LEFT JOIN public.workouts w ON w.id = r.target_workout_id
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
  IF p_action NOT IN ('dismiss', 'remove_follow', 'disable_social', 'hide_workout', 'reset_username') THEN -- safety: two new actions
    RAISE EXCEPTION 'Action must be dismiss, remove_follow, disable_social, hide_workout or reset_username.' USING ERRCODE = '22023';
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
  -- safety: from here to the next END IF
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

CREATE OR REPLACE FUNCTION public.admin_set_workout_hidden(p_workout uuid, p_hidden boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.workouts
  SET hidden_at = CASE WHEN p_hidden THEN coalesce(hidden_at, now()) END
  WHERE id = p_workout;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such workout.' USING ERRCODE = 'P0002';
  END IF;
  RETURN p_hidden;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_set_workout_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_workout_hidden(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Section 9: the hook secret. Run AFTER the moderate-text function is
-- deployed (see the spec's ship steps), or every finished workout of a
-- social user posts to a function that isn't there yet (harmless, but
-- noisy in the logs).
-- Creates a random secret once, then shows it. Copy the value into
--   supabase secrets set MODERATION_HOOK_SECRET=<value>
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'moderation_hook_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'moderation_hook_secret',
      'Shared secret between the moderation triggers and the moderate-text Edge Function'
    );
  END IF;
END
$$;

SELECT decrypted_secret AS moderation_hook_secret
FROM vault.decrypted_secrets WHERE name = 'moderation_hook_secret';

-- ---------------------------------------------------------------------------
-- Section 10: checks.
-- Expect: term count 372 (18 any); every check true; no existing usernames
-- refused (an empty list); 0 hidden or flagged workouts.
-- ---------------------------------------------------------------------------
SELECT count(*) AS terms, count(*) FILTER (WHERE match = 'any') AS any_terms
FROM private.moderation_terms;

SELECT
  private.text_blocked('Fuck this') AS profanity_blocked,
  private.text_blocked('fuck_you99') AS underscore_blocked,
  private.text_blocked('fuckyou99') AS joined_blocked,
  NOT private.text_blocked('Snatch and clean, 455 x 3') AS snatch_ok,
  NOT private.text_blocked('Glute day: hip thrust, butt kicks') AS glutes_ok,
  NOT private.text_blocked('Hardcore leg day, squats suck') AS slang_ok,
  NOT private.text_blocked('Saw my therapist then benched') AS therapist_ok;

SELECT user_id, username FROM public.user_profiles WHERE private.text_blocked(username);

SELECT count(*) FILTER (WHERE hidden_at IS NOT NULL) AS hidden,
       count(*) FILTER (WHERE moderation_flagged_at IS NOT NULL) AS flagged
FROM public.workouts;

SELECT p.proname, pg_get_functiondef(p.oid) LIKE '%hidden_at%' AS honours_hidden
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN ('social_feed', 'social_profile'))
   OR (n.nspname = 'private' AND p.proname = 'workout_visible')
ORDER BY p.proname;

SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal AND tgname IN (
  'user_profiles_guard_username', 'workouts_guard_moderation', 'reports_notify_admin',
  'workouts_queue_moderation', 'user_profiles_queue_moderation'
)
ORDER BY tgname;
