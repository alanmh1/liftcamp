-- workouts
CREATE TABLE public.workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workouts_user_date ON public.workouts(user_id, workout_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workouts select" ON public.workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own workouts insert" ON public.workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own workouts update" ON public.workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own workouts delete" ON public.workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- workout_exercises
CREATE TABLE public.workout_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  user_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_we_workout ON public.workout_exercises(workout_id, position);
CREATE INDEX idx_we_user_exercise ON public.workout_exercises(user_id, exercise_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own we select" ON public.workout_exercises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own we insert" ON public.workout_exercises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own we update" ON public.workout_exercises FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own we delete" ON public.workout_exercises FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sets
CREATE TABLE public.sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  weight TEXT NOT NULL DEFAULT '',
  reps INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sets_we ON public.sets(workout_exercise_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sets TO authenticated;
GRANT ALL ON public.sets TO service_role;

ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sets select" ON public.sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sets insert" ON public.sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sets update" ON public.sets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sets delete" ON public.sets FOR DELETE TO authenticated USING (auth.uid() = user_id);