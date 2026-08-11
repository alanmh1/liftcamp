ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS weekly_target integer NOT NULL DEFAULT 3;