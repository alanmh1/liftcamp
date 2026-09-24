# LiftCamp: cleanup pass, 24 Sep 2026

Branch `cleanup-2026-09-24`, off main after `setup-checklist` merges. Never
merged by the session that built it.

DATABASE RULE: read-only queries only. Alan runs
`docs/cleanup-2026-09-24.sql` himself. It retags Goblet Squat as
`dumbbell`, fixes Close-Grip Dumbbell Press's description and drops two
duplicate read policies. Part 2 of that file (dropping `birth_year`) waits
for task 3 below.

Stage files by explicit path. Never `git add -A` or `git add .`.

## Read first

- `packages/shared/src/set-weight.ts` (`setVolume`)
- `packages/shared/src/dumbbell-load.ts`
- `packages/shared/src/volume-comparisons.ts`
- Every caller of `setVolume` (grep)

## 1. Dumbbell volume

Today a set's volume is `load × reps × (is_unilateral ? 2 : 1)`, with load
being the weight of one dumbbell for dumbbell exercises. Two-dumbbell
exercises therefore count half the weight actually moved.

New rule, in `setVolume`:

`volume = load × reps × sides × dumbbells`

- `sides` is 2 when `is_unilateral`, else 1 (unchanged).
- `dumbbells` is 2 when the exercise holds a dumbbell in each hand, else 1.
  - Not a dumbbell exercise: 1.
  - On `ONE_DUMBBELL_EXERCISES`: 1.
  - Dumbbell and not unilateral: 2 (bench, shoulder press, rows with two
    dumbbells, curls with two dumbbells).
  - Dumbbell and unilateral: 1, unless on a new `TWO_DUMBBELL_UNILATERAL`
    list: exercises done one side at a time while holding a dumbbell in
    each hand (Bulgarian split squats, dumbbell lunges, step ups, split
    squats and similar).
- Add Goblet Squat (`43284cd1-4bb4-44c7-87b6-617ed5f03dbf`) to
  `ONE_DUMBBELL_EXERCISES`. Alan's SQL retags it as `dumbbell`.

Build `TWO_DUMBBELL_UNILATERAL` from a read-only query over the 33
unilateral dumbbell exercises, using their descriptions. Report the list
before committing, like last time.

Volume is computed on read, so history, records, summaries and the volume
comparisons all pick this up. PRs, estimated max and strength level don't
use volume and must not change. Add tests: dumbbell bench 50 × 10 is 1,000;
one-arm row 50 × 10 is 1,000 (unilateral, one dumbbell); Bulgarian split
squat 25 × 10 is 1,000; goblet squat 50 × 10 is 500; barbell squat
unchanged.

## 2. Em dash sweep

No em dashes (—) or en dashes (–) in any user-visible string in
`apps/mobile`, `apps/web` or `packages/shared`. Comments and code are fine.

- Grep for both characters, list every hit that reaches a user, and fix
  each with a period, comma, or " · ".
- `/routines/$slug` page titles: `" — Free | LiftCamp"` becomes
  `" | Free | LiftCamp"`. Do the same for any other `<title>` or meta
  description with a dash.
- Empty-value placeholders in set rows and tables (a lone "—" meaning "no
  value"): report these separately with their locations before changing
  them. Don't change them yet.
- Guide and routine content files count as user-visible.

## 3. `birth_year`

Confirm nothing in `apps/` or `packages/` reads or writes
`user_profiles.birth_year` outside `database.types.ts`. Report the result.
If clean, remove it from `database.types.ts` in a separate commit, so Alan
can run Part 2 of the SQL after this merges.

## 4. docs/new-programs.sql

Two Day Full Body and Two Day Dumbbell Full Body insert with
`hide_from_onboarding = true`. Production has them visible since 24 Sep.
Change those two `true` values to `false` so the doc matches.

## Verify

1. Shared tests pass, including the new volume tests. Mobile and web
   typecheck.
2. On a phone: a finished workout with dumbbell bench shows double the
   volume it did before on its summary and in History. A barbell-only
   workout's volume is unchanged.
3. `/routines/phul` title in the browser tab reads "PHUL Workout Routine
   (Power Hypertrophy Plan) | Free | LiftCamp".
