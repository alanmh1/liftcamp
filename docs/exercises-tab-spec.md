# LiftCamp mobile: Exercises tab

Branch `exercises-tab`, off main. Never merged by the session that built it.

DATABASE RULE: read-only queries only. Anything needing SQL goes to docs/.

No new native dependencies; runs in the current dev build. The one JS
dependency added is `vitest`, as a devDependency of `packages/shared` only,
so the shared functions have unit tests.

## Structure

`(tabs)/exercises` is a plain directory with a stack, the same pattern as
`(tabs)/history`: `exercises/index.tsx` (the library), `exercises/[id].tsx`
(the exercise screen), and `exercises/workout/[id].tsx` (a workout opened
from an exercise, hosted in this stack so Back returns to the exercise).
Not a route group.

The exercise picker and the active workout screen are unchanged. The info
sheet changes in one way: its numbered steps come from the extracted
`ExerciseSteps` component, which the exercise screen's How to segment also
uses. The library list is its own component (`ExerciseLibrary`) so the
picker can adopt it later. The workout detail screen's body lives in
`WorkoutDetailView`, rendered by both `history/[id].tsx` and
`exercises/workout/[id].tsx`.

## Screen 1: library (exercises/index.tsx)

- Native large title "Exercises", same header treatment as History.
- Search field: `searchExercises` with its 200 ms debounce.
- Filter chips in one horizontal row: Muscle, Equipment, Level, Yours.
  - Muscle and Equipment open a sheet with a single-select list. Muscles are
    `muscleLabel` over the canonical vocabulary; the Muscle chip matches
    `primary_muscle` only. Equipment is the distinct values in the library
    with `formatEquipmentLabel` and the equipment icon.
  - Level: Beginner, Intermediate, Advanced, where Advanced is the stored
    value `expert`.
  - Yours: only exercises with at least one completed set in a finished
    workout, sorted by most recently done.
  - Filters combine with each other and with search, applied in the client
    over the search results.
  - An active chip shows its value and a clear control.
- Rows: `listSurface`, thumbnail, name, then "primary muscle · equipment" in
  muted text. For exercises the user has done, a right-aligned "Last done"
  date. Last-done dates come from one query (`getLastDoneDates`), finished
  workouts only, refreshed on focus.
- Empty states: no search match ("No exercises match."), and Yours with
  nothing logged ("Exercises you log will show up here.").
- Tapping a row pushes `exercises/[id]`.

## Screen 2: exercise screen (exercises/[id].tsx)

Native header with back and the exercise name, set once the row loads. A
segmented control under it: Summary, History, How to. The selection is
remembered while the screen is open. The screen is one FlatList: the
header holds the segmented control and, for Summary and How to, the whole
body, so History can page without a list inside a scroll view.

### Summary

1. ExerciseHero.
2. Name, the two body diagrams, then Muscles and Equipment rows, as in the
   info sheet.
3. Progress chart, drawn with react-native-svg:
   - Metric chips. Load-based: Estimated max (default), Heaviest weight,
     Session volume. Rep-based: Most reps (default), Total reps.
   - Range: 3 months (default), 1 year, All.
   - One point per finished session in range, by workout date. Straight
     line between points, dots on each point, three y-axis labels (two when
     flat), the first and last date on the x-axis.
   - Tapping a point shows its value and date above the chart, with a
     "Show latest" control to return; with no point selected, the latest.
   - One session is a dot with no line. None is the empty state, "Log this
     exercise to see your progress here." Sessions outside the range show
     "Nothing in this range yet."
   - Units from UnitProvider's label.
4. Records, load-based, in this order:
   - Estimated max, with an info icon opening a sheet titled "Estimated
     max" whose body reads "The most you could likely lift for one rep,
     worked out from your best set. It uses your weight and reps together,
     so a set of 10 can beat a heavier set of 3." followed by the user's
     best set and result, "120 lbs × 10 → 160 lbs".
   - Best set, the set with the highest estimated max, "120 × 10".
   - Heaviest weight.
   - Most volume in a session.
   Rep-based: Most reps in a set, Most reps in a session.
   Tapping a record's value pushes `exercises/workout/[id]` for the workout
   it came from. A tie goes to the earlier session, the one that set the
   record first.
5. Space after Records for a Strength level section, not built here.

### History

- One card per finished session, newest first, 20 per page with infinite
  scroll, paged on a `finished_at` cursor.
- Card header: workout name and date, with a chevron that pushes
  `exercises/workout/[id]`.
- Set rows: set number and weight × reps (reps only for rep-based), using
  the app's set table column widths (`SetTable`). Completed sets only. An
  exercise appearing twice in one workout concatenates in `created_at`
  order and renumbers, the same rule the Previous column uses.
- PR ribbons on sets from `getPrSetIds`, so they match History and workout
  detail.
- Empty state as in Summary.

### How to

- The numbered steps from `parseSteps(description)` with Tip, Note and
  Caution asides, through `ExerciseSteps`.
- When `beginner_notes` has a row for the exercise, three sections above
  the steps: "Starting weight", "Form breakdown", and the substitution
  section under `substitution_heading` (else "Swap it out").
  `substitute_exercise_ids` render as tappable rows pushing
  `exercises/[id]`.
- Markdown: every row of the three fields is plain paragraphs separated by
  a blank line and nothing else (checked 16 Sep 2026: no headings, bold,
  italics, lists, links, code, quotes, HTML, tables, rules or em dashes).
  The renderer (`Paragraphs`) splits on blank lines. Revisit if the content
  grows a construct.

## Load-based or rep-based

An exercise is rep-based when `weight_type` is `bodyweight` and the profile
has no bodyweight, or when `equipment` is `body only` and none of its
completed finished sets has a non-null load from `effectiveLoad`. Everything
else is load-based. `isRepBased` in shared, used by the chart, the records
and the set table.

Counts on 16 Sep 2026: 251 of 902 exercises are `body only`, 11 of those
`weight_type = bodyweight`. A user with no profile bodyweight (every
mobile-only user, since mobile never writes it) sees all 251 as rep-based
until one is logged with a load.

## Data

`apps/mobile/src/data/exercise-progress.ts`:
- `getExerciseSessions(userId, exerciseId, { limit, before })`: finished
  workouts only, newest first, each with workout id, name, date, finish
  time and its completed sets in order.
- `getExerciseProgress(userId, exerciseId, exercise, bodyweight)`: every
  finished session, paged at `PR_SCAN_PAGE` and abandoned past
  `PR_SCAN_MAX_PAGES` (null), with each session's summary.
- `getLastDoneDates(userId)`: exercise id to latest finished workout date
  with a completed set.

`apps/mobile/src/data/exercises.ts`: `getBeginnerNotes(exerciseId)`.

`packages/shared/src/exercise-progress.ts`, with tests:
- `summarizeSession`: estimated max and the set that produced it, heaviest
  load, volume (via `setVolume`), most reps, total reps.
- `exerciseRecords`: the records across sessions, each with its workout id.
- `isRepBased`.
- `metricValue`: a session's value for a chart metric.

## Copy

No em dashes and no colons in app copy. "Estimated max", never "1RM".
