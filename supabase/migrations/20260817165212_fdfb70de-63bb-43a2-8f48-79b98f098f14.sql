ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bar_weight numeric,
  ADD COLUMN IF NOT EXISTS plate_inventory jsonb;