-- Public/system read of template_exercises must not leak user-owned rows that
-- happen to point at a system template. Restrict to rows with no owner.
DROP POLICY IF EXISTS "System template exercises readable by anyone" ON public.template_exercises;
CREATE POLICY "System template exercises readable by anyone"
ON public.template_exercises
FOR SELECT
TO anon
USING (
  user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_exercises.template_id AND t.is_system = true)
);

DROP POLICY IF EXISTS "system template_exercises readable" ON public.template_exercises;
CREATE POLICY "system template_exercises readable"
ON public.template_exercises
FOR SELECT
TO authenticated
USING (
  user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_exercises.template_id AND t.is_system = true)
);

-- Allow backend cleanup/retention of email send logs (service role only).
CREATE POLICY "Service role can delete send log"
ON public.email_send_log
FOR DELETE
USING (auth.role() = 'service_role');

GRANT DELETE ON public.email_send_log TO service_role;