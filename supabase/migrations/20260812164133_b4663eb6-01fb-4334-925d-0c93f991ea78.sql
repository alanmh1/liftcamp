ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS program_blurb text,
  ADD COLUMN IF NOT EXISTS program_order integer NOT NULL DEFAULT 0;

-- Group existing system templates into programs
UPDATE public.templates SET program = 'Full Body 3x/week',
  program_blurb = 'The best default for a true beginner. Alternate A and B, three days a week.',
  program_order = 1
WHERE is_system AND name IN ('Full Body A','Full Body B');

UPDATE public.templates SET program = 'Push / Pull / Legs',
  program_blurb = 'Three sessions on rotation. Popular once you are training four or more days a week.',
  program_order = 3
WHERE is_system AND name IN ('PPL - Push','PPL - Pull','PPL - Legs');

UPDATE public.templates SET program = '5x5 Strength',
  program_blurb = 'Low reps, heavy compounds. Alternate A and B for straightforward strength gains.',
  program_order = 4
WHERE is_system AND name IN ('5x5 Workout A','5x5 Workout B');

UPDATE public.templates SET program = 'Bro Split',
  program_blurb = 'One muscle group per day across four sessions. High volume, more gym days.',
  program_order = 5
WHERE is_system AND name LIKE 'Bro Split%';

-- New Upper / Lower program
INSERT INTO public.templates (id, user_id, name, is_system, program, program_blurb, program_order)
SELECT '11111111-1111-4111-8111-000000000001'::uuid, NULL, 'Upper Body', true,
       'Upper / Lower', 'Two sessions alternated across four training days. A natural step up from full body.', 2
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE id = '11111111-1111-4111-8111-000000000001');

INSERT INTO public.templates (id, user_id, name, is_system, program, program_blurb, program_order)
SELECT '11111111-1111-4111-8111-000000000002'::uuid, NULL, 'Lower Body', true,
       'Upper / Lower', 'Two sessions alternated across four training days. A natural step up from full body.', 2
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE id = '11111111-1111-4111-8111-000000000002');

-- Pin exercises by id (verified against the catalog), and fail loudly if any id is missing
DO $$
DECLARE
  pins uuid[] := ARRAY[
    'd5f93fa3-b43b-4306-8081-ee5bff0d4ca6','7492d613-b2ff-41c0-9131-af0bb9832438',
    'd72a5903-87c1-4dc2-9d67-d83edb227431','653288a1-8c39-4840-a2bc-c6eb64790c82',
    '5bed9c3c-fda3-4d55-86ce-5cc2a804492b','ff125b68-7808-49db-9a7b-da3db74fdef4',
    '85495e85-bd72-445d-a6c8-5961f17ec2e5','21e9e394-1151-4a07-bb3a-2fd487e461dd',
    'd1d858b3-deb2-4e0d-91f6-3004a14f0f44','f8fa4979-f9fa-459a-9f82-4c87ea7c6c50',
    '935a5844-cc7b-4eb2-a8c7-cd37492d1e73','c0f86c40-21ec-4135-bef6-908d2bc3154b'
  ]::uuid[];
  found integer;
BEGIN
  SELECT count(*) INTO found FROM public.exercises WHERE id = ANY(pins);
  IF found <> array_length(pins, 1) THEN
    RAISE EXCEPTION 'Starter routine exercise ids missing from catalog: expected %, found %', array_length(pins,1), found;
  END IF;
END $$;

INSERT INTO public.template_exercises (template_id, exercise_id, user_id, position)
SELECT '11111111-1111-4111-8111-000000000001'::uuid, v.ex::uuid, NULL, v.pos
FROM (VALUES
  ('d5f93fa3-b43b-4306-8081-ee5bff0d4ca6',0),
  ('7492d613-b2ff-41c0-9131-af0bb9832438',1),
  ('d72a5903-87c1-4dc2-9d67-d83edb227431',2),
  ('653288a1-8c39-4840-a2bc-c6eb64790c82',3),
  ('5bed9c3c-fda3-4d55-86ce-5cc2a804492b',4),
  ('ff125b68-7808-49db-9a7b-da3db74fdef4',5)
) AS v(ex,pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_exercises te
  WHERE te.template_id = '11111111-1111-4111-8111-000000000001'::uuid
);

INSERT INTO public.template_exercises (template_id, exercise_id, user_id, position)
SELECT '11111111-1111-4111-8111-000000000002'::uuid, v.ex::uuid, NULL, v.pos
FROM (VALUES
  ('85495e85-bd72-445d-a6c8-5961f17ec2e5',0),
  ('21e9e394-1151-4a07-bb3a-2fd487e461dd',1),
  ('d1d858b3-deb2-4e0d-91f6-3004a14f0f44',2),
  ('f8fa4979-f9fa-459a-9f82-4c87ea7c6c50',3),
  ('935a5844-cc7b-4eb2-a8c7-cd37492d1e73',4),
  ('c0f86c40-21ec-4135-bef6-908d2bc3154b',5)
) AS v(ex,pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_exercises te
  WHERE te.template_id = '11111111-1111-4111-8111-000000000002'::uuid
);