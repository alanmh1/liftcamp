
-- Shared, read-only exercises catalog. Imported from CSV via the dashboard.
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_muscle text,
  ppl_day text,
  all_primary_muscles text,
  secondary_muscles text,
  equipment text,
  mechanic text,
  force text,
  level text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercises_ppl_day_idx ON public.exercises (ppl_day);
CREATE INDEX exercises_primary_muscle_idx ON public.exercises (primary_muscle);
CREATE INDEX exercises_name_idx ON public.exercises (lower(name));

GRANT SELECT ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read; no client-side writes (CSV import via dashboard uses service role).
CREATE POLICY "Exercises readable by authenticated users"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);
