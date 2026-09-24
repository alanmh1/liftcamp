# LiftCamp mobile: Strength level on the exercise screen

Branch `strength-level`, off main after `profile-settings` merges. Never
merged by the session that built it.

DATABASE RULE: read-only queries only. No schema change is needed; this
reads `user_profiles.sex`, `birth_year`, `bodyweight` and `weight_unit`
from `profile-settings`.

No new native dependencies. Stage files by explicit path. Never
`git add -A` or `git add .`.

## Read first

- `apps/mobile/src/app/(tabs)/exercises/[id].tsx` (the placeholder comment
  after Records marks where this goes)
- `packages/shared/src/exercise-progress.ts` (`exerciseRecords`)
- `packages/shared/src/one-rep-max-model.ts`
- `packages/shared/src/units.ts`
- `apps/mobile/src/data/home.ts` (`getBodyProfile`)
- `apps/mobile/src/app/settings.tsx`
- `docs/exercises-tab-spec.md` (Summary section and the estimated max info
  sheet this should match)

## REPORT FIRST

Stop and report before building if:

1. Dumbbell exercises are logged as the weight of both dumbbells together
   anywhere, or the convention is unclear. The standards below assume the
   weight of one dumbbell.
2. The Records "Estimated max" value is not the all-time best estimate
   across finished sessions.
3. Any of the nine exercise ids below is missing from `exercises`.

## What it is

A section on the exercise screen's Summary, after Records, that places the
user's estimated max on five levels: Beginner, Novice, Intermediate,
Advanced, Elite. It uses the all-time estimated max the Records section
already shows, so the two never disagree.

v1 covers nine exercises. Any other exercise shows no section at all.

| Exercise | id | Load |
|---|---|---|
| Barbell Squat | 85495e85-bd72-445d-a6c8-5961f17ec2e5 | bar |
| Barbell Bench Press | d5f93fa3-b43b-4306-8081-ee5bff0d4ca6 | bar |
| Barbell Deadlift | 034ebb98-56b3-4073-a726-1709d14b4455 | bar |
| Standing Military Press | 83e390eb-2f53-427e-8870-2997eb172279 | bar |
| Bent Over Barbell Row | 7492d613-b2ff-41c0-9131-af0bb9832438 | bar |
| Romanian Deadlift | 21e9e394-1151-4a07-bb3a-2fd487e461dd | bar |
| Wide-Grip Lat Pulldown | 653288a1-8c39-4840-a2bc-c6eb64790c82 | stack |
| Dumbbell Bench Press | 05510482-9385-455f-85b4-96aef279939c | one dumbbell |
| Dumbbell Shoulder Press | 6db0743b-b1be-4071-b663-af358c7f47bb | one dumbbell |

Leg press is left out on purpose. Sled weight and angle differ so much
between machines that a level would mean nothing.

## The standards (`packages/shared/src/strength-standards.ts`, new)

LiftCamp's own table, written for this app. Do not copy numbers from
Strength Level, ExRx, Symmetric Strength or any other published table.

Each value is a multiple of bodyweight at which the level starts, for a
lifter at the reference bodyweight (80 kg male, 65 kg female). Below the
Novice value is Beginner.

Male: Novice, Intermediate, Advanced, Elite

| Exercise | N | I | A | E |
|---|---|---|---|---|
| Barbell Squat | 1.00 | 1.50 | 2.00 | 2.50 |
| Barbell Bench Press | 0.75 | 1.00 | 1.50 | 2.00 |
| Barbell Deadlift | 1.25 | 1.75 | 2.50 | 3.00 |
| Standing Military Press | 0.50 | 0.70 | 0.90 | 1.15 |
| Bent Over Barbell Row | 0.60 | 0.85 | 1.10 | 1.40 |
| Romanian Deadlift | 0.90 | 1.30 | 1.80 | 2.30 |
| Wide-Grip Lat Pulldown | 0.65 | 0.90 | 1.15 | 1.45 |
| Dumbbell Bench Press | 0.30 | 0.45 | 0.60 | 0.80 |
| Dumbbell Shoulder Press | 0.20 | 0.30 | 0.40 | 0.52 |

Female: Novice, Intermediate, Advanced, Elite

| Exercise | N | I | A | E |
|---|---|---|---|---|
| Barbell Squat | 0.65 | 1.00 | 1.50 | 1.90 |
| Barbell Bench Press | 0.40 | 0.65 | 0.90 | 1.20 |
| Barbell Deadlift | 0.90 | 1.25 | 1.75 | 2.25 |
| Standing Military Press | 0.30 | 0.45 | 0.60 | 0.80 |
| Bent Over Barbell Row | 0.35 | 0.55 | 0.75 | 1.00 |
| Romanian Deadlift | 0.60 | 0.90 | 1.30 | 1.70 |
| Wide-Grip Lat Pulldown | 0.40 | 0.60 | 0.80 | 1.00 |
| Dumbbell Bench Press | 0.15 | 0.25 | 0.35 | 0.48 |
| Dumbbell Shoulder Press | 0.10 | 0.16 | 0.23 | 0.31 |

### Bodyweight scaling

Heavier lifters lift more in total but less per pound of bodyweight, so a
straight multiple overrates light lifters and underrates heavy ones. Scale
with an exponent of 0.67 around the reference:

`threshold_kg = multiple × ref_kg × (bodyweight_kg / ref_kg) ^ 0.67`

### Age

Multiply every threshold by:

| Age | Factor |
|---|---|
| 13 to 17 | 0.85 |
| 18 to 39 | 1.00 |
| 40 to 49 | 0.95 |
| 50 to 59 | 0.87 |
| 60 to 69 | 0.78 |
| 70 and up | 0.70 |

Age is the current year minus `birth_year`. No birth year means 1.00.

### Functions, with tests

- `STRENGTH_EXERCISES`: the nine ids.
- `strengthThresholds(exerciseId, sex, bodyweightKg, age | null)`:
  four thresholds in kg, or null when unsupported or sex is not
  `male`/`female`.
- `strengthLevel(estimatedMaxKg, thresholds)`: `{ level, index, next,
  toNext }`, where `next` is the next level's name and `toNext` the kg
  still needed. Elite has no next.
- Tests: an 80 kg male with a 120 kg squat is Intermediate with 40 kg to
  Advanced; bodyweight scaling makes a 60 kg lifter's thresholds lower in
  kg and higher as a multiple; age 55 lowers every threshold by 13%;
  unsupported ids and `unspecified` return null.

Work in kg inside the shared functions. The screen converts to the user's
unit with `units.ts`.

## The section

Title "Strength level", with an info button that opens a sheet, styled the
same as the estimated max info sheet.

States, in order of precedence:

1. **Unsupported exercise:** no section.
2. **Sex is `unspecified`:** one muted line, "Strength levels compare you
   with other lifters of the same sex, so they stay hidden when that's not
   set." and a text button "Change in Settings".
3. **Sex or bodyweight missing:** a card, "See how your lifts compare",
   "Add your bodyweight and sex in Settings. It takes 10 seconds.", and a
   button "Add details" that pushes `/settings`.
4. **No estimated max yet** (no completed sets): the level scale with no
   marker and "Log a set to see your level."
5. **Has an estimated max:**
   - The level name, large, for example "Novice".
   - A five-segment bar, Beginner to Elite, with a marker at the user's
     position. Within a segment the marker sits proportionally between
     the two thresholds. Beginner runs from 0 to Novice. Elite fills its
     segment once reached.
   - Under the bar, "25 lbs to Intermediate" (estimated max gap, rounded
     up to the nearest 5 lbs or 2.5 kg). At Elite, "Top level. Nice work."
   - A small table of the four thresholds at their bodyweight, rounded to
     the nearest 5 lbs or 2.5 kg, the current level's row emphasised.

The screen re-reads the body profile on focus, so returning from Settings
updates the section.

### Info sheet copy

"Your strength level compares your estimated max with lifters of the same
sex, bodyweight and age. Most people spend their first year between
Beginner and Intermediate, and moving up one level is real progress.

These levels are LiftCamp's own estimates. Use them to track your own
progress, not to compare against a coach's numbers."

### Beginner framing

Nobody sees a red or warning colour for being a Beginner. Every level uses
the same accent. The "to next level" line is the focus, not the label.

## Copy

No em dashes and no colons in app copy. "Estimated max", never "1RM".

## Verify

1. Barbell Squat with a logged set, sex and bodyweight set: level, bar,
   gap line and thresholds show, and the estimated max matches Records.
2. Clear bodyweight in Settings, come back: the "Add details" card shows.
3. Set sex to Prefer not to say: the muted line shows.
4. An unsupported exercise such as Leg Press shows no section.
5. Switch to kg: thresholds and the gap line show in kg, the level
   unchanged.
6. `pnpm -F @liftcamp/shared test` passes.
