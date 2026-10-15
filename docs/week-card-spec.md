# Workouts this week card: counter, encouragement, streak, celebration

Companion to `home-spec.md`. Same tokens, type and rules. Written 29 Sep 2026
against main at b04a381.

Supersedes one line of `home-spec.md`: the consecutive-weeks count comes back
to Home as a chip on this card. Profile gets its own streak stat, current and
longest (see "Profile").

Decisions taken 29 Sep 2026 after review, folded in below: streak milestones
at 2, 4, 8, 12, 26 and 52 weeks; days left count from tomorrow when today
already has a workout; a target of 1 uses the zero phases; "Get in!" is out;
a Profile streak stat.

Files this touches:

- `packages/shared/src/week-card.ts` (new) and `week-card.test.ts` (new)
- `packages/shared/src/weeks.ts` (new, `mondayOf`, shared with `profile-stats.ts`)
- `apps/mobile/src/data/home.ts` (one new read)
- `apps/mobile/src/components/home/week-card.tsx` (new, replaces `week-strip.tsx`)
- `apps/mobile/src/components/home/plate.tsx` (new)
- `apps/mobile/src/app/(tabs)/(home)/index.tsx` (wire the card)
- `apps/mobile/src/lib/haptics.ts` (new)
- `apps/mobile/src/app/workout/[id].tsx` (the workout-screen haptics, shipped
  on the `haptics` branch ahead of build 4)
- `apps/mobile/src/app/(tabs)/profile.tsx` (the streak stat)
- `apps/web` is out of scope. The web build is outdated and stays untouched.

Read before starting: `week-strip.tsx`, `home.ts` (the Dates and Week strip
sections), `profile-stats.ts` (`trainingDaysByWeek`), `copy-numbers.ts`,
`summary/confetti.tsx` (the reanimated pattern), `tokens.ts` (the color rules
in the header comment).

---

## Decisions

1. A week is Monday to Sunday, local time, same as `startOfWeek` in `home.ts`.
2. A week counts as hit when distinct training days in it reach the weekly
   target. Days, not workout rows, matching the strip and the Profile chart.
3. Streak is consecutive hit weeks. The current week joins the streak the
   moment it is hit and never breaks it while in progress.
4. Rest week. After four consecutive hit weeks the user banks one rest week.
   At most one banked at a time. A missed week that follows spends it and the
   streak survives. Banked rest weeks are computed, not stored.
5. Everything is computed on read from `workouts.workout_date` with the
   target as it is today. Changing the target rewrites history. Known wart,
   fixed later by snapshotting week results. No schema changes in this spec.
6. Window is 52 weeks. A streak longer than that shows as 52. Superseded
   3 Oct 2026 by streak medals: the streak reads the whole history
   (`streak-walk.ts`, capped at ten years as a typo guard) and Home's read
   is every finished date, so a run past a year keeps counting.
7. No gold anywhere on this card. Gold is PRs only (`tokens.ts`). Hit state
   uses accent.
8. The celebration plays on the first Home focus after the app was launched
   or came back from the background, following the week being hit. It does
   not play on the return from the summary screen, where confetti just ran.
   Once per week.
9. Haptics come in with build 4, via `expo-haptics`. It is a native
   module, so the dev client and TestFlight need a new build (Expo Go
   already bundles it). Five call sites, all listed under "Haptics" below.
   Nothing else buzzes.
10. Milestones at 2, 4, 8, 12, 26 and 52 consecutive hit weeks. Since
    3 Oct 2026 these are the medal ladder in `medals.ts` (2, 4, 8, 12, 26,
    52, 78, 104, then every 52) and see "Streak medals" below. In a
    milestone week the hit (or over) line becomes that milestone's line and
    the chip shows the count. No extra animation; milestone share cards come
    in Phase 5.

---

## packages/shared/src/week-card.ts

Pure functions, no React, no Supabase. Export everything from `index.ts`.

Dates in and out are `YYYY-MM-DD` strings. Reuse `isoFromLocalDate` and
`localDateFromIso` from `birthday.ts`. `mondayOf` moves out of
`profile-stats.ts` into `weeks.ts` so this file and `trainingDaysByWeek`
share one definition.

### Types

```ts
export type WeekPhase =
  | 'first'      // never finished a workout
  | 'zero-early' // 0 done, Monday to Wednesday
  | 'zero-late'  // 0 done, Thursday to Sunday
  | 'going'      // 1+ done, 2+ remaining
  | 'one-left'   // 1+ done, exactly 1 remaining
  | 'hit'        // done === target
  | 'over';      // done > target

export type StreakResult = {
  /** Consecutive hit weeks ending now, current week included once hit. 0 to 52. */
  current: number;
  /** Longest run in the window, for Profile. */
  longest: number;
  /** A rest week is banked and unspent. */
  restBanked: boolean;
  /** True when last week was a miss covered by a rest week. */
  restUsedLastWeek: boolean;
  /** Streak length that was lost when last week was missed with no rest week. 0 when nothing was lost. */
  resetLastWeekFrom: number;
};

export type WeekCardState = {
  done: number;
  target: number;
  remaining: number;          // max(0, target - done)
  daysLeft: number;           // days still open: today to Sunday, less today if it already has a workout. 0 to 7
  trainedToday: boolean;      // today already has a finished workout
  phase: WeekPhase;
  /** Every remaining day must be a training day to hit target, and a streak is on the line. */
  atRisk: boolean;
  streak: StreakResult;
  weekStart: string;          // Monday, YYYY-MM-DD
};
```

### weekStreak(dates, target, today = new Date()): StreakResult

Walk forward, oldest week first, over the 52 weeks ending with the week
holding `today`. Group dates into distinct days per week with the same
Monday bucketing as `trainingDaysByWeek`.

State while walking: `streak`, `banked` (0 or 1), `sinceBank`.

For each completed week (every week except the current one):

- hit (`days >= target`): `streak += 1`, `sinceBank += 1`. If
  `sinceBank === 4 && banked === 0` then `banked = 1`, `sinceBank = 0`.
- miss with `banked === 1`: `banked = 0`, `sinceBank = 0`, streak kept.
  If this is the week before the current one, `restUsedLastWeek = true`.
- miss with `banked === 0`: if this is the week before the current one,
  `resetLastWeekFrom = streak`. Then `streak = 0`, `sinceBank = 0`.

Track `longest` as the max streak seen at any point, including after the
current week.

The current week: if hit, `streak += 1` (and it can bank a rest week the
same way). If not hit, nothing changes. Never spend a rest week on the
current week.

`target <= 0` returns all zeros and false.

### weekCardState(input): WeekCardState

```ts
input: {
  dates: string[];        // finished workout dates, last 52 weeks, any order, duplicates fine
  target: number;
  finishedCount: number;  // lifetime, for 'first'
  today?: Date;
}
```

`done` is distinct dates in the current week. `daysLeft` is
`7 - ((today.getDay() + 6) % 7)`, less one when today already has a
workout: distinct days, so a second workout today cannot count. Phase in
this order: `first` when `finishedCount === 0`; `over`; `hit`; then, with 0
done, `zero-early` or `zero-late` by weekday (Wednesday is early), which
also covers a target of 1; then `one-left`; then `going`.

`atRisk = streak.current > 0 && remaining > 0 && remaining === daysLeft`.
That is Sunday with one to go, Saturday with two to go, Saturday with one
to go when Saturday is already done, and so on. It is never true when the
target is already out of reach this week.

### weekCardLine(state, seen): string

`seen` is what the app has already shown, so one-time lines show once:

```ts
seen: { resetShownFor: string | null }   // weekStart the reset line was shown for, from storage
```

Precedence, first match wins:

1. `state.streak.resetLastWeekFrom > 0 && state.done === 0 && seen.resetShownFor !== state.weekStart`
   "Streak reset. New one starts now."
   The caller stores `weekStart` after showing it.
2. `state.streak.restUsedLastWeek && state.done === 0`
   "Rest week used. Streak safe."
3. `state.atRisk`
   `Your ${proseNumber(streak)}-week streak is on the line. ${ask}` where
   `ask` is "One more today." with one left and today still open, "One more
   tomorrow." with one left and today already done, else
   `${Prose(remaining)} more by Sunday.`
   With a one-week streak the line starts "Your streak is on the line."
4. In a `hit` or `over` week, when `streak.current` is a milestone, that
   milestone's line (see "Milestone lines").
5. The pool for `state.phase`, picked by `weekIndex % pool.length` where
   `weekIndex = Math.floor(Date.parse(weekStart + 'T00:00:00') / 604800000)`.
   Stable within a week, rotates across weeks. Take the modulus over the
   whole pool; when the picked line's `when` excludes today, use the line
   half the pool away (then outward). Filtering the pool first would change
   its length mid-week, and stepping by one would land on the next week's
   line.

Numbers in copy go through `proseNumber` and `proseCount` from
`copy-numbers.ts`. No colons, no em dashes.

### Copy pools

`first`
- Start with one. The rest gets easier.
- Your first workout is waiting.
- One session and you're on the board.

`zero-early`
- Fresh week. Get the first one in.
- One workout today gets the week moving.
- The first one is the hardest to start.

`zero-late`
- Still time this week. One session counts.
- A short workout beats a skipped one.
- Get one in before Sunday.

`going` (uses `remaining`)
- Nice start. {Remaining} to go.
- {Done} down. Keep it rolling.
- Good. {Remaining} more and it's yours.

`one-left`
- One more and the week is yours.
- So close. One to go.
- Finish it off. One more.

`hit` (uses `target`)
- Week complete. Nice one.
- Boo-yah. Target hit.
- {Target} for {target}. Beautiful.
- Target hit. In the books.
- That's a full week. Take a bow.
- Nailed it. Week done.
- Every workout, done. Enjoy the weekend.   `when: Friday to Sunday`

`over` (uses `done` and `target`)
- {Done} this week. Extra credit.
- Past the target. Nobody's stopping you.
- Another one! That's {done}.
- Target was {target}. You did {done}.
- Bonus session. Showing off a little.
- {Done} and counting. Keep it coming.
- Above and beyond this week.

Capitalized placeholders mean sentence-initial, so `proseNumber` output with
the first letter upper-cased. Write a tiny `capitalize` helper in the file.

### Milestone lines

One per milestone, in place of the week's hit or over line. Encouraging, no
colons or em dashes, prose numbers, and no line starts with digits.

- 2: Two weeks in a row. That's a streak.
- 4: Four weeks straight. You've earned a rest week.
- 8: Eight weeks running. This is a habit now.
- 12: That's 12 weeks straight. Three months of showing up.
- 26: That's 26 weeks in a row. Half a year strong.
- 52: That's 52 weeks. A full year of showing up.

### week-card.test.ts (vitest)

Cover at least:

- `weekStreak`: empty dates gives zeros. Three hit weeks then current week
  unhit gives `current 3`. Current week hit adds one. Four hits bank a rest
  week (`restBanked true`). Five hits then a miss then current week gives
  `current 5, restBanked false, restUsedLastWeek true`. Two hits then a miss
  gives `current 0, resetLastWeekFrom 2`. Two hits, miss, one hit gives
  `current 1, longest 2`. Rest week is never spent twice in a row. Target 0
  gives zeros. Dates outside 52 weeks are ignored. Two workouts on one day
  count as one day.
- `weekStreak`, added: a run longer than 52 caps at 52; the current week
  never spends a rest week; a new rest week banks after four more hits once
  the first is spent; weeks across New Year and a daylight saving change
  bucket correctly; a workout dated after this Sunday is ignored; `longest`
  includes the current week once hit.
- `weekCardState`: every phase from a fixed `today`. `atRisk` true on Sunday
  with one left and a streak, false with no streak, false on Sunday with two
  left. Wednesday is `zero-early`, Thursday is `zero-late`. A target of 1
  with 0 done is a zero phase. Saturday with one done today and two left is
  not at risk (out of reach); Saturday with one left and today done is.
- `weekCardLine`: precedence order above. Reset line shows once then falls
  through to the pool. Same week returns the same line; no phase repeats a
  line in neighboring weeks on any weekday. The weekend-only `hit` line
  never appears on a Tuesday. Streak of one uses "Your streak", not "Your
  one-week streak". "One more tomorrow." when today is done. Every milestone
  swaps in its line in a hit or over week. No line has a colon or an em dash.

Run with `pnpm --filter @liftcamp/shared test`.

---

## apps/mobile/src/data/home.ts

Add one read and keep `getWeekWorkoutDates`, which the summary screen still
imports.

```ts
export const STREAK_WEEKS = 52;

/**
 * Finished workout dates for the streak window: this week and the 51
 * before it, bounded at the end of this week like getWeekWorkoutDates.
 * Home derives this week's dates and the streak from this one read.
 */
export async function getStreakWorkoutDates(userId: string): Promise<string[]>
```

Same shape as the `recent` query in `profile.ts` with `STREAK_WEEKS`.
Return the raw list; `weekCardState` dedupes.

---

## Home wiring (index.tsx)

- `HomeData.weekDates` becomes `streakDates?: string[]` filled by
  `getStreakWorkoutDates`. Drop the `getWeekWorkoutDates` track.
- The card renders once `profile`, `streakDates` and `finishedCount` are in
  (it needs the count for `first`). Skeleton until then.
- Compute `weekCardState` in a `useMemo` on those three.
- Read `liftcamp:week-reset-shown` and `liftcamp:week-celebrated` from
  AsyncStorage once on mount (both hold a `weekStart`). Pass into the card.
  Both keys sit under `liftcamp:` so account deletion and Start fresh clear
  them.

### Celebration trigger

Module-level `let launchedAt = Date.now()` in `week-card.tsx`, updated to
`Date.now()` whenever `AppState` changes to `active` from `background`
(register one listener at module level, like `autoResumedFor` is module
level in Home). This is "the app was opened".

On Home focus, with `phase` in `hit | over` and `celebrated !== weekStart`:

- If `liftcamp:week-celebrate-armed` is absent or holds a different
  `weekStart`, write `{ weekStart, at: Date.now() }` and do nothing. This is
  the visit right after the summary.
- If it holds this `weekStart` and `at < launchedAt`, play the celebration,
  then write `liftcamp:week-celebrated = weekStart`.

Nothing plays for a user whose week was already hit when they first opened
the app this week and who has no armed key (a fresh install mid-week). The
armed key gets written and the celebration plays on the next launch. Fine.

---

## Card layout (week-card.tsx)

Card surface, `radius.card`, `spacing.card` padding, `gap: spacing.sm`.
Whole card is a Pressable to History, as now. Border becomes
`1.5 accent` in the `hit` and `over` phases, both modes.

Row 1, space-between:
- `WORKOUTS THIS WEEK` in `type.label`, `text3`.
- Streak chip, only when `streak.current > 0`: `accentSoft` pill,
  `radius.pill`, padding 4 by 8, a 12pt filled plate icon, then
  `${streak.current} ${streak.current === 1 ? 'week' : 'weeks'}` in
  `type.meta` weight 600 `accentText`. Digits here, it is a stat.
  A banked rest week adds a second, smaller outlined plate after the text.
  Accessibility label reads "Three-week streak, rest week banked".

Row 2, space-between, `alignItems: 'center'`:
- Count, left. `fontSize 28, fontWeight 700, letterSpacing -0.5, tabular`,
  `text`. Text is `${done} of ${target}`. Over target the text stays
  `4 of 3`.
- Plates, right. One `<Plate>` per target workout, size 26, gap 6. Filled
  for index `< done`, empty otherwise. Over target, append the extra
  filled plates up to 7 total.

Row 3:
- The encouragement line, `type.meta`, `text2`, `numberOfLines 2`.

Row 4:
- The existing seven day dots and letters from `week-strip.tsx`, unchanged
  in size and logic (dot 14, today ringed). Keep this row. If the card reads
  as crowded on a 375pt screen, this row goes, and only this row.

Accessibility label on the Pressable: `${done} of ${target} workouts this
week. ${line} Open history.` plus the streak when present.

### plate.tsx

`react-native-svg`. A weight plate seen face on: outer circle radius `s/2`,
inner hole radius `s/6`, two thin concentric rings between them at
`0.72` and `0.5` of the outer radius drawn as strokes at 0.35 opacity.

- filled: fill `accent`, hole `surface`, rings white at 0.25 opacity.
- empty: no fill, stroke `border` 1.5, hole stroke `border`.

Props: `size`, `filled`, `style`, and an optional `animatedScale`
(`SharedValue<number>`) applied with `Animated.View` wrapping the svg.
Swap the artwork for a clay render later without touching the card.

---

## Animation (reanimated, already installed)

Respect reduce motion: `AccessibilityInfo.isReduceMotionEnabled()` true
means every animation jumps to its end state.

### Plate fill on a new workout

Keep a module-level `Map<string, number>` of `weekStart -> done` last
rendered. On render, plates with index in `[prev, done)` animate
`scale 0.6 -> 1.12 -> 1` with `withSpring` (damping 12, stiffness 180),
staggered 60ms. Others render static. Update the map after.

### Celebration sequence

Runs once, about 1.4s, nothing to dismiss, touches pass through.

1. 0ms: plates pulse left to right, `scale 1 -> 1.25 -> 1`, 80ms stagger,
   `withSpring` same config.
2. 350ms: count `scale 1 -> 1.15 -> 1`, 300ms.
3. 550ms: streak chip enters, `opacity 0 -> 1`, `translateY 6 -> 0`, 250ms.
   If it was already visible, its number bumps `scale 1 -> 1.2 -> 1`
   instead.
4. 550ms: card border color `border -> accent` over 300ms and stays.
   `useAnimatedStyle` with `interpolateColor`.
5. 900ms: a soft glow, an absolutely positioned view behind the card with
   `accentSoft` background, `radius.card + 6`, `opacity 0 -> 0.9 -> 0` over
   600ms. On dark, opacity peaks at 0.5.

No confetti and no particles. Confetti belongs to the summary screen.

Haptics during the sequence: `celebrate()` at 0ms (three light impacts,
80ms apart, in time with the first three plates) and `reward()` at 550ms
as the chip lands. See "Haptics".

---

## Haptics

TERMINAL, in `apps/mobile`: `npx expo install expo-haptics`. Pinned to the
SDK 57 version. No plugin or config needed. The simulator produces nothing;
every pattern is judged on a phone.

### lib/haptics.ts

One file so the pattern choices live in one place and call sites use
names, not generator types. Every function swallows errors: a haptic that
fails is nothing, never a crash.

```ts
import * as Haptics from 'expo-haptics';

/** A routine confirmation. Light impact. */
export function confirm(): void
/** A milestone. Notification success. */
export function reward(): void
/** A bigger single moment. Medium impact. */
export function emphasize(): void
/** The week card's opener. Three light impacts, 80ms apart. */
export function celebrate(): void
```

`celebrate` uses `setTimeout` for the two follow-ups; no reanimated.

iOS honors the system Sounds & Haptics toggle inside these generators, so
there is no app setting in v1. Reduce Motion does not affect haptics and
should not.

### Call sites, exactly five

| Moment | Where | Call |
|---|---|---|
| Set checked done | `workout/[id].tsx` `toggleDone`, after `patchSet(set.id, patch)` on the completing path only, never on uncheck | `confirm()` |
| Rest timer reaches zero | `workout/[id].tsx`, the effect that clears `restEndsAt` when `now >= restEndsAt` | `reward()` |
| Finish tapped | `workout/[id].tsx` `onFinish`, when the finish goes ahead, before navigation | `emphasize()` |
| A completed set becomes a PR | `workout/[id].tsx` `toggleDone`: the set is a PR by `workoutPrSetIds` (the rule the card's ribbon uses) and has not buzzed this session, remembered in a set of ids | `reward()`, in place of `confirm()` so a check buzzes once |
| Week card celebration | `week-card.tsx`, the sequence above | `celebrate()` then `reward()` |

The rest timer haptic only fires while the app is in the foreground,
because the ticker that drives it stops in the background. A background
rest alert is a local notification and a separate feature.

Nothing else. No tab switches, no sheets, no keypad, no swipe to delete
(UIKit's swipe already ticks on its own), no rest countdown ticks.

---

## Profile

A streak stat on Profile, current and longest, from `weekStreak` over the
same 52 weeks of finished dates and today's target. Digits, it is a stat.
Shown once the user has a finished workout; hidden in the empty state.

---

## Skeleton

Update `WeekStripSkeleton` into `WeekCardSkeleton`: label bar, a 28pt
count bar of width 72, three 26pt circles, a meta-width bar, then the day
row. Same heights as the real card so nothing shifts on reveal.

---

## Verify

- [ ] `pnpm --filter @liftcamp/shared test` green, new tests included.
- [ ] `pnpm --filter @liftcamp/mobile tsc --noEmit` (or the repo's typecheck script) clean.
- [ ] Simulator: change the device date across a week and confirm every
      phase line renders, no line breaks past two rows at 375pt.
- [ ] Log a workout, return to Home, only the new plate animates.
- [ ] Hit target, return from summary, no celebration. Background the app,
      reopen, celebration plays once. Reopen again, nothing.
- [ ] Reduce Motion on: card shows end state with no motion.
- [ ] Dark mode: border, glow and chip read correctly.
- [ ] Guest (anonymous) user with zero workouts sees the `first` pool.
- [ ] Summary screen unchanged (it still imports `getWeekWorkoutDates`).
- [ ] On a phone: set done buzzes once, uncheck is silent, rest end buzzes,
      Finish buzzes, a PR buzzes once, the celebration runs its rhythm then
      the success pattern. System Haptics off in iOS settings silences all.
- [ ] Expo Go bundles expo-haptics, so it works there on a phone without
      a rebuild. The dev client and TestFlight need a new build.

---

## Streak medals (3 Oct 2026)

Branch `streak-medals`. The milestone list became a medal ladder, and each
medal earned is stored.

- Ladder: 2, 4, 8, 12, 26, 52, 78, 104 weeks, then every 52
  (`packages/shared/src/medals.ts`). Every rung has a line; past 104 the
  line is generated ("That's 156 weeks. You've shown up for three full years. 🙌").
  Every streak line's emoji comes from `WORKOUT_EMOJI`, through `withEmoji`
  (the type rejects any other); "Keep it going" ends in 💪 up to a year and
  🦾 past it.
- Earn events: `medalEarnEvents(weekResults(...))` walks the same streak
  as `weekStreak` (`walkStreak` in `streak-walk.ts`, one walker for both)
  and gives one event per rung reached, with the week and the day that
  week was hit. Re-earnable: a run that breaks at 6 and rebuilds earns the
  2 and 4 again. The current week joins once hit.
- Storage: `user_medals` (`supabase/migrations/20261003150000_user_medals.sql`),
  unique on (user_id, weeks, earned_week_start). Clients get SELECT and
  INSERT on their own rows only. Home inserts missing events on every load
  from the server's dates (`data/medals.ts`, `syncMedals`, ignore
  duplicates), which backfills an account the first time. Insert only, so
  a target change never removes a medal.
- Guest merge moves `user_medals` (the account's copy wins on the same
  rung and week). Without that rule the merge's leftover check would refuse
  any guest holding a medal, so the migration ships the table and the rule
  together.
- Week card: on a medal week (`weekMedal`) the medal, 64 pt, takes the
  plates' slot beside the count and the plates are hidden. The line keeps
  its own full-width row under the count every week. Other weeks keep the
  plates and their height; a medal week's count row is the medal's 64 pt.
  In the celebration the plates pulse, then fade as the medal lands in
  their slot with the chip. No confetti, and no flat UI gold (the medal
  art's metal is its own, see below).
- Share card: on a rung, the medal is the hero (45% of the card's width,
  centered at the top), then "12-week workout streak" in white bold, the
  medal line and the workout count. Off the ladder it keeps the big
  number, the strip, the count and the keep-going line.
- Summary: a workout that earned a medal (`workoutMedal`: its day is the
  day its week hit the target, and the streak landed on a rung, re-earns
  and rungs past 104 included) adds the medal share card after its workout
  cards in the summary carousel, and a quiet "You earned the 12-week
  medal" line with a 32 pt medal at the end. Share sends whichever card
  shows. No extra confetti or haptic; the medal celebrates on Home.
- Profile: a medal row under the streak stats (earned, then the next as a
  locked silhouette with "N weeks to go"), opening `app/medals.tsx`, the
  cabinet.
- Art: `components/medals/medal.tsx` is the one component every medal
  draws through. Clay art since 3 Oct 2026: `assets/images/medals/medal-<rung>.webp`
  (360 px, quality 85; the 600 px PNG masters are in
  `assets-src/images/medals`, not bundled) with `medals.json` giving the face's center and radius and each
  metal (bronze 2 and 4, silver 8 and 12, gold 26 and up). Rungs past 104
  reuse the 104 art. The number sits on the face, cream on bronze and
  graphite on silver and gold, with a small text shadow so it reads as
  pressed in. Locked medals use `medal-<rung>-locked.webp`, grayscale copies
  at 300 px made ahead of time (iOS ignores the `grayscale` style filter
  unless the SwiftUI filters feature flag is on, a native change), drawn
  at 35% opacity with the number in text3.
