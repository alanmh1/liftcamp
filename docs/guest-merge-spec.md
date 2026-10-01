# Guest merge

When a guest signs in with an Apple ID, Google account or email that already
has a LiftCamp account, their guest workouts, routines and settings move into
that account. The guest account is then deleted. Today the app signs in, says
"Welcome back" and leaves the guest's data behind.

Files on branch `guest-merge-plan`:

- `docs/guest-merge.sql`: ledger table, `merge_guest_account`,
  `guest_merge_record`, grants. Not applied.
- `supabase/functions/merge-guest/index.ts` and its `config.toml` entry. Not
  deployed.
- This spec. No app code yet.

Checked against the live database on 1 Oct 2026 (read only).

---

## 1. Today's flow

All three providers go through link mode. Each tries to attach the identity
to the anonymous user. If the identity belongs to another account, it signs
in to that account instead.

**Apple and Google** (`apps/mobile/src/lib/native-sign-in.ts`,
`completeWithIdToken`):

1. `supabase.auth.linkIdentity({ provider, token, nonce })` as the guest.
   Supabase refuses with `identity_already_exists`.
2. `sendNow()`: up to 8 s to send the guest's queued writes while the guest
   session is still current.
3. `supabase.auth.signInWithIdToken` with the same token. This replaces the
   stored session (`sb-mnsigwjyskxfuszeegtp-auth-token`) and fires
   `SIGNED_IN` for the other user. auth-js 2.116 does not call `/logout`, so
   the guest's refresh token is still valid on the server, but the phone no
   longer has it.
4. Returns `{ ok: true, linked: false, existingAccount: true }`.

**Email code** (`apps/mobile/src/lib/email-sign-in.ts`):

1. `updateUser({ email })` as the guest. Refused with `email_exists`.
2. `signInWithOtp({ email, shouldCreateUser: false })` sends a sign-in code.
3. `verifyOtp({ type: 'email' })` switches the session.
4. Same outcome as the provider path. **This path never calls `sendNow()`**,
   so any unsent guest writes stay on the phone.

**The alert** fires in two places:

- `apps/mobile/src/app/link-account.tsx:51`, the sheet opened from Home and
  Profile.
- `apps/mobile/src/components/start-gate.tsx:136`, the sheet a guest gets on
  their second start. The held start is dropped there.

**What happens to the guest afterward:**

- The `auth.users` row stays, with every row the guest wrote. Nothing can
  reach it again: the phone no longer holds its session.
- The guest flag (`liftcamp:guest-session`) is cleared, because the new
  session is not anonymous (`guestFlagFor`).
- `private.purge_empty_guests` never removes it: that job skips guests with
  any workout or template. A guest who reached this sheet has finished a
  workout and has the routine onboarding saved.
- On the phone, `liftcamp:queue:<guestId>` and any
  `liftcamp:workout:<id>` copies with `userId: guestId` are orphaned. The
  write queue only sends ops whose user matches the stored session.

Live today: 45 anonymous users hold 61 workouts and 83 templates. Some of
those belong to people who later signed in to an existing account. They can't
be recovered, because nothing proves who owns them.

---

## 2. Tables a guest can write (live schema)

Eleven public tables have a key to `auth.users`, all `ON DELETE CASCADE`:

| Table | Owner column | Guest writes it? | Notes |
|---|---|---|---|
| `workouts` | `user_id` | yes | in progress = `finished_at` null |
| `workout_exercises` | `user_id` | yes | |
| `sets` | `user_id` | yes | `weight_unit` per set, so moving is unit-safe |
| `templates` | `user_id` (nullable; null = system) | yes | onboarding saves the chosen routine; no unique on name |
| `template_exercises` | `user_id` (nullable) | yes | follows its template |
| `user_profiles` | `user_id` (PK) | yes | see below |
| `exercise_rest_prefs` | `user_id` (PK with `exercise_id`) | yes | |
| `app_events` | `user_id` | yes (`write_failed`) | no anonymous rows live today |
| `pr_goals` | `user_id` (unique with `exercise_id`) | not from mobile | web only; covered anyway |
| `page_views` | `user_id` (nullable) | web only | |
| `user_roles` | `user_id` | never | never moved |

`user_profiles` columns: `weight_unit` (NOT NULL, default `lb`),
`weekly_target` (NOT NULL, default 3), `bodyweight` (in the profile's
unit), `bar_weight`, `plate_inventory`, `training_level`,
`equipment_access`, `username` (unique on `lower(username)`), `sex`,
`birthday`, `pwa_installed_at`, `invited_friend_at`, `setup_hidden_at`,
`created_at`, `updated_at`.

There are no onboarding answers stored elsewhere. Onboarding writes
`training_level` and `equipment_access`, and "onboarded" means a profile row
with a non-null `training_level`. Theme is stored only on the device
(`liftcamp:theme`). Nothing in storage is owned by a user (both buckets have
null owners). The email tables are keyed by address, and a guest has none.
No triggers on `auth.users`.

---

## 3. Device keys tied to the guest's id

| Key | What | After a merge |
|---|---|---|
| `liftcamp:queue:<guestId>` | unsent writes; each op has `userId` and rows with `values.user_id` | rekey into the account's queue |
| `liftcamp:queue-failed:<guestId>` | writes refused for good | rekey into the account's list |
| `liftcamp:workout:<workoutId>` | device copy, `userId` inside the JSON | rewrite `userId` |
| `liftcamp:rest:<workoutId>` | rest timer | keyed by workout, unchanged |
| `liftcamp:home:<guestId>` | Home cache | remove |
| `liftcamp:unit:<guestId>` | unit cache | remove |
| `liftcamp:username:<guestId>` | offline username | remove |
| `liftcamp:onboarded:<guestId>` | onboarding cache | remove |
| `liftcamp:signup-due:<guestId>` | offline gate flag | remove |
| `liftcamp:setup-completed-seen:<guestId>` | checklist done seen | remove; the account's own stands |
| `liftcamp:guest-session` | guest flag | already cleared by the non-anonymous session |
| `liftcamp:onboarded`, `theme`, `signin-line`, `week-*`, `dev:progression` | device-wide | unchanged |

---

## 4. Server side

`merge-guest` Edge Function (service role) calls one SQL function,
`public.merge_guest_account(p_guest, p_target)`. It is `SECURITY DEFINER`,
executable by `service_role` only, and runs in one transaction. It:

1. Takes an advisory lock on the guest id, so concurrent calls run one at a
   time.
2. Checks the ledger (`private.guest_merges`). If this pair already merged,
   returns that result. If the guest merged into another account, refuses.
3. Checks that the guest exists and is anonymous, that the target exists and
   is not anonymous, and that the guest has no role.
4. Moves rows (section 6).
5. **Guard:** reads every key to `auth.users` from `pg_constraint` and counts
   guest rows in each table. If any table still has guest rows, it raises
   and the whole transaction rolls back. A table added later without a merge
   rule therefore stops the merge instead of losing its rows when the guest
   is deleted.
6. Writes the ledger row and a `guest_merged` app event on the account.
7. `DELETE FROM auth.users WHERE id = guest AND is_anonymous`, the same way
   `purge_empty_guests` deletes guests.

## 5. Proof of ownership

Your proposal holds up: the new session's JWT in `Authorization`, plus the
guest's access token in the body. The function verifies both with
`auth.getUser`, which checks the signature, expiry and that the user still
exists. It requires the guest to be `is_anonymous` and the account not to
be, and refuses the same id twice. Neither direction gains an attacker
anything:

- Pushing data into someone else's account needs that account's live token.
- Pulling a guest's data into your own account needs the guest's live token,
  and that token already grants full access to that data.

Three refinements:

- **Retry after a lost response.** The first call deleted the guest, so the
  guest token no longer verifies. The function then reads `sub` from the
  token without verifying it, and only calls `guest_merge_record(sub,
  caller)`. That is a read-only ledger lookup for the caller's own verified
  account, and it never merges. Section 3 of the SQL is that function.
- **Expired guest token.** Access tokens last an hour. The app refreshes
  the guest session with its refresh token on a throwaway client
  (`persistSession: false`) and sends the fresh access token. The refresh
  token never leaves the phone.
- **Safer ordering: merge before switching sessions (recommended).** Today
  the session switches first, and the merge would run afterward. That
  causes three problems:
  - The root remounts and Home, History and the onboarding check all load
    before the merge lands.
  - A web-created account with a null `training_level` gets sent into
    onboarding before the guest's answers fill it.
  - The guest's in-progress workout can't be opened until the merge
    finishes: the device copy has the wrong `userId`, and RLS hides the
    server row.

  Instead:

  1. As the guest, after `identity_already_exists` / `email_exists`:
     `sendNow()`, then hold the write queue so nothing is in flight.
  2. Sign in to the existing account on a **throwaway client**
     (`createClient(..., { auth: { persistSession: false,
     autoRefreshToken: false } })`) with the same ID token or OTP. The main
     client stays on the guest, so no `SIGNED_IN` fires and nothing
     remounts.
  3. Save `liftcamp:guest-merge:<guestId>` = `{ guestId, targetId,
     targetSession, guestRefreshToken, stage: 'merging', createdAt,
     attempts }`.
  4. Call `merge-guest` with the account's token and the guest's.
  5. On success, rekey the device (section 9), set `stage: 'merged'`, then
     `supabase.auth.setSession(targetSession)` on the main client. The app
     remounts once, on merged data.
  6. Remove the record once `SIGNED_IN` arrives for the target.

  Your proposal remains the fallback for when the merge can't run (section
  11).

## 6. Merge rules

| Data | Rule |
|---|---|
| workouts, workout_exercises, sets | move |
| templates | move. A name the account already uses (case and outer spaces ignored) becomes "Name (2)", "Name (3)". Oldest guest routine first. |
| template_exercises | move |
| user_profiles, account has no row | move the guest's row whole |
| user_profiles, account has a row | the account wins. Guest values fill only null fields. `weight_unit` and `weekly_target` are NOT NULL, so the account's always stand. `bodyweight` is converted into the account's unit (0.45359237, rounded to 0.1, as `setWeightUnit` does). `bar_weight` and `plate_inventory` fill only when the units match. |
| username | the account's stays. If the account has none, it takes the guest's `lifterNNNNN`. The guest row is deleted first, which frees the name. |
| exercise_rest_prefs, pr_goals | the account's row wins per exercise. The guest's fills exercises the account has none for. The rest are deleted. |
| app_events, page_views | move, plus one `guest_merged` event on the account with the counts and the old guest id |
| user_roles | never moved. A guest with a role makes the merge refuse. |

**In-progress workout.** It moves unchanged and stays in progress. If the
account also has one, both stay unfinished. Home already shows the newest
unfinished workout from the last 24 hours (`getInProgressWorkout`), which
will be the guest's one, started on this phone moments ago. The account's
older one behaves like any abandoned workout today: it is not in History
and gets no Resume. The function returns `in_progress` and
`target_in_progress` counts, so the app can tell when this happened. I
would not auto-finish or delete either workout: that writes a workout end
the person never chose.

**app_events.** Moved, not deleted or left behind. They are what this person
did, deleting the guest would cascade them away, and `write_failed` rows are
the only server trace of writes the queue gave up on. The cost: funnel
counts that use distinct `user_id` will credit the account with the guest's
early events. No anonymous user has an event live today, so the effect is
small.

**Open question on templates.** Onboarding saves the chosen routine. A
returning user who picks the same program as a guest ends up with two copies
("Full Body A", "Full Body A (2)"). This follows your rename rule. If you'd
rather drop an identical copy, the rule would be: same `program_slug` and
same exercise list, then repoint the guest's `workouts.template_id` to the
account's copy and delete the guest's. Say which you want.

## 7. Idempotent

- The ledger row and the guest's deletion commit with the move. A failure
  anywhere rolls back everything.
- A second call for the same pair returns `already_merged` with the first
  call's counts, whether the guest token still verifies (ledger check comes
  first) or not (`guest_merge_record`).
- Concurrent calls queue on the advisory lock. The second sees the ledger
  row.
- Every client-side step after success is safe to repeat. Rekeying a queue
  whose ops already carry the account id changes nothing. Queued inserts are
  `ON CONFLICT (id) DO NOTHING`.

## 8. Deleting the guest

The guard in step 5 proves no public row references the guest before the
delete. The `auth` tables (`identities`, `sessions`, `one_time_tokens`,
`mfa_*`) cascade. The ledger refers to the guest by a plain uuid with no
key. Apple revoke doesn't apply: a guest has no Apple identity (linking one
would have made it non-anonymous), and no email. `delete-account` takes the
same path for guests.

## 9. Client side

New in `packages/shared/src/guest-merge.ts` (pure, tested):

- `guestMergeKey(guestId)`: `liftcamp:guest-merge:<guestId>`.
- `PendingMerge` type and `mergeStep(record, session, now)`, which returns
  `call`, `refresh-guest`, `set-session`, `done` or `wait`.
- `classifyMergeResponse({ data, error, status })` returns:
  - `done` for `merged` or `already_merged`.
  - `refresh` for `guest_session_invalid` when the guest token is expired.
  - `retry` for no response, a timeout or a 5xx.
  - `stuck` for `refused`, `guest_gone`, `not_a_guest` or `account_is_guest`.
- `rekeyOps(ops, from, to)`: rewrites `op.userId` and every
  `rows[].values.user_id` equal to `from`.
- `adoptOps(target: QueueState, ops)`: appends with fresh `seq`s after the
  account's own.
- `keysAfterMerge(allKeys, guestId)` returns `{ remove, rekeyWorkouts }`.
- `mergedLine(moved)`: the confirmation text.

In `packages/shared/src/write-queue-runner.ts`:

- `WriteQueue.hold()` / `release()`: stop sending and wait out the op in
  flight.
- `WriteQueue.adopt(fromUserId)`: loads the guest's stored queue and failed
  list, rekeys them, appends them to the current user's queue, and deletes
  the guest keys.

In `apps/mobile`:

- `lib/guest-merge.ts` runs the steps in section 5. It is also the runner
  for a pending record, on launch, foreground and `SIGNED_IN`, with backoff
  from 2 s to 30 s, then on each foreground.
- `native-sign-in.ts` and `email-sign-in.ts` change their
  `existingAccount` branch to call it, and return
  `{ ok: true, existingAccount: true, merged: boolean }`.
- `link-account.tsx` and `start-gate.tsx` drop the alert. After a merge,
  the start gate runs the held start, which now goes through as a full
  account.
- `auth-provider.tsx`: `shouldRecoverGuest` must also see no pending
  record. Otherwise a `SIGNED_OUT` of the deleted guest during a failed
  `setSession` would sign in a fresh guest. With a `merged` record, it calls
  `setSession(targetSession)` instead.
- After success: `invalidateScanCache()`. Home, History and the unit come
  from the fresh `SIGNED_IN`, so nothing else needs a refetch.

**If the merge call fails**, nothing is dropped. The guest's rows are
untouched on the server. The queue and device copies stay under the guest
key. The record keeps the guest's refresh token for the next try. The guest
is never deleted unless the merge commits, so a later retry can always
succeed. A `stuck` result is reported to `app_events` as
`guest_merge_failed` (ids and code only) and kept on the phone. Settings
shows it beside the refused-writes count.

## 10. Guest limit

`startGate` returns `start` for any non-anonymous session, so once the
account is signed in, the limit is gone. `signUpDueOnHome` needs
`isAnonymous`, and its device flag is removed in the rekey. Nothing else
counts guest workouts. The other anonymous checks are the create-account
rows on Home and Profile, `link-account.tsx`, the delete-account wording,
the guest-session recovery flag, `purge_empty_guests` and the admin guest
split. All of them key on `is_anonymous`, not on a workout count, and all
end with the guest.

## 11. What the user sees

- **Success**: no alert. The sheet closes on Home with the account's data
  and the guest's workout in History. One quiet line on Home for 4 s, like
  the summary's "saved" state: "Your workout from this phone is in your
  account." (plural: "Your 2 workouts from this phone are in your
  account."). I'd keep it. Without it, a returning user can't tell whether
  the guest workout was added.
- **Merge failed, sign-in worked (`retry`)**: alert "Your guest workout
  wasn't added yet", body "It's saved on this phone. Try again now, or
  LiftCamp will try again next time you open it.", buttons "Try again" and
  "Sign in now".
  - "Try again" reruns the merge with the sheet's spinner.
  - "Sign in now" switches to the account and leaves the record pending,
    which is your fallback: the guest token is kept and the merge retries on
    launch.
- **`stuck`**: alert "Your guest workout couldn't be added", body "It's
  still saved on this phone. Write to hello@liftcamp.app and we'll move it."
  Same two buttons.

## 12. Offline

- **Guest signs in with no signal.** `linkIdentity`, `signInWithIdToken`,
  `updateUser`, `signInWithOtp` and `verifyOtp` all need the network, so the
  sign-in fails before anything switches. The guest stays a guest with
  nothing changed, and the screen shows its existing error.
- **Signal drops between sign-in and merge.** This is the `retry` case
  above. With merge-before-switch, the phone is still the guest until the
  user picks "Sign in now", so the guest keeps working, in-progress workout
  included.
- **Signal drops after the merge commits, before the response.** The phone
  gets no response and retries. The retry returns `already_merged` from the
  ledger. Same end state.
- **Signal drops after the merge, before `setSession`.** The record is
  `merged` with the target session saved. The next launch calls
  `setSession` from the record. Guest recovery is held off by the record.

---

## Tests

### Unit (`packages/shared`, `pnpm --filter @liftcamp/shared test`)

`guest-merge.test.ts`:

- `rekeyOps`:
  - rewrites `userId` and `values.user_id` on inserts.
  - leaves update and delete patches alone.
  - doesn't touch ops for a third user.
  - running it twice gives the same result.
- `adoptOps`:
  - guest ops land after the account's, with fresh increasing `seq`.
  - `nextSeq` advances.
  - an empty guest queue is a no-op.
- `keysAfterMerge`:
  - removes exactly the six per-guest keys.
  - lists the guest's `workout:` copies for rekey.
  - never touches `theme`, `onboarded`, `rest:*` or the account's keys.
- `classifyMergeResponse`:
  - `done` for both success statuses.
  - `refresh` only for `guest_session_invalid` with an expired guest token.
  - `stuck` for an invalid guest token that is not expired.
  - `retry` for a fetch error, 500 or timeout.
  - `stuck` for 403 and 410.
- `mergeStep` covers each stage:
  - no record.
  - `merging` with the guest still signed in.
  - `merging` with an expired guest token.
  - `merged` with no session.
  - `merged` with the target signed in (`done`).
  - a record for a different signed-in user (`wait`, never call).
- `mergedLine`: singular and plural, and no line for zero workouts.
- `account-deletion.test.ts`: `storageKeysToClear` includes
  `liftcamp:guest-merge:*`.
- `shouldRecoverGuest`: false while a merge record exists.
- `start-gate.test.ts`: unchanged and still passing.

`write-queue-runner.test.ts`:

- `hold()` waits for the op in flight and sends nothing more until
  `release()`.
- `adopt()` moves the stored guest queue and failed list into the current
  user's, then deletes the guest keys.

### SQL checks: SUPABASE (SQL editor)

Before the test, replace the two ids. Run it again after. Expected after:
every guest count is 0; the account's counts went up by the guest's, minus
`rest_prefs_dropped` / `pr_goals_dropped`; the guest is gone from
`auth.users`; there is one ledger row and one `guest_merged` event.

```sql
WITH ids AS (
  SELECT '<GUEST_ID>'::uuid AS guest, '<TARGET_ID>'::uuid AS target
)
SELECT who, tbl, n FROM (
  SELECT 'guest' who, 'workouts' tbl, count(*) n FROM public.workouts, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'workouts', count(*) FROM public.workouts, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'workout_exercises', count(*) FROM public.workout_exercises, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'workout_exercises', count(*) FROM public.workout_exercises, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'sets', count(*) FROM public.sets, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'sets', count(*) FROM public.sets, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'templates', count(*) FROM public.templates, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'templates', count(*) FROM public.templates, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'template_exercises', count(*) FROM public.template_exercises, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'template_exercises', count(*) FROM public.template_exercises, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'exercise_rest_prefs', count(*) FROM public.exercise_rest_prefs, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'exercise_rest_prefs', count(*) FROM public.exercise_rest_prefs, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'app_events', count(*) FROM public.app_events, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'target', 'app_events', count(*) FROM public.app_events, ids WHERE user_id = ids.target
  UNION ALL SELECT 'guest', 'user_profiles', count(*) FROM public.user_profiles, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'guest', 'auth.users', count(*) FROM auth.users, ids WHERE id = ids.guest
  UNION ALL SELECT 'ledger', 'guest_merges', count(*) FROM private.guest_merges, ids WHERE guest_id = ids.guest
) x ORDER BY tbl, who;

-- Profile and routine names, after.
SELECT username, weight_unit, bodyweight, training_level, equipment_access, sex, birthday, weekly_target
FROM public.user_profiles WHERE user_id = '<TARGET_ID>';
SELECT name, created_at FROM public.templates WHERE user_id = '<TARGET_ID>' ORDER BY created_at;
SELECT * FROM private.guest_merges WHERE guest_id = '<GUEST_ID>';
```

Find the ids with the dev trace in Metro (`[sign-in] ...`) or with
`SELECT id, is_anonymous, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;`.

### Manual: SIMULATOR

Use a test Apple or Google account that already has a LiftCamp account with
at least one workout and one routine.

1. SIMULATOR: Settings, Start fresh. Continue as guest. Finish one workout
   with two exercises and three sets. Note the routine name onboarding
   saved. Set bodyweight in Profile if the test account has none.
2. SUPABASE (SQL editor): run the count query with the guest id and the
   test account's id. Save the output.
3. SIMULATOR: tap Start. The create-account sheet opens. Sign in with the
   test account's Apple ID.
4. SIMULATOR: expect no alert, Home on the test account, and the quiet line.
   History lists the guest's workout with its sets. Routines lists the
   renamed copy if the names clashed.
5. SIMULATOR: tap Start again. Expect a workout to start with no sheet.
6. SUPABASE (SQL editor): run the count query again and compare.
7. Mid-workout: guest starts a workout and logs one set. From Home, open
   "Create a free account" and sign in to the test account. Expect Resume on
   Home and the logged set when resumed.
8. Email path: repeat 1 to 4 with "Continue with email" to an address that
   has an account.
9. Lost response: in a dev build, make `lib/guest-merge.ts` drop the first
   response on purpose. Expect the retry to report `already_merged` and the
   same end state as step 4.
10. Merge fails: deploy a copy of the function that returns 500. Expect the
    "wasn't added yet" alert.
    - "Sign in now": the account opens without the guest workout.
    - Restore the real function, kill and relaunch the app. Expect the
      quiet line and the workout in History.
11. Offline sign-in: guest, Network Link Conditioner at 100% loss, try
    Apple. Expect the sign-in error and the guest unchanged.

---

## Deploy order

1. SUPABASE (SQL editor): `docs/guest-merge.sql`, Section 0 alone. Check
   0a lists eleven tables and 0c returns no rows.
2. SUPABASE (SQL editor): Sections 1 to 4. Check Section 4 shows
   `anon_exec` and `authed_exec` false and `service_exec` true.
3. TERMINAL: `npx supabase functions deploy merge-guest --project-ref mnsigwjyskxfuszeegtp --no-verify-jwt`
4. App build with the client changes (after approval). Until then the
   function and SQL are unused and harmless.
