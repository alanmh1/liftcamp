# First workout: starting-weight help, look before you start, first-session banner, nudges

Branch `first-workout`, in its own worktree (`~/code/liftcamp-first-workout`).
Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL.

Every change is JS only, so it ships as an OTA update. expo-notifications is
already in the native build (rest alerts), and scheduling is JS.

## Why

Since launch, 7 of 15 new people opened a workout. Between them they seeded
104 set rows, typed into 2 and ticked none. Two of them came back days later
and opened the same routine day again, so the first open was a look, not a
session. Two things in the app make that the likely outcome for a beginner:

1. A first session on any exercise has no prior, so the weight box is empty
   and the check refuses with "Enter the weight you lifted". A beginner who
   does not know what to lift has nowhere to go from there.
2. On Home, tapping Next up or a routine tile starts a workout. Anyone who
   opens the plan at home to read it leaves a dangling workout.

Nothing here hands out a generated starting weight. The starting-weight text
is the same beginner_notes paragraph every /exercises page already shows,
and the fallback is one generic paragraph. Progression guidance stays Pro.

## 1. Starting-weight help on the set row

### `apps/mobile/src/components/exercise-info-sheet.tsx`

Add a "Starting weight" section between the muscles line and the
description. When the sheet presents, read the exercise's beginner note
(`apps/mobile/src/data/exercises.ts` already selects `starting_weight_md`)
and render that markdown as plain paragraphs the way the exercise screen's
`NoteSection` does. When there is no note, render the generic paragraph for
the exercise's cold-start category (`coldStartSuggestion` in
`packages/shared/src/suggestions.ts`):

- body only: "Just your bodyweight. Log the reps you did."
- isolation: "Pick a weight you can do twelve clean reps with. If the last
  two feel easy, go up one step on the next set."
- compound, beginner (and the fallback): "Start with the empty bar or the
  lightest dumbbells, do the set, and add weight when ten reps feel easy.
  Light and clean beats heavy and sloppy on day one."
- compound, intermediate or advanced: "Work up over a couple of sets to a
  weight that makes six reps hard."

Cardio exercises get no section. Put the generic strings in
`packages/shared/src/suggestions.ts` next to `coldStartSuggestion` as
`coldStartAdvice(ex)`, with a vitest case per branch.

Add a `scrollTo?: 'starting-weight'` prop (or an imperative `presentAt`)
so the workout screen can open the sheet with that section at the top.

### `apps/mobile/src/components/workout/exercise-card.tsx` and `apps/mobile/src/app/workout/[id].tsx`

When a check is refused for an empty weight box AND the exercise has no
prior (`we.prior.length === 0`) AND no set above has a weight, the hint
under the row becomes two lines:

- line 1, as today: "Enter the weight you lifted"
- line 2, accent, tappable, 44 pt target: "Not sure what to lift? How to
  pick a starting weight"

Tapping line 2 opens the info sheet for that exercise scrolled to Starting
weight. The weight box keeps focus and the keypad stays, so the user can
type the number straight after closing the sheet. With a prior, or once any
set above has a weight, the hint is the single line it is today.

The weight box placeholder for a weightless, prior-less set stays as it
renders today; the cold-start strings are too long for the box.

## 2. Look before you start

### Home, `apps/mobile/src/app/(tabs)/(home)/index.tsx`

When `finishedCount === 0` (lifetime finished workouts, already loaded on
Home), Next up's primary action and the routine tiles push the saved-day
detail (`navHref({ kind: 'routine', id })`, the `SavedRoutineScreen` already
on Home's stack) instead of starting. The detail's own Start button starts
through `guardStart` as it does on the Workout tab. The header start pill
(empty workout), Resume, Repeat and the checklist's first-workout task are
unchanged. Once one workout is finished, Home starts directly again.

Next up's button label for that case is "See routine" instead of "Start".

### Stale empty workout, `apps/mobile/src/components/start-gate.tsx`

The pre-start check asks Resume / Discard and start when a workout is in
progress. Add a silent path first: when the in-progress workout is older
than 24 hours and has no completed set and no typed value, discard it
without asking and go on with the start. A workout someone opened to read
four days ago is not something to resume. The 24-hour rule matches the
Resume card's window in `data/home.ts`.

## 3. First-session banner on the workout screen

`apps/mobile/src/components/workout/first-session-banner.tsx` (new),
rendered in `workout/[id].tsx` under the progress bar, above the first
exercise card, for users with zero finished workouts (read
`home.getFinishedWorkoutCount(userId)` once on mount, like Home does).

- Two lines in `type.body`, no title: "Tick each set as you finish it.
  Finish whenever you're done, even after one exercise."
- Card surface, 12 pt radius, an X on the right (44 pt target). Dismissing
  writes `liftcamp:first-banner:${userId}` and removes it with the same
  fade the What's new card uses. It never shows again after a dismissal or
  after the first finish.
- No haptic, no accent fill, no icon.

## 4. Nudges

`apps/mobile/src/lib/nudges.ts` (new), built like `rest-alert.ts`: iOS
only, every call serialised and error-swallowing, identifiers prefixed so
cancel-all can find them, `data.kind` on every notification so the root
handler can tell them apart. Two kinds: `first` and `streak`.

### Permission

`ensureRestAlertPermission` asks only from the workout screen today, which
is after the moment the first nudge has to be scheduled. Add a
pre-permission step at the end of onboarding, after `finish()` or
`useRoutine()` saves and before `complete()`, as a sheet (not a page, so
the pager and dots do not change):

- Title "Turn on reminders?", one line "A nudge for your first session, and
  a buzz when a rest timer ends." Two buttons, "Turn on" (primary) and "Not
  now" (text).
- Turn on calls `ensureRestAlertPermission()` (same system prompt, same
  options) and then schedules the first-workout nudges. Not now writes
  `liftcamp:nudges:declined` and schedules nothing; the workout screen's
  own prompt is unchanged, so someone who declines here still gets asked
  for rest alerts there.
- Returning users (the re-ask flow for pre-launch accounts) skip the sheet.

Also at app launch: when the permission is granted, `finishedCount === 0`
and no `first-` notification is pending, schedule them. This covers
existing users who granted for rest alerts, and a reinstall.

### First-workout nudges (`first-1`, `first-2`)

- `first-1` at 9:00 local two days after onboarding completes; `first-2` at
  9:00 local six days after. Both cancelled on the first finish
  (`finishWorkout` in `data/workouts.ts`), on sign-out, delete account and
  Start fresh (next to `cancelAllRestAlerts` in `auth-provider.tsx`,
  `delete-account.ts`, `dev-reset.ts`).
- Copy. With a Next up routine day (read the same way Home picks it):
  - first-1: title "Your first workout is waiting", body "{Day name} is
    ready when you are. Tick a set when you've done it."
  - first-2: title "Still here when you're ready", body "One short session
    is all it takes to start. {Day name} is set up."
  Without one: body "Start a workout and tick a set when you've done it."
  for both.
- `interruptionLevel: 'active'` (never time sensitive; that is the rest
  alert's).

### Streak nudge (`streak-{weekStart}`)

Scheduled from Home every time `weekCardState` is computed (launch and
foreground), replacing the pending one for the week:

- Only when `streak.current > 0` and `remaining > 0`.
- Fire day: the first day on which every remaining day must be a training
  day, Monday plus `7 - remaining` (today if that is already past), at
  9:00 local. If that moment is in the past, schedule nothing. Trained
  today shifts nothing; the rule reads `remaining` and `daysLeft` straight
  from `weekCardState`.
- Cancelled when the week is hit (`phase` is `hit` or `over`), on sign-out,
  delete account and Start fresh.
- Copy: title "Your streak is on the line" (or "Your {three}-week streak is
  on the line" when `streak.current > 1`, `proseNumber` as the card uses),
  body the card's own ask: "One more today." / "Two more by Sunday." Move
  that ask into a shared helper in `packages/shared/src/week-card.ts`
  (`streakRiskAsk(state)`) so the card line and the nudge cannot drift, with
  a vitest case.
- One per week at most. A rest week banked and auto-applied means
  `remaining` still counts, so the nudge fires; that is fine, the streak is
  genuinely on the line without the bank.

### Root handler, `apps/mobile/src/lib/rest-alert.ts`

`installNotificationHandler` already shows non-rest notifications as
banners in the foreground. Keep that. Tapping either nudge just opens the
app; no deep link in v1.

### Android

Nothing is scheduled on Android, same as rest alerts (no channel). The
onboarding sheet is not shown there.

## Out of scope

- Generated starting weights, week 1 previews, progression chips (Pro).
- Fewer onboarding pages.
- Deep links from a notification tap.
- Any change to the summary or Finish rules; a workout with one ticked set
  already finishes.

## Checks before pushing

- `pnpm -C packages/shared test` passes (new cases for `coldStartAdvice`
  and `streakRiskAsk`).
- TypeScript compiles across the monorepo.
- Copy rules: no colons, no em dashes, spelled-out small numbers in
  app-facing strings.
