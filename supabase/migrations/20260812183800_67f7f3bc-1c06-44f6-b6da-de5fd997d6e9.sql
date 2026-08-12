ALTER TABLE public.template_exercises ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*)
    INTO bad_count
    FROM public.template_exercises te
    JOIN public.templates t ON t.id = te.template_id
   WHERE t.is_system IS TRUE
     AND te.user_id IS NOT NULL;

  IF bad_count > 0 THEN
    RAISE WARNING 'template_exercises: % row(s) belong to a system template but have a non-null user_id; they will be invisible to other users.', bad_count;
  END IF;
END
$$;