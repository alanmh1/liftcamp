-- merge_guest_account: record the guest's first open on the guest_merged event.
--
-- The merge deletes the guest's auth.users row, and with it the time the
-- guest first opened the app. The guest_merged app_events row now carries
-- it as props.guest_created_at, so the activation funnel
-- (docs/funnel-query.sql) can count a merged account from the guest's
-- first open. Nothing else changes: same moves, same checks, same return.
-- Merges before this change have no guest_created_at and cannot get one;
-- the funnel falls back to the account's earliest workout for them.
--
-- docs/guest-merge.sql holds the same body.

-- Section 0. Diagnostic, read only. Run on its own and read the output.
-- The live body should hash to 1efca1e6c15a18af4923337f940569c6 (checked
-- 2 Oct 2026, matches docs/guest-merge.sql before this change). A
-- different hash means the live function changed since: stop and compare.
-- Then the current guest_merged rows, none of which has guest_created_at.
--
-- SELECT md5(pg_get_functiondef('public.merge_guest_account(uuid,uuid)'::regprocedure));
--
-- SELECT created_at, user_id, props ? 'guest_created_at' AS has_first_open
-- FROM public.app_events WHERE name = 'guest_merged' ORDER BY created_at;

-- Section 1.
BEGIN;

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

-- Unchanged from docs/guest-merge.sql; CREATE OR REPLACE keeps grants, so
-- these only restate them.
REVOKE ALL ON FUNCTION public.merge_guest_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_guest_account(uuid, uuid) TO service_role;

COMMIT;

-- Section 2. Check. Expect 1 (the new line is in the live body).
--
-- SELECT (pg_get_functiondef('public.merge_guest_account(uuid,uuid)'::regprocedure)
--         LIKE '%guest_created_at%')::int;
