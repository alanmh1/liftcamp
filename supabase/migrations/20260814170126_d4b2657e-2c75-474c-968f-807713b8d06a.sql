ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS hide_from_onboarding boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  d1 uuid;
  d2 uuid;
  d3 uuid;
  ex uuid;
  pinned uuid[] := ARRAY[
    'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6',
    '6ab07ffd-b583-4680-ba41-078eb95b3454',
    '80f60581-67e4-444b-88bd-a455d07fed69',
    '7492d613-b2ff-41c0-9131-af0bb9832438',
    '653288a1-8c39-4840-a2bc-c6eb64790c82',
    '9f94e87f-9afc-4a49-b4b3-feba0a560e27',
    '6db0743b-b1be-4071-b663-af358c7f47bb',
    '463a3682-c764-4971-a1fc-db0e925d0735',
    '2d7d0ac0-bde1-40e5-8eda-233c4953a094',
    '5bed9c3c-fda3-4d55-86ce-5cc2a804492b',
    '52f54e89-69d2-4fd5-ac03-9244b582570a',
    'f34d6c21-15cd-4a1f-bfe4-620e2b0e2c97',
    'ff125b68-7808-49db-9a7b-da3db74fdef4',
    '85495e85-bd72-445d-a6c8-5961f17ec2e5',
    'd1d858b3-deb2-4e0d-91f6-3004a14f0f44',
    '21e9e394-1151-4a07-bb3a-2fd487e461dd',
    '5d45e185-8637-4a37-98f3-868513644bed',
    '09e9a230-a675-4796-bee5-13193961b46b'
  ]::uuid[];
BEGIN
  FOREACH ex IN ARRAY pinned LOOP
    IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id = ex) THEN
      RAISE EXCEPTION 'Arnold Split seed: missing exercise id %', ex;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.templates WHERE is_system AND program = 'Arnold Split') THEN
    RETURN;
  END IF;

  INSERT INTO public.templates (user_id, name, is_system, program, program_blurb, program_order, hide_from_onboarding)
  VALUES
    (NULL, 'Day 1 — Chest & Back', true, 'Arnold Split',
     'Classic six-day bodybuilding split: chest & back, shoulders & arms, legs — run twice a week.', 40, true),
    (NULL, 'Day 2 — Shoulders & Arms', true, 'Arnold Split',
     'Classic six-day bodybuilding split: chest & back, shoulders & arms, legs — run twice a week.', 40, true),
    (NULL, 'Day 3 — Legs', true, 'Arnold Split',
     'Classic six-day bodybuilding split: chest & back, shoulders & arms, legs — run twice a week.', 40, true);

  SELECT id INTO d1 FROM public.templates WHERE is_system AND program = 'Arnold Split' AND name = 'Day 1 — Chest & Back';
  SELECT id INTO d2 FROM public.templates WHERE is_system AND program = 'Arnold Split' AND name = 'Day 2 — Shoulders & Arms';
  SELECT id INTO d3 FROM public.templates WHERE is_system AND program = 'Arnold Split' AND name = 'Day 3 — Legs';

  INSERT INTO public.template_exercises (template_id, exercise_id, user_id, position) VALUES
    (d1, 'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6', NULL, 0),
    (d1, '6ab07ffd-b583-4680-ba41-078eb95b3454', NULL, 1),
    (d1, '80f60581-67e4-444b-88bd-a455d07fed69', NULL, 2),
    (d1, '7492d613-b2ff-41c0-9131-af0bb9832438', NULL, 3),
    (d1, '653288a1-8c39-4840-a2bc-c6eb64790c82', NULL, 4),
    (d1, '9f94e87f-9afc-4a49-b4b3-feba0a560e27', NULL, 5),

    (d2, '6db0743b-b1be-4071-b663-af358c7f47bb', NULL, 0),
    (d2, '463a3682-c764-4971-a1fc-db0e925d0735', NULL, 1),
    (d2, '2d7d0ac0-bde1-40e5-8eda-233c4953a094', NULL, 2),
    (d2, '5bed9c3c-fda3-4d55-86ce-5cc2a804492b', NULL, 3),
    (d2, '52f54e89-69d2-4fd5-ac03-9244b582570a', NULL, 4),
    (d2, 'f34d6c21-15cd-4a1f-bfe4-620e2b0e2c97', NULL, 5),
    (d2, 'ff125b68-7808-49db-9a7b-da3db74fdef4', NULL, 6),

    (d3, '85495e85-bd72-445d-a6c8-5961f17ec2e5', NULL, 0),
    (d3, 'd1d858b3-deb2-4e0d-91f6-3004a14f0f44', NULL, 1),
    (d3, '21e9e394-1151-4a07-bb3a-2fd487e461dd', NULL, 2),
    (d3, '5d45e185-8637-4a37-98f3-868513644bed', NULL, 3),
    (d3, '09e9a230-a675-4796-bee5-13193961b46b', NULL, 4);
END $$;