# LiftCamp mobile: workout detail screen

Follows `docs/history-screen-spec.md`, which is merged to `workout-history`.

## Branch and workflow

TERMINAL. Branch `workout-detail` off `workout-history`. Commit and push. Do not merge.

Database rule: read-only queries only. SELECTs to inspect data are fine. No INSERT, UPDATE, DELETE, ALTER, CREATE. This task needs no schema change. If you conclude it does, stop and report.

JS-only. No new native modules, no new npm dependencies.

Report before building on the one REPORT FIRST item. Everything else, build it.

## What this session builds

A read-only detail screen for one finished workout, reached by tapping a history row or the Last workout card on Home.

Explicitly out of scope: editing a finished workout, deleting one, attaching a photo, and sharing. Editing is deferred because reopening a finished workout raises questions about `finished_at` and PR reattribution that need their own session. Photos and sharing come with the post-workout summary.

## Part 1: the history row shadow

`cardSurface` in `apps/mobile/src/theme/tokens.ts:135` uses `shadowRadius: 8` with a 2pt y-offset. History rows sit `spacing.sm` apart, which is also 8, so each row's blur lands on its neighbours and the gaps never return to background colour. On device the stack reads as smudged rather than layered.

That token is right for one prominent card on Home. It is wrong for a dense list.

Add a flat variant to `tokens.ts` next to `cardSurface`:

```js
/**
 * A row in a list. Same surface as `cardSurface` with no shadow: stacked
 * rows sit `spacing.sm` apart, and an 8pt blur at that spacing lands on the
 * neighbouring rows instead of lifting each one.
 */
export function listSurface(scheme: ColorScheme, p: Palette) {
  if (scheme === 'dark') {
    return { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border };
  }
  return { backgroundColor: p.surface };
}
```

`workout-row.tsx` imports `listSurface` instead of `cardSurface`, and its `borderRadius` goes from `radius.card` (20) to `radius.bar` (14). A 20pt radius on a 62pt row reads as a pill.

Do not change `cardSurface` itself. Home's card depends on it.

## Part 2: route structure (REPORT FIRST)

Detail has to push inside the History tab so the tab bar stays and back works. The History tab is currently a single file, `(tabs)/history.tsx`, with no stack around it.

Home already solves this. `(tabs)/(home)/` is a group with `_layout.tsx` holding a `Stack`, `index.tsx`, and `routines.tsx` pushed on top of it.

Proposed, mirroring Home:

- `(tabs)/history.tsx` becomes `(tabs)/(history)/index.tsx`
- new `(tabs)/(history)/_layout.tsx`, modelled on `(home)/_layout.tsx`
- new `(tabs)/(history)/[id].tsx`, the detail screen
- in `(tabs)/_layout.tsx`, the History `NativeTabs.Trigger` name changes from `history` to `(history)`

This is the one place you may edit `(tabs)/_layout.tsx`. Tab count and order stay exactly as they are.

One consequence to report on: Home's stack uses `headerLargeTitle`, while the history screen draws its own `<Text style={type.screenTitle}>History</Text>` inside a SafeAreaView. Moving History into a stack makes the native large title available. Matching Home would be more consistent, and it changes how the header looks and how it behaves on scroll under a SectionList.

Report which you recommend and why before building it. If the native large title fights the SectionList's sticky month headers, say so and keep the manual title.

Also confirm in the report that `router.navigate('/history')` still resolves after the rename. It appears at `(tabs)/(home)/index.tsx:320`.

## Part 3: PR marks, and why they must share one code path

History rows promise "6 PRs in this workout". Detail is where the user sees which six. If the two screens compute PRs differently they will disagree, and the list will look broken.

So refactor rather than reimplement. In `apps/mobile/src/data/history.ts`:

- Extract the set-id computation into `getPrSetIds(userId, bodyweight): Promise<Set<string> | null>`, holding everything `getPrCounts` does today: the paged scan, the `completed` filter, the `position` pre-sort for tied `created_at`, `computePrSetIds` per exercise group, and the `PR_SCAN_MAX_PAGES` all-or-nothing guard.
- `getPrCounts` becomes a thin function over that result, tallying set ids to workout ids through the same map.
- `tallyPrs` keeps its current pure signature and behaviour so the fixture test you already wrote still applies.

Detail calls `getPrSetIds` and marks any set whose id is in the returned Set. Agreement between the two screens is then structural rather than something to verify.

Do not modify `computePrSetIds` in `packages/shared`.

Known cost: detail runs a full account scan on open, same as history. At 338 `workout_exercises` rows that is one request. If it ever gets slow the optimisation is to scope the scan to the exercise ids in the workout being viewed, which is a change to make later with a measurement behind it, not now.

When `getPrSetIds` returns null, the guard tripped and detail shows no ribbons anywhere, matching how the list behaves.

## Part 4: the detail screen

Route `(tabs)/(history)/[id].tsx`. Loads one workout by id, scoped to the signed-in user.

Guard: if the id does not resolve, or belongs to another user, or has a null `finished_at`, go back rather than rendering an empty shell.

Do not use `loadWorkout` from `workouts.ts`. It fetches prior-session values and a prior-best 1RM per exercise, which a read-only view does not need, and it runs a query per exercise to do it. Write a `getWorkoutDetail` in `history.ts` that selects the workout, its `workout_exercises` in `position` order with `exercises(${EXERCISE_FIELDS})`, and each one's `sets` in `position` order.

Layout, top to bottom:

**Header.** Workout name as the stack title, falling back to "Workout". Date and start time in the body, formatted like "Wednesday, 9 September".

**Stat row.** Three stats matching the Home card's presentation: Time, Volume, Sets. Time uses `formatDuration`. Volume uses `setVolume` over completed sets with the unit label from `useWeightUnit`. Sets is the count of completed sets, which is new information next to the exercise list below. Home's card shows Exercises, so this one does not repeat it.

Leave a comment under the stat row marking where a photo strip will go in a later session. No placeholder UI, just the comment so the layout decision is already made.

**Workout note.** `workouts.notes`, when present.

**Per exercise, in position order.** Thumbnail from `exercise-media`, then the exercise name as a pressable that opens `ExerciseInfoSheet`. The sheet takes an `ExerciseInfo` or an id, and this screen already has the full row, so pass the object.

Under each exercise, a set table. Column headers SET and WEIGHT & REPS, styled with `type.label`. Reuse the widths in `COLUMNS` from tokens so the table lines up with the active workout screen. Rows show the set number, the weight through `formatSetWeight` from shared with the unit label, the reps, and the PR ribbon when that set's id is in the PR set.

`formatSetWeight` already handles bodyweight exercises and missing values, so a dumbbell set logged with no weight reads "Bodyweight" rather than "0 lbs".

Zebra stripe alternate set rows using the surface tokens. Do not introduce a new grey.

Show a set's `note` under its row when present.

Incomplete sets: show them, dimmed, with no PR ribbon. A set the user left unchecked is part of what happened in that session.

**Repeat.** A button matching the Home card's Repeat, starting a new workout from this one's exercises and routing to the active workout screen.

`repeatWorkout` in `home.ts:400` currently takes a `LastWorkout`, which carries `exerciseIds`. `HistoryWorkout` does not have that field. Refactor `repeatWorkout` to take `{ name, exerciseIds }` and update the one Home caller, rather than adding a second function that does the same thing.

## Part 5: making rows tappable

`workout-row.tsx` becomes a `Pressable` routing to the detail for that workout id. Keep the pressed-state opacity the other pressables use.

`(tabs)/(home)/index.tsx:320` currently has the Last workout card's `onOpen` routing to `/history`. Point it at that workout's detail instead.

## Style rules, non-negotiable

- Import `Text` from `@/components/text`. Never from `react-native`.
- Colours from `useColors` or `useTheme`. Spacing, radius, and type from `@/theme/tokens`. No hex values, no magic numbers.
- Light and dark both. Check both.
- No em dashes in user-facing copy. No colons in user-facing copy.

## DO NOT TOUCH

- Any schema. No migrations, no SQL writes.
- `computePrSetIds`, `setVolume`, `effectiveLoad`, or anything else in `packages/shared` beyond adding imports.
- `cardSurface`. Add `listSurface` alongside it.
- `(tabs)/_layout.tsx` beyond the single trigger name change in Part 2.
- The active workout screen's logging behaviour. It is read-only from here.
- `apps/web`.
- Do not merge the branch.

## Verify before reporting done

1. Typecheck passes with no new errors.
2. History rows no longer smudge into each other in light mode. Dark mode still shows the bordered surface.
3. Tapping the 9 September row opens a detail showing 6 PR ribbons, matching the 6 on the list row. Count them.
4. The PR ribbons on detail fall on the same sets the active workout screen marked during that session, for at least one workout you can cross-check.
5. Volume and duration on detail match the same workout's history row exactly.
6. Sets count on detail equals the number of completed sets, not all sets.
7. Tapping an exercise name opens the info sheet with the GIF, muscles, and steps.
8. Repeat starts a new workout with the same exercises in the same order and lands on the active screen.
9. Back from detail returns to History with scroll position and loaded pages intact.
10. The Last workout card on Home opens that workout's detail rather than the History list.
11. A workout containing a bodyweight exercise renders it through `formatSetWeight`, not as "0 lbs".
12. Light and dark both render correctly.
