-- Activation funnel, read only. SUPABASE (SQL editor), or the session pooler.
--
-- One row of counts for every user whose first open is on or after the
-- launch date in `params`. Change that date and run. The per-user rows
-- behind it are the commented query at the bottom.
--
-- Who is left out:
-- - Every user with a `dev_user` app_events row. A development build
--   writes one for each anonymous user it creates (apps/mobile
--   src/lib/dev-user.ts): first launch, a lost guest replaced at launch,
--   and Start fresh as a new user. Release builds never write it.
-- - Every account whose auth.users.email is in `excluded_emails`, matched
--   case insensitive: the team's own sign-ins. Merged guests are matched
--   through their account's email, since the merge deletes the guest's
--   auth.users row and moves its workouts onto the account. A dev guest
--   merged into an account moves its dev_user row too, so that account is
--   left out as well.
--
-- Steps, each counted on its own (a guest usually finishes a workout before
-- creating an account, so the steps are not strictly in order):
--   first open        auth.users.created_at, pulled earlier by a merged-in
--                     guest or workout (see merged guests)
--   first workout     first finished workout (workouts.finished_at)
--   account created   first auth.identities.created_at; null while the user
--                     is still a guest (anonymous users have no identity row)
--   second, third     second and third finished workout
--   week 2 return     a finished workout 7 to 13 days after first open,
--                     counted only for users 14 or more days past first open
--
-- Medians are in hours, so same-day repeats show instead of rounding to 0
-- days.
--
-- Workout times are the phone's (created_at and finished_at are set at the
-- tap and sent through the write queue), so offline logging does not move
-- them.
--
-- Guests who create an account. A guest whose Google, Apple or email
-- identity is new links it in place (linkIdentity, or an email change):
-- same auth.users row, same created_at, is_anonymous turns false. Their
-- first open is created_at and their account created is the identity's
-- created_at.
--   Email: confirmed against a real guest on 2 Oct 2026. The auth logs
--   show the anonymous sign-in, then PUT /user, then /verify; the email
--   identity's created_at is the moment of /verify, when the code was
--   entered, 2 min 51 s after the user was created.
--   Google and Apple: still unconfirmed. No guest has linked either yet.
--   Check with the query at the bottom once one has.
--
-- Merged guests. A guest whose identity already has an account is merged:
-- merge_guest_account moves the guest's workouts (and app_events) to that
-- account, writes a `guest_merged` app_events row (user_id = the account,
-- props.guest_id = the guest) and deletes the guest's auth.users row. The
-- person is counted once, as the account. First open is the earliest of
-- the account's created_at, the merged guest's created_at
-- (props.guest_created_at, from 20261002140000_guest_merged_first_open.sql
-- on) and the account's first workout. The last covers merges from before
-- that migration, which have no guest_created_at.
--
-- Platform. workouts.platform and workouts.app_version are filled from
-- build 13 (1.0.0 (13)) on. Workouts from older builds and the web have
-- both null, so the first_workout_* split counts them as unknown.
--
-- Known gaps:
-- - The nightly cleanup (private.purge_empty_guests) deletes guests with no
--   workouts or routines and no activity for 90 days, so an older cohort
--   loses its guests who never logged, and "first open" shrinks.
-- - Dev users created before the dev_user event existed (before 4 Oct
--   2026) carry no mark. Add their account emails to `excluded_emails`, or
--   start the cohort after that date.

WITH params AS (
  SELECT timestamptz '2026-09-01 00:00:00+00' AS launch,
         ARRAY[
           'alanmh@gmail.com',
           'tester@example.com'
         ]::text[] AS excluded_emails
),
excluded AS (
  SELECT u.id AS user_id
  FROM auth.users u, params
  WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(params.excluded_emails) AS e)
  UNION
  SELECT e.user_id
  FROM public.app_events e
  WHERE e.name = 'dev_user'
),
merged AS (
  SELECT user_id,
         min((props->>'guest_created_at')::timestamptz) AS guest_created_at
  FROM public.app_events
  WHERE name = 'guest_merged'
  GROUP BY user_id
),
finishes AS (
  SELECT user_id, finished_at, platform,
         row_number() OVER (PARTITION BY user_id ORDER BY finished_at, id) AS n
  FROM public.workouts
  WHERE finished_at IS NOT NULL
),
people AS (
  SELECT u.id AS user_id,
         u.is_anonymous,
         m.user_id IS NOT NULL AS merged,
         LEAST(u.created_at,
               m.guest_created_at,
               (SELECT min(w.created_at) FROM public.workouts w WHERE w.user_id = u.id)) AS first_open,
         (SELECT min(i.created_at) FROM auth.identities i WHERE i.user_id = u.id) AS account_created,
         (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 1) AS first_workout,
         (SELECT f.platform    FROM finishes f WHERE f.user_id = u.id AND f.n = 1) AS first_platform,
         (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 2) AS second_workout,
         (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 3) AS third_workout
  FROM auth.users u
  LEFT JOIN merged m ON m.user_id = u.id
  WHERE NOT EXISTS (SELECT 1 FROM excluded x WHERE x.user_id = u.id)
),
cohort AS (
  SELECT p.*,
         now() >= p.first_open + interval '14 days' AS week2_eligible,
         EXISTS (
           SELECT 1 FROM finishes f
           WHERE f.user_id = p.user_id
             AND f.finished_at >= p.first_open + interval '7 days'
             AND f.finished_at <  p.first_open + interval '14 days'
         ) AS week2_return
  FROM people p, params
  WHERE p.first_open >= params.launch
)
SELECT
  (SELECT launch::date FROM params)                                         AS launch,
  count(*)                                                                  AS first_open,
  count(*) FILTER (WHERE first_workout IS NOT NULL)                         AS first_workout,
  count(*) FILTER (WHERE account_created IS NOT NULL)                       AS account_created,
  count(*) FILTER (WHERE second_workout IS NOT NULL)                        AS second_workout,
  count(*) FILTER (WHERE third_workout IS NOT NULL)                         AS third_workout,
  count(*) FILTER (WHERE week2_eligible)                                    AS week2_eligible,
  count(*) FILTER (WHERE week2_eligible AND week2_return)                   AS week2_return,
  count(*) FILTER (WHERE merged)                                            AS merged_accounts,
  count(*) FILTER (WHERE first_platform = 'ios')                            AS first_workout_ios,
  count(*) FILTER (WHERE first_platform = 'android')                        AS first_workout_android,
  count(*) FILTER (WHERE first_workout IS NOT NULL AND first_platform IS NULL) AS first_workout_unknown,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY first_workout - first_open)) / 3600, 1)
                                                                            AS median_hours_open_to_first,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY second_workout - first_workout)) / 3600, 1)
                                                                            AS median_hours_first_to_second,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY third_workout - second_workout)) / 3600, 1)
                                                                            AS median_hours_second_to_third
FROM cohort;

-- Per-user rows: replace the final SELECT above with
--   SELECT user_id, is_anonymous, merged, first_open, first_workout, first_platform,
--          account_created, second_workout, third_workout,
--          week2_eligible, week2_return
--   FROM cohort ORDER BY first_open;

-- Check, once a guest has linked Google or Apple (not a merge): the
-- identity's created_at should be later than the user's created_at by the
-- time the person spent as a guest. An account that signed up directly
-- shows a gap under 1 s.
--
-- SELECT u.id, u.created_at AS user_created, i.provider, i.created_at AS identity_created,
--        i.created_at - u.created_at AS gap
-- FROM auth.users u JOIN auth.identities i ON i.user_id = u.id
-- WHERE NOT u.is_anonymous
-- ORDER BY gap DESC;
