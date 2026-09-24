# LiftCamp mobile: Setup checklist on Home

Branch `setup-checklist`, off main. Never merged by the session that built it.

DATABASE RULE: read-only queries only. Alan runs `docs/setup-checklist.sql`
himself before this is built. It adds `user_profiles.invited_friend_at` and
`user_profiles.setup_hidden_at`, both nullable timestamptz.

No new native dependencies. Stage files by explicit path. Never
`git add -A` or `git add .`.

## Read first

- `apps/mobile/src/app/(tabs)/(home)/index.tsx`
- `apps/mobile/src/components/home/` (every file, for card styling)
- `apps/mobile/src/data/home.ts` (`getBodyProfile`, the Home loaders)
- `apps/mobile/src/app/link-account.tsx`
- `apps/mobile/src/app/settings.tsx`
- `apps/mobile/src/components/exercises/strength-level-section.tsx`
- `apps/mobile/src/theme/tokens.ts`

## REPORT FIRST

Stop and report before building if:

1. Home's loader can't add the body profile and the two new columns to
   its existing `Promise.all` without a second round trip to
   `user_profiles`. Say what you'd do instead.
2. `Share.share` on iOS in this React Native version does not return
   `action: 'sharedAction'` when the user picks a target, or returns it
   when they cancel.

## What it is

A card on Home that walks a new user through five steps, with a progress
bar. It sits directly under the "Start new workout" button, above
Routines. It disappears for good once every step is done or the user hides
it.

## The five tasks, in this order

| # | Title | Subtitle | Done when | Tap does |
|---|---|---|---|---|
| 1 | Save your workouts | Add Apple or Google so they're on your next phone | The user is not anonymous | Push `/link-account` |
| 2 | Log your first workout | Any routine, or start an empty one | `finishedCount >= 1` | Scroll Home to Routines |
| 3 | See your strength level | Add your sex and bodyweight | `sex` is not null and `bodyweight` is not null | Push `/settings` |
| 4 | Save a routine | Tap Use on any starter routine | The user has at least one template of their own (`mine.length >= 1`) | Push `/routines` |
| 5 | Invite a friend | Lifting is easier with company | `invited_friend_at` is not null | Open the share sheet (below) |

A user who signed in with Apple or Google from the start has task 1 done
on day one, so most people open the card at 20% or more. That's
deliberate.

## The card

- Card surface per the elevation rule (elevated, shadow).
- Header row: "Get set up" in `type.exerciseName` on the left, "Hide" as a
  text button on the right in `c.accentText`.
- Under it, "2 of 5 done" in muted meta text and a progress bar, 6 pt tall,
  full card width, rounded, filled in the accent colour, track in
  `c.border`. The fill animates when the count changes.
- Five task rows. Each row has a 22 pt circle on the left, the title and
  subtitle, and a chevron on the right when not done.
  - Not done: empty circle with a `c.border` outline, title in `c.text`,
    subtitle in `c.text2`. The whole row is the tap target.
  - Done: circle filled in the accent with a white checkmark, title in
    `c.text3` with no subtitle, not tappable.
- Done tasks stay in their place in the list, so the list never jumps.

### Finishing

When the fifth task completes while the card is on screen, the card
switches to a done state for that visit: a check, "You're all set", and
"Nice work. Your first week starts now." It is not shown on the next load.
No confetti here; that stays on the workout summary.

### Hide

"Hide" asks with a native alert, "Hide setup?", "Everything on this list is
still in the app.", buttons Cancel and Hide. Hide writes
`setup_hidden_at = now()` and removes the card.

## The existing "Save your workouts" row

Home already shows a "Save your workouts" row for anonymous users. While
the checklist is visible, don't show that row, since task 1 covers it.
Once the checklist is gone (done or hidden), the row comes back for anyone
still anonymous.

## Invite a friend

Tapping task 5 calls `Share.share` with:

- `message`: "I'm tracking my lifting with LiftCamp. It's free and it's
  built for people just starting out. https://liftcamp.app"
- `url`: `https://liftcamp.app` (iOS shows a link preview)

If the result's `action` is `sharedAction`, write
`invited_friend_at = now()` and mark the task done. A dismissal changes
nothing. iOS can't tell us whether the message was actually sent, so this
is the best signal available.

## Data

`data/home.ts`:

- The Home loader returns, alongside what it has now: `isAnonymous` (from
  the session, not the DB), `sex`, `bodyweight`, `invitedFriendAt`,
  `setupHiddenAt`.
- `setupTasks(input)` in `packages/shared/src/setup-checklist.ts` (new,
  with tests) takes those values plus `finishedCount` and `mineCount` and
  returns the five tasks with `done` flags, the done count and a `visible`
  flag (false when hidden or all five done).
- `markInvited(userId)` and `hideSetup(userId)` write the two timestamps.
- Home refetches on focus already, so coming back from Settings or
  link-account updates the card.

Tests: all false for a fresh anonymous user; task 1 done for a
non-anonymous user; task 3 needs both sex and bodyweight; `visible` is
false when hidden or all done.

## Copy

No em dashes and no colons in app copy.

## Verify

1. Start fresh as a new user (Developer section in Settings). Home shows
   the card at "0 of 5 done", under Start new workout, and the old "Save
   your workouts" row is gone.
2. Tap each task and confirm where it goes. Finish a workout, set sex and
   bodyweight, save a starter routine: each ticks off when you return to
   Home, and the bar grows.
3. Invite: cancel the share sheet, task stays open. Share to Messages or
   Notes, task ticks.
4. Link Apple or Google: task 1 ticks. With all five done, the "You're
   all set" state shows, then the card is gone on the next visit.
5. On a second fresh user, tap Hide and confirm. The card is gone, and the
   old "Save your workouts" row is back.
6. Shared tests pass; mobile typechecks.
