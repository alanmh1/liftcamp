-- Activation funnel, read only. SUPABASE (SQL editor), or the session pooler.
--
-- Section 0. One row of counts for every user whose first open is on or
-- after the launch date in `params`. Change that date and run. The per-user
-- rows behind it are the commented query at the bottom.
--
-- Steps, each counted on its own (a guest usually finishes a workout before
-- creating an account, so the steps are not strictly in order):
--   first open        auth.users.created_at, pulled earlier by a merged-in
--                     workout (see merged guests)
--   first workout     first finished workout (workouts.finished_at)
--   account created   first auth.identities.created_at; null while the user
--                     is still a guest (anonymous users have no identity row)
--   second, third     second and third finished workout
--   week 2 return     a finished workout 7 to 13 days after first open,
--                     counted only for users 14 or more days past first open
--
-- Workout times are the phone's (created_at and finished_at are set at the
-- tap and sent through the write queue), so offline logging does not move
-- them.
--
-- Guests who create an account. A guest whose Google, Apple or email
-- identity is new links it in place (linkIdentity, or an email change):
-- same auth.users row, same created_at, is_anonymous turns false. Their
-- first open is created_at and their account created is the identity's
-- created_at, with nothing else to handle.
--
-- Merged guests. A guest whose identity already has an account is merged:
-- merge_guest_account moves the guest's workouts to that account, writes a
-- `guest_merged` app_events row (user_id = the account, props.guest_id =
-- the guest) and deletes the guest's auth.users row. The person is counted
-- once, as the account. First open is the earliest of the account's
-- created_at, the merged guest's created_at (props.guest_created_at, from
-- 20261002140000_guest_merged_first_open.sql on) and the account's first
-- workout. The last covers merges from before that migration, which have
-- no guest_created_at. `merged` marks these users in the detail query.
--
-- Known gaps:
-- - The nightly cleanup (private.purge_empty_guests) deletes guests with no
--   workouts or routines and no activity for 30 days (90 days once
--   20261002141000_purge_guests_90_days.sql runs), so an older cohort loses
--   its guests who never logged, and "first open" shrinks.
-- - Not checked against a real linked guest: as of 2 Oct 2026 no account in
--   the database started as a guest and then linked (every non-anonymous
--   user's identity was created within 50 ms of the user). Whether
--   identities.created_at is the moment of linking is unconfirmed until one
--   exists. The check is at the bottom of this file.
-- - workouts has no platform column yet, so web and mobile are not split.

WITH params AS (
  SELECT timestamptz '2026-09-14 00:00:00+00' AS launch
),
merged AS (
  SELECT user_id,
         min(created_at) AS merged_at,
         min((props->>'guest_created_at')::timestamptz) AS guest_created_at
  FROM public.app_events
  WHERE name = 'guest_merged'
  GROUP BY user_id
),
finishes AS (
  SELECT user_id,
         finished_at,
         created_at,
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
         (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 2) AS second_workout,
         (SELECT f.finished_at FROM finishes f WHERE f.user_id = u.id AND f.n = 3) AS third_workout
  FROM auth.users u
  LEFT JOIN merged m ON m.user_id = u.id
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
  (SELECT launch::date FROM params)                        AS launch,
  count(*)                                                 AS first_open,
  count(*) FILTER (WHERE first_workout IS NOT NULL)        AS first_workout,
  count(*) FILTER (WHERE account_created IS NOT NULL)      AS account_created,
  count(*) FILTER (WHERE second_workout IS NOT NULL)       AS second_workout,
  count(*) FILTER (WHERE third_workout IS NOT NULL)        AS third_workout,
  count(*) FILTER (WHERE week2_eligible)                   AS week2_eligible,
  count(*) FILTER (WHERE week2_eligible AND week2_return)  AS week2_return,
  count(*) FILTER (WHERE merged)                           AS merged_accounts,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY first_workout - first_open)) / 3600, 1)
                                                           AS median_hours_open_to_first,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY second_workout - first_workout)) / 86400, 1)
                                                           AS median_days_first_to_second,
  round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY third_workout - second_workout)) / 86400, 1)
                                                           AS median_days_second_to_third
FROM cohort;

-- Per-user rows: replace the final SELECT above with
--   SELECT user_id, is_anonymous, merged, first_open, first_workout,
--          account_created, second_workout, third_workout,
--          week2_eligible, week2_return
--   FROM cohort ORDER BY first_open;

-- Check, once a guest has linked Google, Apple or email (not a merge): the
-- identity's created_at should be later than the user's created_at by the
-- time the person spent as a guest. Every row today shows a gap under 1 s.
--
-- SELECT u.id, u.created_at AS user_created, i.provider, i.created_at AS identity_created,
--        i.created_at - u.created_at AS gap
-- FROM auth.users u JOIN auth.identities i ON i.user_id = u.id
-- WHERE NOT u.is_anonymous
-- ORDER BY gap DESC;
