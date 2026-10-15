# Guest merge

When a guest signs in with an Apple ID, Google account or email that already
has a LiftCamp account, the guest's workouts, routines and settings move into
that account. The guest account is then deleted. Approved 1 Oct 2026.

| Piece | Where | State |
|---|---|---|
| Ledger, `merge_guest_account`, `guest_merge_record`, dry run | `docs/guest-merge.sql` | not applied |
| Edge Function | `supabase/functions/merge-guest/` (`index.ts`, `decide.ts`) | not deployed |
| Shared rules | `packages/shared/src/guest-merge.ts`, `write-queue-runner.ts` (hold, adopt) | tested |
| App | `apps/mobile/src/lib/guest-merge.ts` and the files in section 9 | typechecked |

Checked against the live database on 1 Oct 2026 (read only).

---

## Decisions

1. Merge before switching sessions, falling back to keeping the guest's
   tokens and retrying.
2. Proof of ownership: both access tokens are verified by the auth server.
   A guest token that no longer verifies is only used for a read-only
   ledger lookup.
3. A guard refuses the merge if any table still holds guest rows.
4. In-progress workouts: both move and stay in progress.
5. A guest routine identical to one of the account's is dropped, and the
   guest's workouts are pointed at the account's copy. Routines that differ
   are renamed on a name clash.
6. The email path sends the guest's queued writes before switching, as Apple
   and Google already do.

---

## 1. Before this change

Apple and Google (`native-sign-in.ts`):

1. `linkIdentity` as the guest is refused with `identity_already_exists`.
2. `sendNow()`.
3. `signInWithIdToken` on the app's client replaced the session. auth-js
   does not call `/logout`, so the guest's refresh token stayed valid on the
   server, but the phone no longer held it.

Email (`email-sign-in.ts`):

1. `updateUser({ email })` is refused with `email_exists`.
2. `signInWithOtp` sends a sign-in code.
3. `verifyOtp` with type `email` switched the session. This path never called
   `sendNow()`.

Then `link-account.tsx` and `start-gate.tsx` showed the alert.

The guest's `auth.users` row and all its rows stayed on the server where
nothing could reach them. `purge_empty_guests` skips guests with workouts or
templates, so it never removed them. On the phone, `liftcamp:queue:<guestId>`
and the guest's device workout copies were orphaned. Live today, 45 guests
hold 61 workouts and 83 templates. Past cases can't be recovered: nothing
proves who owns them.

## 2. Tables (live schema)

Eleven public tables have a key to `auth.users`, all `ON DELETE CASCADE`:

| Table | Guest writes it | Rule |
|---|---|---|
| `workouts`, `workout_exercises`, `sets` | yes | move |
| `templates`, `template_exercises` | yes (onboarding saves the chosen routine) | drop if identical, else move and rename on a clash |
| `user_profiles` | yes | account wins, guest fills nulls |
| `exercise_rest_prefs` | yes | account wins per exercise, guest fills the rest |
| `app_events` | yes (`write_failed`) | move |
| `pr_goals` | web only | account wins per exercise |
| `page_views` | web only | move |
| `user_roles` | never | never moved; a guest with a role is refused |

Onboarding writes `training_level` and `equipment_access` to
`user_profiles`; there's no separate onboarding table. Theme is stored only
on the device. Storage objects have no owner. Email tables are keyed by
address, and a guest has none.

## 3. Device keys

| Key | After a merge |
|---|---|
| `liftcamp:queue:<guestId>`, `liftcamp:queue-failed:<guestId>` | adopted by the account's queue, guest's first, user ids swapped; then removed |
| `liftcamp:workout:<workoutId>` | `userId` inside rewritten to the account |
| `liftcamp:rest:<workoutId>` | unchanged (keyed by workout) |
| `liftcamp:home:`, `unit:`, `username:`, `onboarded:`, `signup-due:`, `setup-completed-seen:` + guestId | removed |
| `liftcamp:guest-session` | cleared by the non-anonymous session, as before |
| `liftcamp:guest-merge:<guestId>` | new: the merge record, removed when done |

---

## 4. Server

`merge_guest_account(p_guest, p_target)` is `SECURITY DEFINER` and
executable by `service_role` only. It runs in one transaction:

1. Takes an advisory lock on the guest id.
2. Checks the ledger. If this pair already merged, it returns that result.
   If the guest merged into a different account, it refuses.
3. Requires the guest to exist and be anonymous, the target to exist and not
   be anonymous, the two to differ, and the guest to have no role.
4. Moves rows per section 6.
5. **Guard:** reads every key to `auth.users` from `pg_constraint` and
   raises if any table still holds a guest row, which rolls everything back.
6. Writes the ledger row and a `guest_merged` event on the account.
7. `DELETE FROM auth.users WHERE id = guest AND is_anonymous`.

`guest_merge_record(p_guest, p_target)` is a read-only ledger lookup for
the retry case.

## 5. Where `merge-guest` checks the tokens

It deploys with `--no-verify-jwt`, so the platform checks nothing. Every
check is in the function:

| Check | Code |
|---|---|
| Account token read from `Authorization: Bearer` | `index.ts:75`, `bearerToken` in `decide.ts:22` |
| Guest token read from the body | `index.ts:84`, `guestTokenFrom` in `decide.ts:28` |
| Account token verified with the auth server | `index.ts:92` → `verify` → `admin.auth.getUser` at `index.ts:67` (signature, expiry, user and session still exist) |
| Account must verify and not be anonymous | `index.ts:93`, `checkTarget` in `decide.ts:38-40` |
| Guest token verified the same way | `index.ts:97` |
| Guest id equal to the caller's id is refused (400 `same_account`), checked before anything else about the guest | `decide.ts:71` |
| Guest must be anonymous (403 `not_a_guest`) | `decide.ts:72` |
| Guest token that did not verify: never merged, only a ledger lookup for its unverified `sub` and the caller's verified id; refused if that `sub` is the caller's | `decide.ts:62-67`, `index.ts:110` |
| Only then the merge | `index.ts:129` |

The SQL checks again inside the transaction:

- the two ids differ (`guest-merge.sql:120`)
- the guest is anonymous (`:142`)
- the target is not anonymous (`:150`)
- the delete only removes an anonymous user (`:347`)

Why the unverified lookup is safe: it can only return whether this guest
was already merged into the caller's own, verified account. It never moves
or reveals anything else.

## 6. Merge rules in detail

- **Routines.** These are compared against the account's routines from
  before the merge. A guest routine is dropped when an account routine has
  the same `program_slug` and the same exercises in the same order with the
  same target sets and reps:
  - The guest's workouts are pointed at the account's copy, then the guest's
    copy is deleted. Its exercises cascade.
  - A guest routine with a share link is never dropped.
  - Every other routine moves. A name the account already uses (case and
    outer spaces ignored) becomes "Name (2)", "Name (3)", and so on.
- **Profile.** The account wins, and guest values fill only null fields.
  - `weight_unit` and `weekly_target` are NOT NULL, so the account's always
    stand.
  - Bodyweight is converted into the account's unit. Bar weight and plates
    carry over only when the units match.
  - The username fills from the guest's only if the account has none. The
    guest's row is deleted first, which frees the name.
  - If the account has no profile row at all, the guest's row moves whole.
- **In progress.** Every workout moves unchanged. Home shows the newest
  unfinished one from the last 24 hours, which is the guest's. An older one
  behaves like any abandoned workout.
- **app_events.** Moved, because they describe what this person did. Funnel
  counts by distinct user will credit the account with the guest's early
  events. No guest has events live today.

## 7. Idempotent

- The ledger row and the guest's deletion commit with the move.
- A repeat call returns `already_merged` with the first call's counts,
  either from the ledger check inside the function or from
  `guest_merge_record` once the guest token no longer verifies.
- Concurrent calls queue on the lock.
- On the phone, every step after success can run again. `adopt` of an
  emptied queue moves nothing, and queued writes are safe to send twice.
  Each guest's merge work runs one at a time (`exclusive` in
  `lib/guest-merge.ts`).

## 8. Deleting the guest

The guard proves no public row still references the guest. Its `auth`
identities and sessions cascade. Apple revoke doesn't apply: a guest has no
Apple identity and no email.

## 9. App

The flow (`apps/mobile/src/lib/guest-merge.ts`):

1. As the guest, the identity is refused as already taken. `sendNow()` runs;
   for email this is new.
2. The account is signed in on a **throwaway client** (`persistSession:
   false`). The app stays on the guest, so nothing remounts.
3. `mergeIntoExisting` saves `liftcamp:guest-merge:<guestId>` with stage
   `merging` and the account's tokens. It holds the write queue and calls
   `merge-guest` with both access tokens. If a token is refused, it
   refreshes both and tries once more.
4. On success:
   1. The guest's device workout copies are rewritten.
   2. The stage is set to `merged`.
   3. `setSession` switches to the account.
   4. `finish` runs: the account's queue adopts the guest's, the guest's
      keys and the record are removed, and the read cache is cleared.
   5. Home shows the line.
5. On failure, the alert offers two choices:
   - **Try again** reruns step 3.
   - **Sign in now** (`deferMerge`) copies the guest's tokens from the app's
     session at that moment, sets the stage to `deferred`, and switches to
     the account. The merge then retries from the account at once, on every
     foreground, and on launch.
6. If the merge succeeded but `setSession` failed, the record stays
   `merged`. Launch, foreground and the auth provider (`switchAfterLostGuest`,
   used before it would sign in a new guest) switch from the record.

A refusal that won't change (`stuck`) is reported once to `app_events` as
`guest_merge_failed`. It is retried only at launch or from Settings.

Files:

- `lib/guest-merge.ts`: the steps, the runner and the events.
- `lib/guest-merge-alert.ts`: the failure alert.
- `lib/use-pending-merge.ts`: the Settings row.
- `lib/native-sign-in.ts`, `lib/email-sign-in.ts`: the throwaway sign-in,
  plus the email `sendNow` fix.
- `app/link-account.tsx`, `components/start-gate.tsx`: no alert on success.
  The held start is still dropped, because it was built for the guest's id;
  the next tap starts as the account.
- `components/auth-provider.tsx`: the lost-session switch.
- `app/(tabs)/(home)/index.tsx`: the merged line, and a reload when a
  deferred merge lands.
- `app/settings.tsx`: a "Guest workouts / Not added yet / Try again" row.

## 10. Guest limit

`startGate` returns `start` for any non-anonymous session, and
`signUpDueOnHome` needs `isAnonymous`. Its flag is removed with the guest's
keys. Nothing else counts guest workouts.

## 11. What the user sees

- **Success:** no alert. Home shows "Your workout from this phone is in your
  account." (plural: "Your N workouts…") for 4 s, and the workout is in
  History.
- **Retryable failure:**
  - Alert title: "Your guest workouts weren't added yet"
  - Message: "They're saved on this phone. Try again now, or LiftCamp will
    try again next time you open it."
  - Buttons: "Sign in now", "Try again".
- **Refused:**
  - Alert title: "Your guest workouts couldn't be added"
  - Message: "They're still saved on this phone. Write to
    hello@liftcamp.app and we'll move them."
  - Same buttons.

## 12. Offline

- **No signal at sign-in:** the sign-in calls fail before anything changes.
- **Signal lost at the merge:** this is the retryable failure. The phone is
  still the guest, with the in-progress workout intact.
- **Response lost after the merge committed:** the retry returns
  `already_merged`.
- **Signal lost between the merge and `setSession`:** the `merged` record
  switches on the next chance, and the auth provider won't replace it with a
  new guest.

---

## Tests

### Unit (TERMINAL: `cd packages/shared && npx vitest run`)

`merge-guest-decide.test.ts` covers the Edge Function's checks:

- **`bearerToken`:**
  - reads `Bearer x`, either case.
  - refuses no header, an empty header, `Basic`, an empty token, or two
    tokens.
- **`guestTokenFrom`:** refuses a missing, empty or non-string token, and a
  body that isn't an object.
- **`checkTarget`:**
  - 401 when the account token didn't verify.
  - 403 when the account is anonymous.
  - lets a full account through.
- **`decideGuest`:**
  - merges only when the guest verified, is anonymous and is another user.
  - 400 `same_account` when the guest id is the caller's, whatever its
    anonymous flag.
  - 403 `not_a_guest` for a full account's token, or a missing flag.
  - an unverified guest token yields a ledger lookup only, never a merge.
  - 401 when it has no user id or carries the caller's own.
- **`refusalForSqlState`:**
  - 42501 → 403, P0002 → 410.
  - everything else → 500, which the app retries.
- **`unverifiedSubject`:**
  - reads a uuid `sub`.
  - null for a non-uuid or missing `sub`, a malformed token, or a payload
    that isn't JSON.

`guest-merge.test.ts`:

- **Record:** a stored record reads back unchanged; malformed records are
  refused.
- **`tokenExpired`:** the margin counts as expired.
- **`mergeStep`:**
  - each stage against guest, account, nobody and a third user.
  - a refused record is retried only at launch or by hand.
- **`classifyMergeResponse`:** done, refresh, stuck and retry, including a
  200 that isn't a merge.
- **`rekeyOps` and `rekeyFailed`:**
  - swap the guest's id in `userId` and in inserted rows only.
  - leave other users alone.
  - give the same result when run twice.
- **`prependOps`:** guest's first, numbered on from the account's
  `nextSeq`.
- **`guestKeysToRemove`:** exactly the eight guest keys, nothing else.
- **`rekeyDeviceWorkout`:** rewrites only the guest's copy.
- **`mergedLine`:** singular, plural, and nothing for zero.
- **Account deletion:** clears the merge record.

`write-queue-runner.test.ts`:

- `hold` waits for the op in flight and sends nothing until `release`.
- `adopt`:
  - puts the guest's ops first, with the account id in every row.
  - empties the guest's keys and syncs to the server as the account.
  - moves failed writes ahead of the account's.
  - does nothing with no stored guest queue.
  - adds the ops once when run twice.

### Dry run: SUPABASE (SQL editor)

`docs/guest-merge.sql` Section 5:

- **5a** is plain SELECTs and works before anything is applied. It shows,
  for one guest and one account:
  - whether each is anonymous, and the guest's role count.
  - the workouts, exercises and sets that would move, and the in-progress
    counts on both sides.
  - routines dropped as identical, renamed, or moved as they are, and their
    exercises.
  - rest prefs and PR goals moved or dropped, app events and page views.
  - whether the profile is filled or moved whole.
- **5b** runs the real function inside a `DO` block that always ends in
  `RAISE EXCEPTION`, so every change is rolled back. The result shows as the
  error text "DRY RUN, rolled back: {...}". It needs Sections 1 to 3.

### Manual test

1. **SIMULATOR (dev build):** Settings, "Start fresh as a new user". This
   signs in a new guest and opens onboarding. Finish onboarding, then one
   workout with two exercises and three sets each. Note the routine
   onboarding saved.
2. **SIMULATOR (Metro log), or SUPABASE (SQL editor):** get the guest id.
   Run `SELECT id, is_anonymous, created_at FROM auth.users ORDER BY
   created_at DESC LIMIT 3;`. The newest row with `is_anonymous = true` is
   the guest. Get the test account's id with
   `SELECT id FROM auth.users WHERE email = '<test account email>';`.
3. **SUPABASE (SQL editor):** run Section 5a with both ids. Then run the
   counts query below and save the output as BEFORE.
4. **SUPABASE (SQL editor):** run Section 5b with both ids. Expect "DRY RUN,
   rolled back:" with counts that match 5a. Run the counts query again: it
   should be unchanged from BEFORE.
5. **SIMULATOR:** tap Start. In the create-account sheet, sign in with the
   test account (Apple, Google, or email to its address). Expect:
   - no alert.
   - Home on the test account, with "Your workout from this phone is in your
     account."
   - the workout in History.
   - a routine renamed only if it differs from the account's.
6. **SIMULATOR:** tap Start. It starts with no sheet.
7. **SUPABASE (SQL editor):** run the counts query again as AFTER. Expect:
   - every guest row count is 0.
   - the guest is gone from `auth.users`.
   - the account went up by the guest's counts, minus dropped routines and
     dropped rest prefs.
   - one ledger row and one `guest_merged` event.

```sql
WITH ids AS (
  SELECT '<GUEST_ID>'::uuid AS guest, '<TARGET_ID>'::uuid AS target
)
SELECT who, tbl, n FROM (
  SELECT 'guest' who, 'auth.users' tbl, count(*) n FROM auth.users, ids WHERE id = ids.guest
  UNION ALL SELECT 'guest', 'workouts', count(*) FROM public.workouts, ids WHERE user_id = ids.guest
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
  UNION ALL SELECT 'target', 'app_events guest_merged', count(*) FROM public.app_events, ids WHERE user_id = ids.target AND name = 'guest_merged'
  UNION ALL SELECT 'guest', 'user_profiles', count(*) FROM public.user_profiles, ids WHERE user_id = ids.guest
  UNION ALL SELECT 'ledger', 'guest_merges', count(*) FROM private.guest_merges, ids WHERE guest_id = ids.guest
) x ORDER BY tbl, who;
```

Run BEFORE only after Section 1 exists, because it reads
`private.guest_merges`. Otherwise drop the last line.

Further cases:

8. **Email path:** repeat 1 to 7 with "Continue with email" to the test
   account's address.
9. **Mid-workout:** as a guest, start a workout and log a set. Then from
   Home, "Create a free account", and sign in to the test account. Expect
   Resume on Home, with the set there when resumed.
10. **Failure:** before deploying the real function, deploy a copy that
    returns 500.
    - Expect the "weren't added yet" alert. "Try again" shows it again.
    - "Sign in now" opens the account without the guest workout, and
      Settings shows "Guest workouts: Not added yet".
    - Deploy the real function. Bring the app to the foreground. Expect the
      Home line, the workout in History, and the Settings row gone.
11. **Offline sign-in:** as a guest, set Network Link Conditioner to 100%
    loss and try Apple. Expect the sign-in error, with the guest unchanged.

---

## Deploy order

1. **SUPABASE (SQL editor):** `docs/guest-merge.sql` Section 0 alone. 0a
   should list eleven tables and 0c should return no rows.
2. **SUPABASE (SQL editor):** Sections 1 to 4. Section 4 should show
   `anon_exec` and `authed_exec` false and `service_exec` true.
3. **SUPABASE (SQL editor):** Section 5 for a test pair (dry run).
4. **TERMINAL:** `npx supabase functions deploy merge-guest --project-ref mnsigwjyskxfuszeegtp --no-verify-jwt`
5. A new app build with this branch. Builds without it never call the
   function.
