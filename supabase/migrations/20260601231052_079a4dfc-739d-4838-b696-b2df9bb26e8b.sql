
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own templates select" ON public.templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own templates insert" ON public.templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own templates update" ON public.templates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own templates delete" ON public.templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.template_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_exercises TO authenticated;
GRANT ALL ON public.template_exercises TO service_role;

ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own te select" ON public.template_exercises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own te insert" ON public.template_exercises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own te update" ON public.template_exercises FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own te delete" ON public.template_exercises FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_template_exercises_template ON public.template_exercises(template_id, position);
