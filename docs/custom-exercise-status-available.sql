-- SUPABASE (SQL editor)
-- custom_exercise_status() gains `available`: whether the global switch is on.
-- Guests (anonymous users) can't read app_flags, and the app shows them the
-- New button with a sign-up prompt only when the feature is on for everyone.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.custom_exercise_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'enabled',   coalesce(private.custom_exercises_on(auth.uid()), false),
    'available', coalesce((SELECT a.enabled_for_all FROM public.app_flags a WHERE a.flag = 'custom_exercises'), false),
    'member',    coalesce(private.is_member(auth.uid()), false),
    'pro',       coalesce(private.is_pro(auth.uid()), false),
    'used',      coalesce(private.custom_exercise_count(auth.uid()), 0),
    'limit',     private.free_custom_exercise_limit()
  );
$function$;

-- Check: expect available false (the switch is still off).
SELECT public.custom_exercise_status();
