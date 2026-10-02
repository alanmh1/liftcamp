-- /admin "Per account": signed-up accounts only.
--
-- admin_users() returned every auth.users row, so the 36 guest (anonymous)
-- accounts showed up as rows with no email, in a table labelled "Signed-up
-- accounts only". The filter lives here, not in the UI, so the row count and
-- sorting only ever see signed-up accounts.
--
-- A guest is is_anonymous = true, or has no email. On 29 Sep 2026 those two
-- sets were identical (36 of 50 users), but either one alone is enough to
-- hide a row.
--
-- admin_guest_count() backs the "N guest accounts hidden" line under the
-- table. It uses the same predicate, negated, so the two always add up to
-- count(*) from auth.users.
--
-- The return shape of admin_users() is unchanged, so the deployed frontend
-- keeps working before and after this runs.
--
-- Run in SUPABASE (SQL editor). Section 0 first, read the output, then the rest.

-- Section 0: diagnostic. Expect total = signed_up + guests.
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE u.is_anonymous IS NOT TRUE AND nullif(u.email, '') IS NOT NULL) AS signed_up,
--        count(*) FILTER (WHERE u.is_anonymous IS TRUE OR nullif(u.email, '') IS NULL) AS guests
-- FROM auth.users u;

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_users()
 RETURNS TABLE(user_id uuid, email text, joined_at timestamp with time zone, workouts integer, finished integer, sets integer, last_active timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT u.id,
         u.email::text,
         u.created_at,
         (SELECT count(*)::int FROM public.workouts w WHERE w.user_id = u.id),
         (SELECT count(*)::int FROM public.workouts w WHERE w.user_id = u.id AND w.finished_at IS NOT NULL),
         (SELECT count(*)::int FROM public.sets s WHERE s.user_id = u.id),
         GREATEST(
           (SELECT max(s.created_at) FROM public.sets s WHERE s.user_id = u.id),
           (SELECT max(p.created_at) FROM public.page_views p WHERE p.user_id = u.id)
         )
  FROM auth.users u
  WHERE u.is_anonymous IS NOT TRUE
    AND nullif(u.email, '') IS NOT NULL
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_guest_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT count(*)::int
    FROM auth.users u
    WHERE u.is_anonymous IS TRUE
       OR nullif(u.email, '') IS NULL
  );
END;
$function$;

-- Same grants as the other admin_* functions: authenticated and service_role,
-- not anon or PUBLIC.
REVOKE ALL ON FUNCTION public.admin_guest_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_guest_count() TO authenticated, service_role;

COMMIT;
