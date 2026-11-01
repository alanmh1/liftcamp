# Funnel analytics: first-open and onboarding events, plus a Funnel section on /admin

Branch `admin-funnel`, in its own worktree (`~/code/liftcamp-admin-funnel`).
Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL: Alan
runs `docs/funnel-admin.sql` in the Supabase SQL editor before this ships,
so the `install_events` table and `admin_funnel()` exist by the time the
code is reviewed.

Every mobile change is JS only, so the mobile half ships as an OTA update.
The web half ships on the next Vercel deploy after merge.

## Why

The admin page counts users and workouts but cannot answer where new users
drop off. The funnel today has three dark segments: App Store download to
first open, first open to Get started (the anonymous user is only minted
when Get started is tapped, so an install that bounces off the welcome page
leaves no trace anywhere), and the onboarding pages themselves. Workout
stages are already answerable from `workouts` and `sets`, so no events are
added for those.

## Data model (already created by docs/funnel-admin.sql; do not write SQL)

- `public.install_events`: pre-auth, one `app_opened` row per install.
  Insert-only for `anon` and `authenticated`; unique on `(device_id,
  name)`; no select policy.
- Onboarding events go to the existing `public.app_events` under the
  signed-in (anonymous or not) user: `onboarding_page` with props
  `{ page, returning, device_id }` and `onboarding_finished` with props
  `{ how, returning, device_id }`.
- `public.admin_funnel(_since timestamptz default null)` returns the jsonb
  the admin section reads. Shape below in the web half.

Add `install_events` (table) and `admin_funnel` (function, `Args: { _since?:
string | null }`, `Returns: Json`) to
`packages/shared/src/database.types.ts` by hand, matching the SQL.

## Mobile

### 1. `apps/mobile/src/lib/install-id.ts` (new)

- A device id UUID stored in AsyncStorage under `liftcamp-install:id`. The
  key is deliberately outside the `liftcamp:` prefix so dev Start fresh
  (which clears `liftcamp:` keys) keeps it. Generate with a small local
  uuid4 helper (Math.random is fine for analytics); do not add a native
  module, this must stay OTA-eligible.
- `export async function getInstallId(): Promise<string>` reads or creates
  it.
- `export async function logFirstOpen(): Promise<void>`:
  - No-op when `__DEV__` (mirrors `dev-user.ts`, which exists because dev
    builds pollute counts; install rows have no user to exclude by, so dev
    writes nothing at all here).
  - No-op once the local flag `liftcamp-install:opened` is set.
  - If `supabase.auth.getSession()` already has a session, set the flag and
    return WITHOUT inserting. An existing user updating to this build is
    not a new install; without this check the first OTA push would log one
    `app_opened` per existing device on the same day and bury the real
    numbers. A fresh install, or a reinstall by an existing user, has no
    stored session on first open and does insert, which is what we want
    counted.
  - Otherwise upsert into `install_events`:
    `{ device_id, name: 'app_opened', props: { platform: Platform.OS,
    app_version } }` with `{ onConflict: 'device_id,name',
    ignoreDuplicates: true }`, no `.select()`. Reuse the `app_version`
    helper already in `apps/mobile/src/data/workouts.ts` (export it if it
    is not exported). On success, or on a unique-violation error, set the
    flag. Any other error: swallow, leave the flag unset so the next
    launch retries. Never throw.
- Call `void logFirstOpen()` once from the root layout's mount
  (`apps/mobile/src/app/_layout.tsx`).

### 2. `apps/mobile/src/lib/analytics.ts` (new)

Model it on `apps/web/src/lib/analytics.ts`, which this repo already treats
as the reference for fire-and-forget `app_events` writes (read it first;
keep its two deliberations: no `getUser()` network call, and no signed-up
event). Mobile version:

- `setAnalyticsUser(userId | null)` called from
  `apps/mobile/src/components/auth-provider.tsx` on every auth state
  change, with a `getSession()` fallback inside `track`.
- `EVENTS = { onboardingPage: 'onboarding_page', onboardingFinished:
  'onboarding_finished' }`.
- `track(name, props)` inserts into `app_events`, never throws, no-ops
  with no user. Unlike install-id, this DOES run in `__DEV__`: dev users
  carry a `dev_user` row, so `admin_funnel()` already excludes them, and
  firing in dev lets Alan watch rows appear from the Simulator.

### 3. Onboarding instrumentation (`apps/mobile/src/app/onboarding.tsx`)

Logical pages are welcome (0), target (1), prefs (2), routines (3). The
welcome page is pre-auth and gets no event; `app_opened` plus the account's
`created_at` (minted by Get started) already bracket it.

- When the logical page in view becomes 1, 2 or 3 and a session exists,
  `track('onboarding_page', { page, returning, device_id })` where `page`
  is `'target' | 'prefs' | 'routines'`, `returning` is the screen's
  existing `returning` flag, and `device_id` is from `getInstallId()`
  (resolve it once on mount). Fire on both `goTo` and swipe
  (wherever `page` state is set), deduped per mount with a `Set` so
  swiping back and forth logs each page once. For a returning user the
  first page is 1 at mount; log it then too.
- The Get started path: `onGetStarted` signs in anonymously and then goes
  to page 1, so the page-change path fires the first event; nothing extra
  needed there.
- `finish()` gains a `how: 'routine' | 'skip'` argument:
  `useRoutine` passes `'routine'`, `onSkip` passes `'skip'`. Before
  `complete()`, `track('onboarding_finished', { how, returning,
  device_id })`.
- Do not await any `track` on a user-facing path.

## Web: Funnel section on /admin (`apps/web/src/routes/admin.tsx`)

New section between "Workouts, last N days" and "Site traffic", heading
"Funnel". Match the existing section conventions exactly (font-display h2,
same card/table/muted-text classes, `useQuery` keyed like the others,
loading and error states like the neighbours).

Range control: three pills like the existing `days` toggle, labelled
"Since launch", "30 days", "7 days". Since launch passes `_since: null`
(the function defaults to 13 Oct 2026); the others pass an ISO timestamp
`now - 30d` / `now - 7d`. One `supabase.rpc('admin_funnel', { _since })`.

Response shape:

```
{
  since: string,
  installs: { total: number, recorded_from: string | null },
  cohort: {
    accounts, guests, onboarded, started_workout, logged_set,
    finished_workout, second_workout, signed_up,
    week2_eligible, week2_return,
    median_hours_open_to_first: number | null
  },
  onboarding: {
    target, prefs, routines, finished_routine, finished_skip,
    recorded_from: string | null
  },
  daily: { day: string, installs: number, accounts: number }[]
}
```

Render, top to bottom:

1. **Stage table.** Rows, in order: Opened the app (`installs.total`),
   Tapped Get started (`cohort.accounts`), Finished onboarding
   (`onboarded`), Started a workout (`started_workout`), Logged a set
   (`logged_set`), Finished a workout (`finished_workout`), Second workout
   (`second_workout`). Columns: stage, count, % of the previous row
   (first row has none; a 0 previous shows an en dash like `fmtDate`'s
   empty state). Below the table, two muted stat lines: "Week 2 return:
   X of Y eligible" and "Median open to first workout: N h" (hide when
   null), and "X of Y accounts have a sign-in" from `signed_up` /
   `accounts`.
2. **Onboarding dropoff.** Small table in the same style: Welcome
   (= Opened the app), Weekly target (`target`), Level and equipment
   (`prefs`), Routine picks (`routines`), Finished (`finished_routine +
   finished_skip`, with "N chose a routine, N skipped" as a muted
   sub-line).
3. **Daily chart.** recharts BarChart like the workouts chart, two series
   per day: installs and new accounts.
4. **Caveat line** (muted, under the section): installs and onboarding
   are recorded from `recorded_from` onward while workout stages cover
   the whole range. When `recorded_from` is null say "not recorded yet;
   ships with the next app update". Format dates with the existing
   `fmtDate`.

The expected early state is lots of zeros: the RPC exists before any app
build emits events. The section must render sensibly with
`installs.total === 0` and all onboarding counts 0.

## Out of scope

- No events for workout start, sets or finish; those stages come from the
  domain tables inside `admin_funnel()`.
- No App Store Connect download numbers; ASC stays the source for units,
  and "Opened the app" is compared against it by eye.
- No changes to `docs/funnel-query.sql`; it stays the deeper manual tool.

## Checks before pushing

- `pnpm -C apps/web build` (or the repo's typecheck script) passes.
- `pnpm -C packages/shared test` still passes.
- TypeScript compiles across the monorepo with the hand-added
  `database.types.ts` entries.
