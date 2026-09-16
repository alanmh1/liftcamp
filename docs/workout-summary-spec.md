# LiftCamp mobile: post-workout summary and share cards

The largest session so far. Read all of it before starting.

## Why this exists

Finishing a workout currently calls `router.dismissTo('/')` and drops the user on Home with nothing. That is a flat ending to the one thing the app is for.

This screen is also LiftCamp's first distribution mechanic. A workout card someone posts carries the app to people who have never heard of it. The share layer is not decoration on a stats page; it is the reason the screen exists, and the layout is built around the card rather than the other way round.

## Branch and workflow

TERMINAL. Branch `workout-summary` off main. Commit and push. Do not merge.

Database rule: read-only queries only. No INSERT, UPDATE, DELETE, ALTER, CREATE from you. The schema change this needs has already been applied by Alan; see below.

**This session is not JS-only.** It adds two native modules, so it needs a new EAS dev build before anything can be tested on device. That is expected. Do not work around it with `react-native-svg`'s `toDataURL`, which was considered and rejected: composing every card in raw SVG makes text layout painful and the cards are the part that has to look right.

Report before building on the two REPORT FIRST items.

## Already done outside this repo

- `user_profiles.username` exists: text, unique on `lower(username)`, with a check constraint `^[a-z][a-z0-9_]{2,19}$`. All 16 existing rows are backfilled.
- The Meta App ID for Instagram Stories is **not yet obtained**. Build the Stories button, read the ID from a constant that is currently empty, and hide the button when it is empty. Do not block on it.

## New dependencies

```
npx expo install react-native-view-shot expo-sharing
```

`react-native-view-shot` captures a component as an image. `expo-sharing` opens the system share sheet with that file.

Do not add `expo-media-library`. Saving to the camera roll needs a permission string and a separate consent flow, and the system share sheet already offers Save Image.

Report the resulting `app.json` and `Info.plist` changes before building, including the `LSApplicationQueriesSchemes` entry for `instagram-stories`.

## Part 1: usernames in the app

**Generation.** A new `user_profiles` row needs a username. Derive it from the email local part: lowercase, strip to `[a-z0-9_]`, truncate to 20. If the result is empty, fails the shape check, or the user has no email (anonymous), use `lifter` plus digits. On a unique violation, retry with a fresh suffix rather than pre-checking, because a pre-check races.

This must match the backfill that already ran. Read `docs/username.sql` in the repo for the exact rules.

**Editing.** Two places, one component.

In Profile, a row showing the current username that opens an editor.

On the summary screen, next to the card preview, showing `@username` with a tap to edit. This placement is deliberate and not optional. The backfill derived usernames from email local parts, so real users currently carry names like `jacobdsampson` and `tracystevanov`. Someone about to post an image publicly should see the name that is on it beforehand rather than discover it afterwards.

Validation in the editor mirrors the database constraint: 3 to 20 characters, lowercase letters, digits and underscore, starting with a letter. Lowercase the input as they type rather than rejecting capitals. Show the taken case as a normal inline error, not an alert.

## Part 2: the summary screen

**Where it goes.** `onFinish` in `apps/mobile/src/app/workout/[id].tsx:420` currently calls `data.finishWorkout(workout.id)` then `router.dismissTo('/')`. Route to the summary instead, passing the workout id, and let the summary's Done go to Home. The pending-sets confirmation alert stays exactly as it is.

New route, full screen, presented so there is no way to swipe back into the finished workout. Done is the only exit.

**Content, top to bottom.**

Headline from the approved list, rotating: "Nice one.", "Another one!", "Boo-yah!", "Get in!", "Beautiful.", "Done and dusted.", "In the books." Never "Chalk it up", which was explicitly rejected.

Under it, the workout count. "Your 1st workout", "Your 12th workout". `getFinishedWorkoutCount` in `data/home.ts` gives the number. For someone in their first six months this is the motivating figure, which is why it sits above the stats rather than among them.

Then the card carousel, swipeable, page dots. This is the centrepiece. Three cards, described in Part 3.

Then `@username` with a tap to edit.

Then the share row: the system share sheet, and the Stories button when the Meta App ID is set.

Then Done.

**Confetti.** Fires automatically on mount, no button.

- Workouts 1 to 3: always.
- After that: when the session completes the weekly target, or contains a personal record on a compound lift.

`exercises.mechanic` already distinguishes `compound` from `isolation`, so a squat PR fires and a lateral raise PR does not. Early on almost every workout contains PRs, which is why the compound filter matters.

Use `react-native-reanimated`, already installed. Under a second, non-blocking, no interaction required to dismiss it. Nothing about the screen should wait on the animation.

REPORT FIRST: say how you plan to get PR data here. The history screen already computes this, and the two must agree. `getPrSetIds` in `data/history.ts` returns every PR set id for the account in one pass. Reuse it rather than writing a second calculation. If you think a workout-scoped version is needed for speed, say so before building it.

## Part 3: the three cards

Each card is a fixed-aspect component rendered offscreen at share resolution and onscreen at preview size. Square, 1080 by 1080, which posts cleanly everywhere.

Every card carries the LiftCamp mark, `@username`, and `@liftcamp.app` in the same position, so an image posted from any of the three is recognisable as the same app.

**Card 1, stats.** Workout name, date, then Duration, Volume, Sets. Same three as the detail screen, so the numbers agree. `formatDuration` from shared, `setVolume` for volume, completed sets only.

**Card 2, exercise list.** Each exercise with its set count, in position order. "4x Bench Press (Barbell)". Truncate past eight exercises with a "and 3 more" line rather than shrinking the type.

**Card 3, volume comparison.** "You lifted 18,140 lbs" and then the comparison line. The object table is in `docs/volume-comparisons.md`; read it and implement the rules at the bottom of that file. Pick the heaviest entry at or below the session volume, so the line always reads as an achievement. Below 400 lb, skip this card entirely rather than reaching for something tiny.

Store the thresholds in pounds and convert for kg users at display time. The unit label comes from `useWeightUnit`, same as everywhere else.

## Part 4: capture and share

`react-native-view-shot` captures the currently visible card at 1080 square. Capture on demand when share is tapped, not on mount, so three captures are not done for an image nobody sends.

The system share sheet goes through `expo-sharing`. Include a text line with the link so a share carries the app name even when the image is stripped.

The Stories button passes the captured image to `instagram-stories://share` with the Meta App ID. Hide the button when the ID constant is empty, which it is today. Do not show a disabled button or an error.

## Style rules, non-negotiable

- Import `Text` from `@/components/text`. Never from `react-native`.
- Colours from `useColors` or `useTheme`. Spacing, radius and type from `@/theme/tokens`. No hex values.
- Gold appears only on PR marks. The share cards do not get a gold treatment because they look good in gold.
- Cards render identically in light and dark, because the exported image has no theme. Pick one treatment and use it in both.
- No em dashes in user-facing copy. No colons in user-facing copy.

## DO NOT TOUCH

- Any schema, and no SQL writes.
- `computePrSetIds` in `packages/shared`.
- The active workout screen beyond the routing change in `onFinish`, and the pending-sets alert inside it.
- `apps/web`.
- Do not merge the branch.

## Verify before reporting done

1. Typecheck passes with no new errors.
2. A new EAS dev build installs and runs.
3. Finishing a workout lands on the summary, and Done goes to Home. There is no way back into the finished workout.
4. Volume, duration and set count on card 1 match that workout's History row and detail screen exactly.
5. The workout count is right. Check against `getFinishedWorkoutCount`.
6. The comparison card picks a sensible object, and skips itself below 400 lb.
7. Confetti fires on workouts 1 to 3, then only on a compound PR or a weekly target session. Report how you tested the gate.
8. A captured card is 1080 square and legible when opened at full size.
9. The share sheet opens with the image attached.
10. The Stories button is absent while the Meta App ID is empty.
11. Editing the username from the summary updates the card immediately, and the same edit appears in Profile.
12. A taken username shows an inline error rather than throwing.
13. Light and dark both render correctly.
