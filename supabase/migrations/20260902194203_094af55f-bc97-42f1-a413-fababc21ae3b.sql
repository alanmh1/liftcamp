ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS templates_share_token_key
  ON public.templates (share_token) WHERE share_token IS NOT NULL;

DROP POLICY IF EXISTS "shared templates readable by anyone" ON public.templates;
CREATE POLICY "shared templates readable by anyone"
  ON public.templates FOR SELECT TO anon, authenticated
  USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS "shared template exercises readable by anyone" ON public.template_exercises;
CREATE POLICY "shared template exercises readable by anyone"
  ON public.template_exercises FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_exercises.template_id AND t.share_token IS NOT NULL
  ));