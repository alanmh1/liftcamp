-- app_events: make immutability explicit and revoke unused privileges
REVOKE UPDATE, DELETE ON public.app_events FROM authenticated, anon;
DROP POLICY IF EXISTS "app_events_no_update" ON public.app_events;
DROP POLICY IF EXISTS "app_events_no_delete" ON public.app_events;
CREATE POLICY "app_events_no_update" ON public.app_events AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "app_events_no_delete" ON public.app_events AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- email_send_state: explicit deny for non-service roles
REVOKE ALL ON public.email_send_state FROM authenticated, anon;
GRANT ALL ON public.email_send_state TO service_role;
DROP POLICY IF EXISTS "email_send_state_deny_clients" ON public.email_send_state;
CREATE POLICY "email_send_state_deny_clients" ON public.email_send_state AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);