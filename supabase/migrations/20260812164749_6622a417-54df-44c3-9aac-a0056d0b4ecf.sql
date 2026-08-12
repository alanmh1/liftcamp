CREATE TABLE public.app_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own events select" ON public.app_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own events insert" ON public.app_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX app_events_user_created_idx ON public.app_events (user_id, created_at DESC);
CREATE INDEX app_events_name_idx ON public.app_events (name, created_at DESC);