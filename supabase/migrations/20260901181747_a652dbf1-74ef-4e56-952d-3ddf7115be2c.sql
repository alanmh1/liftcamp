CREATE TABLE public.pr_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  target_weight numeric not null check (target_weight > 0),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_goals TO authenticated;
GRANT ALL ON public.pr_goals TO service_role;
ALTER TABLE public.pr_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own PR goals" ON public.pr_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);