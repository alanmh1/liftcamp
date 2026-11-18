# Onboarding fork + training schedule reminders

Branch `onboarding-fork`, in its own worktree (`~/code/liftcamp-onboarding-fork`).
Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL.

JS only. expo-notifications is already in the native build, so this ships as
an OTA update once `docs/onboarding-schedule.sql` has been run in Supabase.

Mockups: the "LiftCamp onboarding: training schedule + reminders" canvas
(Alan has it). This spec is the source of truth where they differ.

## Why

Since launch (13 Oct, dev traffic excluded) 34 new profiles: 13 picked
beginner, 6 intermediate, 1 advanced, 14 never answered. One finished a
workout. The level answer changes almost nothing on screen, and the only
notification ask comes at the very end of onboarding, after most people have
already left (onboarding pages: target 23, prefs 16, routines 13).

Two changes:

1. Replace the three-way experience question with a two-way fork, "Have you
   lifted before?", where each answer leads somewhere different.
2. Replace the weekly target page with a training schedule (days plus a time
   window). The iOS notification prompt fires right after it, and reminders
   go out on the days the user picked.

## New page order

Logical pages, as `PAGE_NAMES` and the funnel name them:

| # | Page | Event name | Who sees it |
|---|---|---|---|
| 0 | Welcome | none | new accounts (unchanged) |
| 1 | Have you lifted before? | `fork` | new accounts |
| 2 | When do you usually train? | `schedule` | everyone |
| 3a | Where do you train? | `prefs` | new lifters; experienced lifters who choose Pick a routine |
| 3b | How do you want to start? | `start` | experienced lifters |
| 4 | Your plan (new) / routine list (experienced) | `routines` | anyone who reaches it |

New lifter: 0 → 1 → 2 → 3a → 4 (plan view).
Experienced: 0 → 1 → 2 → 3b → then one of
- Import: finish onboarding onto Home, which opens `/import` (the existing
  `requestImportOnHome` path), entry `onboarding`.
- Pick a routine: 3a → 4 (list view, all levels).
- Just log: finish onboarding onto Home with no routine (`how: 'skip'`,
  `start: 'empty'`).

Returning users (account with finished workouts) keep today's shape minus
the level question: they open on page 2 (schedule) with `RETURNING_LEAD`,
then 3a, then 4 in list view, ranked on their saved level (beginner if none).
They never see the fork or the start page.

The pager is a horizontal ScrollView of fixed pages today. Because the two
paths have different pages, render only the pages on the current path (the
fork answer decides) and keep the logical-to-physical index mapping in one
helper, the way `skip` does now. Swiping must never land on a page from the
other path. The dots count the current path's pages.

Skip stays on every page after the welcome and behaves as today: finish onto
Home with whatever is answered so far.

## Page 1. Have you lifted before?

Title "Have you lifted before?" Subtitle "We'll set things up differently
depending on your answer."

Two full-width option cards, single select, nothing preselected. Use the
target page's selected/unselected styling (accentSoft fill and accent border
when selected, surface2 otherwise). Each card has a 64 pt art square on the
left (leave a neutral placeholder square for now; Alan will supply clay art),
a title, and one line:

- "I'm new to this" / "We'll pick a routine, suggest starting weights and
  walk you through your first session."
- "I already lift" / "Bring your history from Hevy, Strong or Fitbod, pick
  any routine, or just start logging."

Continue is disabled until one is picked. On Continue, write
`training_level` right away with `setTrainingPrefs`: new → `beginner`,
experienced → `intermediate`. This matters beyond ranking, since
`onboarding-state.ts` treats a non-null `training_level` as onboarded. The
signal now lands on page 1 instead of page 3.

## Page 2. When do you usually train?

Replaces the weekly target page and its `DAYS_HINTS` rows.

- Title "When do you usually train?" Subtitle "We'll send one reminder on
  those days. Change it anytime in Settings."
- Label "Days", then seven 44 pt circular toggles, M T W T F S S (Monday
  first), multi-select. Preselect nothing for a new account; for a returning
  account preselect `training_days` if set.
- Under the days, one line, live: "Three days a week" (number spelled out
  per the copy rules below), or "Pick the days you usually train" when none
  are picked.
- Label "Around what time?", then three equal segments, single select,
  default Evening: Morning "before 11", Midday "11 to 3", Evening "after 3".
- Gold tip note (the shared `TipNote`): "Starting out, two or three days a
  week is plenty. You can add more later."
- Primary button. With days picked: "Remind me Mon, Wed, Fri" for up to
  three days, "Remind me four days a week" for more (number per the
  copy-numbers rule). With none picked the button reads "Continue" and is
  disabled.
- Text button under it, "Not sure yet".

Continue with days:
1. Write `training_days` (sorted ISO weekday numbers), `training_time`, and
   `weekly_target` = number of days, clamped to 2..5 to stay inside
   `WEEKLY_TARGET_OPTIONS` (one day saves target 2, six or seven save 5).
2. On iOS, if permission is undetermined, call `ensureRestAlertPermission()`
   (the system prompt). In dev builds always call it, as `offersReminders`
   does today. Do not block the pager on the answer; move to the next page
   once the prompt resolves.
3. Mark the reminders question answered for this onboarding so the end-of-
   onboarding reminders sheet never shows.

"Not sure yet": write `training_days = '{}'`, `training_time = null`, leave
`weekly_target` at its default (3), no prompt, move on. These users keep the
end-of-onboarding "Turn on reminders?" sheet and the existing first-workout
nudges exactly as today.

## Page 3a. Where do you train?

Today's page 3 with the Experience row removed. Title "Where do you train?"
Subtitle "We'll match routines to what you can train with." Keep
`EquipmentTiles`. Continue writes equipment with `setTrainingPrefs` and goes
to page 4.

## Page 3b. How do you want to start? (experienced only)

Title "How do you want to start?" Subtitle "You can do the others later."

- Section label "Bring your history", then three equal tiles: Hevy, Strong,
  Fitbod (name plus a neutral icon square). Any tile: `requestImportOnHome()`
  then finish with `how: 'skip'`, `start: 'import'`, same as today's
  `onImport`. If `/import` can take a preselected source, pass it; if not,
  do not build that now.
- One line under the tiles: "Your workouts, PRs and streak medals come with
  you."
- Section label "Or", then a grouped list with two rows, chevron on the
  right:
  - "Pick a routine" / "Every routine, including intermediate and advanced"
    → page 3a, then page 4 in list view.
  - "Just log my own workout" / "Start empty, save it as a routine after"
    → finish with `how: 'skip'`, `start: 'empty'`.

## Page 4. The routines

### Plan view (new lifters)

Title "Here's your plan". Subtitle built from the answers: "Built for three
days a week at a full gym." (equipment phrase from `matchHeading`'s kit
words; days from `weekly_target`; spelled-out number).

One large card for `rankPrograms(...)[0]`: routine art on top
(`routineArtByProgram`), a small "Best match" eyebrow, the routine name, one
meta line ("Mon, Wed, Fri · 5 exercises · about 45 min" when a schedule
exists, otherwise "3 days a week · 5 exercises"; use whatever duration
estimate the routine tiles already use, or drop the duration if none
exists), and three check rows:
- "Starting weights suggested for every lift"
- "How-to for each exercise, in the workout"
- "Reminder Wednesday evening" (the first planned day and window; leave this
  row out when there is no schedule or no notification permission)

Primary button "Use this plan" → `useRoutine(recommended)`. Tapping the card
opens `RoutineDetailSheet` as today.

Text button "See other routines" switches the page to the list view below
(state on the page, not a new route). Back from the list view returns to the
plan view.

Keep the "Switching from Fitbod, Strong or Hevy? Import your workouts" link
at the bottom of the plan view.

### List view (See other routines, and experienced lifters)

Title "Pick a routine". Subtitle "Filtered to what you told us. Tap a filter
to change it."

Filter chips in a wrapping row, prefilled on:
- equipment chip, labelled with the kit word ("Full gym", "Dumbbells", "No
  equipment", "Bands"), when equipment is set
- days chip, "3 days", from `weekly_target`
- level chip, "Beginner" for new lifters. Experienced lifters get no level
  chip (they see every level).

A selected chip is filled (text color background, white text); tapping it
turns that filter off (outline style, label prefixed "+ "). Tapping again
turns it back on.

Content, from `rankPrograms` over all system templates (pass the level only
when the level chip is on; pass `level: null` otherwise but do not drop
`hide_from_onboarding` programs for experienced lifters, which means the
pool for them is every system template):
- Section "Fits N days a week": programs whose `days_per_week` equals the
  target, filtered by the equipment chip when on. When the days chip is off,
  the section is "Best matches" and takes everything.
- Section "Fewer days": programs with fewer days per week than the target,
  same equipment filter. Hidden when empty or when the days chip is off.
- Render with the existing `RoutineGrid` (2 columns). Mark the current plan
  with the existing `recommended` prop.
- Equipment filtering: a program matches when its `equipment` is the chip's
  value, except that a full gym also matches `dumbbells` and `bodyweight`
  programs (a gym has both). Put this in shared as
  `equipmentFits(program, access)` with tests.

Bottom: outline button "Browse all routines" clears every chip.

Tapping a tile opens `RoutineDetailSheet`; its Use routine does what it does
today. The page's primary button is gone in list view (choosing happens from
the detail sheet).

## Reminders on planned days

New nudge kind `planned`, identifiers `nudge-planned-<YYYY-MM-DD>`, in
`apps/mobile/src/lib/nudges.ts` with the pure parts in
`packages/shared/src/nudges.ts` (tested).

Window start times, shared constants: morning 07:30, midday 11:30, evening
17:00, local time.

Scheduling rule: rolling, from the last time the app was opened.
- `schedulePlannedNudges({ userId, days, time, dayName, finishedCount,
  trainedToday })` cancels every pending `nudge-planned-*` and
  `nudge-pause`, then schedules one for each planned day in the next 7
  calendar days (today included only if the window start is still ahead and
  `trainedToday` is false), and one `nudge-pause` at the window time on
  day 8. Nothing without permission. Nothing when `days` is empty or null.
- Call it from Home's first load that reached the server, next to
  `ensureFirstNudges`, and again after Settings changes the schedule. Since
  every app open pushes the window forward, a user who stops opening the app
  gets at most a week of reminders and then one pause notice, which is the
  "stop after about a week of silence" rule without any open tracking.
- On a finished workout (`finishWorkout`, where `cancelFirstNudges` runs
  today) cancel today's `nudge-planned-<today>`.
- With a schedule, the planned reminders replace the first-workout nudges:
  `ensureFirstNudges` and `scheduleFirstNudges` do nothing when the profile
  has non-empty `training_days`, and `schedulePlannedNudges` cancels any
  pending `nudge-first-*`.
- Streak nudge: when a planned reminder already falls on the streak nudge's
  day, skip the streak nudge and give that day's planned reminder the streak
  copy instead (`streakNudgeContent`).
- `cancelAllNudges` already covers everything with the `nudge-` prefix.
- iOS only, like the other nudges. Leave a TODO where Android would hook in
  once the android-notifications branch merges.

Copy (no colons, no em dashes, small numbers spelled out):
- No finished workout yet: title "Your first workout is today", body
  "{dayName} is ready. Tap to open it." Without a day name: "Start a
  workout and tick a set when you've done it."
- After the first finish: title "{dayName} is up next", body "It's one of
  your training days. Tap to start." Without a day name: title "It's a
  training day", body "Tap to start a workout."
- Pause: title "We'll pause your reminders", body "Your plan is saved. Open
  LiftCamp whenever you're ready to pick it back up."

Tapping a `planned` notification: add a notification response listener
(none exists yet) in the root layout. For `data.kind === 'planned'`, route
to Home and open the Up next routine's detail sheet, the same thing Home
does for a user with no finished workout. Other kinds keep today's behavior
(open the app). Handle the cold-start case with
`Notifications.getLastNotificationResponseAsync()`.

## Settings › Training

Add two rows to the Training group, in the existing one-row-per-field style
with the value in accent text as the tap target, above Weekly target:
- "Training days", value "Mon, Wed, Fri" or "Not set". Opens a sheet with
  the same seven toggles and a Save button. Saving writes `training_days`
  and sets `weekly_target` to the clamped count, then reschedules.
  Clearing every day is allowed and turns reminders off.
- "Usual time", value "Morning", "Midday" or "Evening", or hidden when no
  days are set. Opens a pick sheet like Experience. Saving reschedules.

Editing Weekly target by itself does not touch `training_days`.

Update the group footer to: "Your days and time set your reminders.
Experience and equipment choose the starter routines on Home."

## Analytics

- `onboarding_page` gains page names `fork`, `schedule` and `start`.
  `target` is no longer sent. Keep `prefs` and `routines`.
- `onboarding_finished` props gain `path` (`new` | `experienced` |
  `returning`), `start` (`import` | `routine` | `empty` | `skip`, for the
  experienced path; null otherwise), `schedule` (`days` | `not_sure` |
  `skipped`) and `days` (count or null). Keep `how`, `returning`,
  `device_id`.
- Add these props to the comment block in `lib/analytics.ts`.
- Do not touch `admin_funnel()` or the /admin page in this branch.

## Data layer

- `packages/shared/src/database.types.ts`: add `training_days: number[] |
  null` and `training_time: string | null` to `user_profiles` Row, Insert and
  Update.
- `apps/mobile/src/data/home.ts`: `getTrainingSchedule(userId)` and
  `setTrainingSchedule(userId, { days, time })` (the latter also writes the
  clamped weekly target when days are non-empty). Include the two columns
  in the Settings profile read.
- Shared: `TRAINING_TIMES`, `TrainingTime`, `isTrainingTime`, the window
  start constants, `scheduleSummary(days)` ("Mon, Wed, Fri"),
  `weeklyTargetForDays(n)`, `equipmentFits`, and the planned-nudge date and
  copy helpers, all with tests next to the existing ones.

## Copy rules

App copy has no em dashes and no colons. Spell out small numbers and
ordinals with `proseNumber` and friends in `copy-numbers.ts`. The app says
"routine", never "program".

## Out of scope

- Prefilling the schedule from imported history.
- Clay art for the fork cards and the import tiles (placeholders for now).
- Any /admin or SQL function change.
- Android notifications.
