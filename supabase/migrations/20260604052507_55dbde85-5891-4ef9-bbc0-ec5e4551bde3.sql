
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.templates ALTER COLUMN user_id DROP NOT NULL;

CREATE POLICY "system templates readable"
  ON public.templates FOR SELECT
  TO authenticated
  USING (is_system = true);

CREATE POLICY "system template_exercises readable"
  ON public.template_exercises FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_exercises.template_id AND t.is_system = true
  ));
