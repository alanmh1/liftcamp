-- Guest merge: move a guest's rows into the existing account it signed into.
-- See docs/guest-merge-spec.md.
--
-- SUPABASE (SQL editor). Run Section 0 on its own first and read the output.
-- Sections 1 to 3 are idempotent: running them twice changes nothing.
--
-- Called only by the merge-guest Edge Function, with the service role.
-- anon and authenticated cannot execute either function.


-- ===========================================================================
-- Section 0. Diagnostics (read only)
-- ===========================================================================

-- 0a. Every public table with a key to auth.users. The merge handles these
-- eleven, and refuses to delete the guest while any of them still holds a
-- guest row. A twelfth table here means the function needs a rule for it
-- before it is run.
--   app_events, exercise_rest_prefs, page_views, pr_goals, sets,
--   template_exercises, templates, user_profiles, user_roles,
--   workout_exercises, workouts
SELECT c.conrelid::regclass AS tbl, a.attname AS col, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.connamespace = 'public'::regnamespace
ORDER BY 1;

-- 0b. user_profiles columns. The fill list in Section 2 names every
-- nullable one; a new column here needs a line there.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 0c. Nothing to replace yet. Expect no rows. If a row comes back, read the
-- body before running Section 2.
SELECT n.nspname, p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('merge_guest_account', 'guest_merge_record');

SELECT to_regclass('private.guest_merges') AS ledger;  -- expect null

-- 0d. The private schema exists (purge_empty_guests lives there).
SELECT nspname FROM pg_namespace WHERE nspname = 'private';

-- 0e. Guests today, and what they hold.
SELECT
  (SELECT count(*) FROM auth.users WHERE is_anonymous) AS guests,
  (SELECT count(*) FROM public.workouts w JOIN auth.users u ON u.id = w.user_id WHERE u.is_anonymous) AS guest_workouts,
  (SELECT count(*) FROM public.templates t JOIN auth.users u ON u.id = t.user_id WHERE u.is_anonymous) AS guest_templates,
  (SELECT count(*) FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE u.is_anonymous) AS guest_roles;  -- expect 0


-- ===========================================================================
-- Section 1. The ledger
-- ===========================================================================
-- One row per merge, written in the same transaction as the move. It is
-- what makes a retry safe: a second call for the same pair returns the
-- first call's result, and a call for the same guest into a different
-- account is refused. Goes when the target account is deleted.

CREATE TABLE IF NOT EXISTS private.guest_merges (
  guest_id  uuid PRIMARY KEY,
  target_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  merged_at timestamptz NOT NULL DEFAULT now(),
  moved     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS guest_merges_target_idx ON private.guest_merges (target_id);

REVOKE ALL ON private.guest_merges FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- Section 2. merge_guest_account
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.merge_guest_account(p_guest uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_prior     private.guest_merges%ROWTYPE;
  v_guest_anon  boolean;
  v_guest_created timestamptz;
  v_target_anon boolean;
  v_gp        public.user_profiles%ROWTYPE;
  v_tp        public.user_profiles%ROWTYPE;
  v_has_gp    boolean;
  v_has_tp    boolean;
  v_profile   text := 'none';
  v_bw        numeric;
  r           record;
  v_name      text;
  v_k         integer;
  v_count     bigint;
  n_workouts  bigint := 0;
  n_in_prog   bigint := 0;
  n_target_in_prog bigint := 0;
  n_we        bigint := 0;
  n_sets      bigint := 0;
  n_templates bigint := 0;
  n_renamed   bigint := 0;
  n_dropped   bigint := 0;
  n_repointed bigint := 0;
  v_target_templates uuid[];
  v_match     uuid;
  n_te        bigint := 0;
  n_events    bigint := 0;
  n_views     bigint := 0;
  n_rest      bigint := 0;
  n_rest_drop bigint := 0;
  n_goals     bigint := 0;
  n_goals_drop bigint := 0;
  v_moved     jsonb;
BEGIN
  IF p_guest IS NULL OR p_target IS NULL OR p_guest = p_target THEN
    RAISE EXCEPTION 'merge_guest_account: guest and target must be two different users'
      USING ERRCODE = '22023';
  END IF;

  -- One merge per guest at a time. A second call waits here, then finds
  -- the ledger row the first one wrote.
  PERFORM pg_advisory_xact_lock(hashtextextended('merge_guest_account:' || p_guest::text, 0));

  SELECT * INTO v_prior FROM private.guest_merges WHERE guest_id = p_guest;
  IF FOUND THEN
    IF v_prior.target_id = p_target THEN
      RETURN jsonb_build_object('status', 'already_merged', 'merged_at', v_prior.merged_at, 'moved', v_prior.moved);
    END IF;
    RAISE EXCEPTION 'merge_guest_account: guest was merged into another account'
      USING ERRCODE = '42501';
  END IF;

  SELECT is_anonymous, created_at INTO v_guest_anon, v_guest_created FROM auth.users WHERE id = p_guest;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_guest_account: guest not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT coalesce(v_guest_anon, false) THEN
    RAISE EXCEPTION 'merge_guest_account: guest is not anonymous' USING ERRCODE = '42501';
  END IF;

  SELECT is_anonymous INTO v_target_anon FROM auth.users WHERE id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_guest_account: target not found' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(v_target_anon, false) THEN
    RAISE EXCEPTION 'merge_guest_account: target is anonymous' USING ERRCODE = '42501';
  END IF;

  -- Roles are never moved. A guest should have none; if one does, stop
  -- rather than cascade it away or hand it on.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_guest) THEN
    RAISE EXCEPTION 'merge_guest_account: guest has a role' USING ERRCODE = '42501';
  END IF;

  -- Workouts and what hangs off them. In-progress workouts move as they
  -- are: Home shows the newest unfinished workout of the last 24 hours, and
  -- an older one stays unfinished, as an abandoned workout does today.
  SELECT count(*) INTO n_target_in_prog FROM public.workouts
  WHERE user_id = p_target AND finished_at IS NULL AND created_at > now() - interval '24 hours';
  SELECT count(*) INTO n_in_prog FROM public.workouts
  WHERE user_id = p_guest AND finished_at IS NULL AND created_at > now() - interval '24 hours';

  UPDATE public.workouts SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_workouts = ROW_COUNT;
  UPDATE public.workout_exercises SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_we = ROW_COUNT;
  UPDATE public.sets SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_sets = ROW_COUNT;

  -- Routines. Oldest guest routine first.
  --
  -- A guest copy identical to one of the account's own (same program_slug,
  -- and the same exercises, order, target sets and target reps) is
  -- dropped, and the guest's workouts started from it point at the
  -- account's copy. Onboarding saves the chosen routine, so a returning
  -- user who picked the same program again would otherwise get two. Only
  -- against the account's routines from before this merge, and never a
  -- guest copy with a share link, which someone may have opened.
  --
  -- Anything else moves. A name the account already uses gets " (2)",
  -- " (3)" and so on, compared case-insensitively and ignoring outer spaces.
  SELECT coalesce(array_agg(id), '{}') INTO v_target_templates
  FROM public.templates WHERE user_id = p_target;

  FOR r IN
    SELECT id, name, program_slug, share_token FROM public.templates
    WHERE user_id = p_guest ORDER BY created_at, id
  LOOP
    v_match := NULL;
    IF r.program_slug IS NOT NULL AND r.share_token IS NULL THEN
      SELECT t.id INTO v_match
      FROM public.templates t
      WHERE t.id = ANY (v_target_templates)
        AND t.program_slug = r.program_slug
        AND (SELECT coalesce(jsonb_agg(jsonb_build_array(te.exercise_id, te.target_sets, te.target_reps)
                                       ORDER BY te.position, te.id), '[]'::jsonb)
             FROM public.template_exercises te WHERE te.template_id = t.id)
          = (SELECT coalesce(jsonb_agg(jsonb_build_array(te.exercise_id, te.target_sets, te.target_reps)
                                       ORDER BY te.position, te.id), '[]'::jsonb)
             FROM public.template_exercises te WHERE te.template_id = r.id)
      ORDER BY t.created_at, t.id
      LIMIT 1;
    END IF;

    IF v_match IS NOT NULL THEN
      -- The guest's workouts already belong to the account (moved above).
      UPDATE public.workouts SET template_id = v_match WHERE template_id = r.id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      n_repointed := n_repointed + v_count;
      -- Its template_exercises cascade.
      DELETE FROM public.templates WHERE id = r.id;
      n_dropped := n_dropped + 1;
      CONTINUE;
    END IF;

    v_name := r.name;
    v_k := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.user_id = p_target AND lower(btrim(t.name)) = lower(btrim(v_name))
    ) LOOP
      v_k := v_k + 1;
      v_name := btrim(r.name) || ' (' || v_k || ')';
    END LOOP;
    UPDATE public.templates SET user_id = p_target, name = v_name WHERE id = r.id;
    n_templates := n_templates + 1;
    IF v_name IS DISTINCT FROM r.name THEN n_renamed := n_renamed + 1; END IF;
  END LOOP;
  UPDATE public.template_exercises SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_te = ROW_COUNT;

  -- Usage history. Kept with the person who made it.
  UPDATE public.app_events SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_events = ROW_COUNT;
  UPDATE public.page_views SET user_id = p_target WHERE user_id = p_guest;
  GET DIAGNOSTICS n_views = ROW_COUNT;

  -- One row per exercise in each. The account's own wins; the guest's
  -- fills exercises the account has none for.
  UPDATE public.exercise_rest_prefs g SET user_id = p_target
  WHERE g.user_id = p_guest
    AND NOT EXISTS (SELECT 1 FROM public.exercise_rest_prefs t
                    WHERE t.user_id = p_target AND t.exercise_id = g.exercise_id);
  GET DIAGNOSTICS n_rest = ROW_COUNT;
  DELETE FROM public.exercise_rest_prefs WHERE user_id = p_guest;
  GET DIAGNOSTICS n_rest_drop = ROW_COUNT;

  UPDATE public.pr_goals g SET user_id = p_target
  WHERE g.user_id = p_guest
    AND NOT EXISTS (SELECT 1 FROM public.pr_goals t
                    WHERE t.user_id = p_target AND t.exercise_id = g.exercise_id);
  GET DIAGNOSTICS n_goals = ROW_COUNT;
  DELETE FROM public.pr_goals WHERE user_id = p_guest;
  GET DIAGNOSTICS n_goals_drop = ROW_COUNT;

  -- Profile. The account's values win. A guest value fills a field only
  -- where the account's is null. weight_unit and weekly_target are NOT NULL
  -- with defaults, so the account's always stand. Bodyweight is converted
  -- into the account's unit; bar weight and plates only carry over when
  -- the units match.
  SELECT * INTO v_gp FROM public.user_profiles WHERE user_id = p_guest;
  v_has_gp := FOUND;
  SELECT * INTO v_tp FROM public.user_profiles WHERE user_id = p_target;
  v_has_tp := FOUND;

  IF v_has_gp AND NOT v_has_tp THEN
    UPDATE public.user_profiles SET user_id = p_target, updated_at = now() WHERE user_id = p_guest;
    v_profile := 'moved';
  ELSIF v_has_gp THEN
    v_bw := CASE
      WHEN v_gp.bodyweight IS NULL THEN NULL
      WHEN v_gp.weight_unit = v_tp.weight_unit THEN v_gp.bodyweight
      WHEN v_gp.weight_unit = 'lb' THEN round(v_gp.bodyweight * 0.45359237, 1)
      ELSE round(v_gp.bodyweight / 0.45359237, 1)
    END;
    -- Deleted first: the username index is unique on lower(username), and
    -- the guest's name may be the one that fills the account's.
    DELETE FROM public.user_profiles WHERE user_id = p_guest;
    UPDATE public.user_profiles t SET
      bodyweight       = coalesce(t.bodyweight, v_bw),
      bar_weight       = coalesce(t.bar_weight, CASE WHEN v_gp.weight_unit = t.weight_unit THEN v_gp.bar_weight END),
      plate_inventory  = coalesce(t.plate_inventory, CASE WHEN v_gp.weight_unit = t.weight_unit THEN v_gp.plate_inventory END),
      training_level   = coalesce(t.training_level, v_gp.training_level),
      equipment_access = coalesce(t.equipment_access, v_gp.equipment_access),
      username         = coalesce(t.username, v_gp.username),
      sex              = coalesce(t.sex, v_gp.sex),
      birthday         = coalesce(t.birthday, v_gp.birthday),
      pwa_installed_at = coalesce(t.pwa_installed_at, v_gp.pwa_installed_at),
      invited_friend_at = coalesce(t.invited_friend_at, v_gp.invited_friend_at),
      setup_hidden_at  = coalesce(t.setup_hidden_at, v_gp.setup_hidden_at),
      updated_at       = now()
    WHERE t.user_id = p_target;
    v_profile := 'filled';
  END IF;

  -- Nothing of the guest's may be left for the delete to cascade away.
  -- Reads the keys live, so a table added later without a rule above
  -- stops the merge instead of losing its rows.
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col) INTO v_count USING p_guest;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'merge_guest_account: % row(s) left in % for the guest', v_count, r.tbl
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  v_moved := jsonb_build_object(
    'workouts', n_workouts,
    'in_progress', n_in_prog,
    'target_in_progress', n_target_in_prog,
    'workout_exercises', n_we,
    'sets', n_sets,
    'templates', n_templates,
    'templates_renamed', n_renamed,
    'templates_dropped', n_dropped,
    'workouts_repointed', n_repointed,
    'template_exercises', n_te,
    'app_events', n_events,
    'page_views', n_views,
    'rest_prefs', n_rest,
    'rest_prefs_dropped', n_rest_drop,
    'pr_goals', n_goals,
    'pr_goals_dropped', n_goals_drop,
    'profile', v_profile
  );

  INSERT INTO private.guest_merges (guest_id, target_id, moved) VALUES (p_guest, p_target, v_moved);

  -- guest_created_at is the guest's first open, which the delete below
  -- removes; the activation funnel (docs/funnel-query.sql) reads it here.
  INSERT INTO public.app_events (user_id, name, props)
  VALUES (p_target, 'guest_merged', v_moved || jsonb_build_object(
    'guest_id', p_guest,
    'guest_created_at', v_guest_created));

  -- The guest account itself. Its identities and sessions cascade; every
  -- public row has moved (checked above). No Apple or email step: a guest
  -- has neither.
  DELETE FROM auth.users WHERE id = p_guest AND is_anonymous;

  RETURN jsonb_build_object('status', 'merged', 'moved', v_moved);
END
$function$;

REVOKE ALL ON FUNCTION public.merge_guest_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_guest_account(uuid, uuid) TO service_role;


-- ===========================================================================
-- Section 3. guest_merge_record
-- ===========================================================================
-- The ledger lookup for a retry whose guest token can no longer be
-- verified, because the first call deleted the guest. Read only: it never
-- merges, so the Edge Function may call it with a guest id it decoded
-- without verifying. It answers only about the caller's own account.

CREATE OR REPLACE FUNCTION public.guest_merge_record(p_guest uuid, p_target uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object('status', 'already_merged', 'merged_at', m.merged_at, 'moved', m.moved)
  FROM private.guest_merges m
  WHERE m.guest_id = p_guest AND m.target_id = p_target;
$function$;

REVOKE ALL ON FUNCTION public.guest_merge_record(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_merge_record(uuid, uuid) TO service_role;


-- ===========================================================================
-- Section 4. Check (read only)
-- ===========================================================================

SELECT p.proname, p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,                 -- expect false
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed_exec,      -- expect false
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_exec       -- expect true
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('merge_guest_account', 'guest_merge_record');


-- ===========================================================================
-- Section 5. Dry run for one pair (changes nothing)
-- ===========================================================================
-- Replace both ids in each query.
--
-- 5a. A preview with plain SELECTs. Works before anything above is
-- applied (it does not read the ledger). It repeats the function's rules,
-- so if it disagrees with 5b, 5b is right.

WITH ids AS (
  SELECT '<GUEST_ID>'::uuid AS guest, '<TARGET_ID>'::uuid AS target
),
sig AS (
  SELECT t.id, t.user_id, t.program_slug, t.share_token, t.created_at, t.name,
         (SELECT coalesce(jsonb_agg(jsonb_build_array(te.exercise_id, te.target_sets, te.target_reps)
                                    ORDER BY te.position, te.id), '[]'::jsonb)
          FROM public.template_exercises te WHERE te.template_id = t.id) AS exercises
  FROM public.templates t, ids
  WHERE t.user_id IN (ids.guest, ids.target)
),
guest_templates AS (
  SELECT g.id, g.name,
         EXISTS (SELECT 1 FROM sig t, ids
                 WHERE t.user_id = ids.target AND g.program_slug IS NOT NULL AND g.share_token IS NULL
                   AND t.program_slug = g.program_slug AND t.exercises = g.exercises) AS identical,
         EXISTS (SELECT 1 FROM sig t, ids
                 WHERE t.user_id = ids.target AND lower(btrim(t.name)) = lower(btrim(g.name))) AS name_clash
  FROM sig g, ids WHERE g.user_id = ids.guest
)
SELECT check_name, n::text AS value FROM (
  SELECT 1 o, 'guest is anonymous (expect 1)' check_name, (SELECT is_anonymous::int FROM auth.users, ids WHERE id = ids.guest) n
  UNION ALL SELECT 2, 'target is anonymous (expect 0)', (SELECT is_anonymous::int FROM auth.users, ids WHERE id = ids.target)
  UNION ALL SELECT 4, 'guest roles (expect 0)', (SELECT count(*) FROM public.user_roles, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 10, 'workouts to move', (SELECT count(*) FROM public.workouts, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 11, '  of them in progress (24 h)', (SELECT count(*) FROM public.workouts, ids WHERE user_id = ids.guest AND finished_at IS NULL AND created_at > now() - interval '24 hours')
  UNION ALL SELECT 12, '  account already in progress', (SELECT count(*) FROM public.workouts, ids WHERE user_id = ids.target AND finished_at IS NULL AND created_at > now() - interval '24 hours')
  UNION ALL SELECT 13, 'workout_exercises to move', (SELECT count(*) FROM public.workout_exercises, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 14, 'sets to move', (SELECT count(*) FROM public.sets, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 20, 'templates dropped as identical', (SELECT count(*) FROM guest_templates WHERE identical)
  UNION ALL SELECT 21, 'templates moved and renamed', (SELECT count(*) FROM guest_templates WHERE NOT identical AND name_clash)
  UNION ALL SELECT 22, 'templates moved as they are', (SELECT count(*) FROM guest_templates WHERE NOT identical AND NOT name_clash)
  UNION ALL SELECT 23, 'template_exercises to move (dropped ones excluded)',
    (SELECT count(*) FROM public.template_exercises te, ids WHERE te.user_id = ids.guest
       AND te.template_id NOT IN (SELECT id FROM guest_templates WHERE identical))
  UNION ALL SELECT 30, 'rest prefs to move', (SELECT count(*) FROM public.exercise_rest_prefs g, ids WHERE g.user_id = ids.guest
       AND NOT EXISTS (SELECT 1 FROM public.exercise_rest_prefs t WHERE t.user_id = ids.target AND t.exercise_id = g.exercise_id))
  UNION ALL SELECT 31, 'rest prefs dropped (account has its own)', (SELECT count(*) FROM public.exercise_rest_prefs g, ids WHERE g.user_id = ids.guest
       AND EXISTS (SELECT 1 FROM public.exercise_rest_prefs t WHERE t.user_id = ids.target AND t.exercise_id = g.exercise_id))
  UNION ALL SELECT 32, 'pr goals to move', (SELECT count(*) FROM public.pr_goals g, ids WHERE g.user_id = ids.guest
       AND NOT EXISTS (SELECT 1 FROM public.pr_goals t WHERE t.user_id = ids.target AND t.exercise_id = g.exercise_id))
  UNION ALL SELECT 33, 'pr goals dropped (account has its own)', (SELECT count(*) FROM public.pr_goals g, ids WHERE g.user_id = ids.guest
       AND EXISTS (SELECT 1 FROM public.pr_goals t WHERE t.user_id = ids.target AND t.exercise_id = g.exercise_id))
  UNION ALL SELECT 40, 'app_events to move', (SELECT count(*) FROM public.app_events, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 41, 'page_views to move', (SELECT count(*) FROM public.page_views, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 50, 'profile: 1 = guest row exists', (SELECT count(*) FROM public.user_profiles, ids WHERE user_id = ids.guest)
  UNION ALL SELECT 51, 'profile: 1 = account row exists (fill), 0 = move whole', (SELECT count(*) FROM public.user_profiles, ids WHERE user_id = ids.target)
) x ORDER BY o;

-- 5b. The real function, rolled back. A DO block is one statement, and the
-- RAISE at its end aborts it, so every change it made is undone whatever
-- the editor does with transactions. The result shows as the error text:
-- "DRY RUN, rolled back: {...}". Needs Sections 1 to 3 applied. An error
-- other than DRY RUN is what the real call would have raised.

DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.merge_guest_account('<GUEST_ID>'::uuid, '<TARGET_ID>'::uuid);
  RAISE EXCEPTION 'DRY RUN, rolled back: %', v;
END
$$;
