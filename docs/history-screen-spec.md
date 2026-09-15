# LiftCamp mobile: workout history screen

## Branch and workflow

TERMINAL. Work on a new branch `workout-history` off the current main. Commit and push. Do not merge.

Database rule: read-only queries only. You may run SELECTs to inspect data. Do not run any INSERT, UPDATE, DELETE, ALTER, or CREATE. This task needs no schema change. If you conclude it does, stop and report before writing anything.

Report before building on the two items flagged as REPORT FIRST below. Everything else, build it.

JS-only. No new native modules, no new npm dependencies.

## What this session builds

The History tab, listing finished workouts newest first, grouped under month headers. Rows show date, name, duration, volume, exercise count, and a PR count when the workout contains one or more personal records.

Rows are not tappable this session. The workout detail screen is a separate session, so render rows as plain Views rather than Pressables that go nowhere.

No calendar. No week strip on this screen. Home answers what to train today, History answers what has been trained.

## Files

Read these before writing anything:

- `apps/mobile/src/app/(tabs)/history.tsx` (current shell, you are replacing it)
- `apps/mobile/src/data/home.ts`, specifically `getLastWorkout` and `getWeekWorkoutDates`
- `apps/mobile/src/data/workouts.ts`, specifically `getBodyweight` and `getPriorBestOrm`
- `apps/mobile/src/components/home/last-workout-card.tsx`
- `apps/mobile/src/components/workout/pr-ribbon.tsx`
- `apps/mobile/src/components/text.tsx`
- `apps/mobile/src/theme/tokens.ts` and `apps/mobile/src/theme/theme-provider.tsx`
- `packages/shared/src/pr.ts`, `set-weight.ts`, `one-rep-max.ts`

Expected output files:

- `apps/mobile/src/data/history.ts` (new)
- `apps/mobile/src/app/(tabs)/history.tsx` (replaced)
- `apps/mobile/src/components/history/workout-row.tsx` (new)
- `apps/mobile/src/components/history/month-header.tsx` (new, or inline in the screen if it stays under ~20 lines)
- `packages/shared/src/format-duration.ts` (new, see below)
- `apps/mobile/src/components/home/last-workout-card.tsx` (edited to import the moved helper)

Give me full file contents for every file you change. No diffs.

## Data layer

`getWorkoutHistory` in `apps/mobile/src/data/history.ts`.

Model it on `getLastWorkout` in `home.ts`. That function already returns the exact row shape this screen needs, for one workout. The history version is the same select without `.limit(1).maybeSingle()`, plus paging.

Requirements:

- Filter `.not('finished_at', 'is', null)`. Unfinished workouts never appear. Most rows in this account are abandoned test workouts, so this filter is doing real work.
- Order by `workout_date` descending, then `finished_at` descending. Do not order by `finished_at` alone. A backdated workout would otherwise sort into the wrong month header and look like a bug.
- Page 20 workouts at a time, using `.range()`. Return whether more pages exist.
- Volume goes through `setVolume` from `@liftcamp/shared`, same as `getLastWorkout`, so unilateral doubling and bodyweight loads stay correct. Only `completed` sets count.
- Exercise count is the number of `workout_exercises` rows.
- Duration is computed at render time from `created_at` and `finished_at`. Do not store it on the returned object.

## PR counts

This is the part most likely to go wrong, so read carefully.

Do not call `getPriorBestOrm` per row. It runs one query per exercise and scans up to 500 rows each time. For 20 rows at 5 exercises each that is 100 round trips.

Instead, one pass over the account:

1. Query `workout_exercises` for the user, selecting `workout_id, exercise_id, exercises(weight_type), sets(id, weight, weight_value, reps, completed, created_at)`.
2. Page it at 500 rows per request, following the same reasoning as `EXERCISE_PAGE` in `workouts.ts`. PostgREST caps response rows.
3. Build a map of set id to workout id as you page.
4. Filter to `completed` sets only. **`computePrSetIds` does not filter on `completed` itself.** `getPriorBestOrm` does, which is why this is easy to miss. Passing incomplete sets in will invent PRs that never happened.
5. Group the remaining sets by `exercise_id`. For each group, call `computePrSetIds(sets, { weight_type }, bodyweight)`.
6. Tally the returned set ids back to workout ids. That tally is the PR count per workout.

All or nothing. If paging would exceed 10 pages (5000 `workout_exercises` rows), abandon the PR pass and return PR counts as null for every row, and have the screen render rows without ribbons. A truncated scan is worse than no scan: missing the earlier sets makes later sets look like first-time records, so you would show PRs that are wrong rather than PRs that are missing.

Known and acceptable: bodyweight exercises produce no PRs when the user has no `bodyweight` set, because `effectiveLoad` returns null. That matches how the active workout screen already behaves. Leave it.

## Weight unit (REPORT FIRST)

`user_profiles.weight_unit` exists in the schema and the app ignores it. Two places hardcode it:

- `apps/mobile/src/app/workout/[id].tsx:122` — `const unit = 'lbs';`
- `apps/mobile/src/app/(tabs)/(home)/index.tsx:68` — `const unit = 'lbs';`

History needs a unit too. Do not add a third hardcode.

Read `auth-provider.tsx` and the existing profile fetching, then report your proposed approach before building it. The question is where the unit should be read once and shared, versus each screen fetching it. Include in the report what it costs to thread it through the two existing screens.

## Duration helper (REPORT FIRST)

`last-workout-card.tsx` has a private `duration(startIso, endIso)` at lines 12 to 16. It returns "47 min" or "1 h 05 min". Workouts have no duration column, so every screen showing duration repeats this subtraction. Home does it today, History next, then the detail screen and post-workout summary.

Move it to `packages/shared` as `formatDuration`. It is pure arithmetic and string building, so it satisfies the shared package rules in `packages/shared/src/index.ts`. Export it from the index. Update `last-workout-card.tsx` to import it and delete the local copy.

Before creating it: grep `apps/web` for an existing duration formatter. It may already exist there under a different name, in which case move that one rather than creating a second. Report what you find.

Leave `dateLabel` in `last-workout-card.tsx` alone. History rows want a different format, since the month header already carries the month.

## Screen

`SectionList`, one section per month, `workout_date` deciding which month a workout belongs to. Parse the date as local, using the `` `${iso}T00:00:00` `` pattern already in `last-workout-card.tsx`, not `new Date(iso)`, which parses as UTC and can shift a workout into the previous day.

Month header text is the month name, plus the year when it is not the current year. "September" for this year, "November 2025" for last.

Row contents: day of month and weekday, workout name falling back to "Workout", then duration, volume with the unit, and exercise count. PR count only renders when it is 1 or more, using the existing gold ribbon from `pr-ribbon.tsx`.

Infinite scroll via `onEndReached`, loading 20 more. Guard against firing while a load is already in flight.

Empty state for a user with no finished workouts. Copy, exactly:

> **No workouts yet**
> Finish your first workout and it will show up here.

Loading state on first fetch. Do not flash the empty state before data arrives.

## Style rules, non-negotiable

- Import `Text` from `@/components/text`. React Native only resolves `fontWeight` against the system font, so the wrapper is what makes Outfit render at the right weight. Never import `Text` from `react-native` in a new screen.
- Colors from `useColors` or `useTheme`. Spacing, radius, and type from `@/theme/tokens`. No hex values, no magic numbers.
- Must work in light and dark. Check both.
- Numbers use the tabular figure styles already in tokens, so columns of volume line up.
- No em dashes in any user-facing copy. No colons in user-facing copy.

## DO NOT TOUCH

- Any schema. No migrations, no SQL writes.
- `workout/[id].tsx` beyond the single unit line, and only after the unit approach is agreed.
- `(tabs)/_layout.tsx`. Tab structure stays at 4 tabs with History in place.
- The active workout screen's PR logic, `getPriorBestOrm`, or `computePrSetIds` itself.
- `apps/web`, other than reading it to check for an existing duration formatter.
- Do not merge the branch.

## Verify before reporting done

1. `pnpm typecheck` (or the repo's equivalent) passes with no new errors.
2. History renders on the dev build with real data, finished workouts only, correct month grouping.
3. A workout known to contain a PR shows a ribbon, and the count matches what the active workout screen showed during that session.
4. A workout with no PRs shows no ribbon and no zero.
5. Scrolling past 20 workouts loads more without duplicating rows.
6. Light and dark both render correctly.
7. Volume totals on a history row match the Last workout card on Home for the same workout.
8. The empty state appears for an account with no finished workouts, and does not flash during loading.
9. Count the queries on first load. Report the number. It should be a small constant, not one per row.
