# Import workouts from another app (Fitbod first)

Branch `import-workouts`, worktree `~/code/liftcamp-import-workouts`. Branch, commit, push. No merging, no Metro, no Simulator runs, database read-only. The app side is JS only and ships OTA: the file picker is `File.pickFileAsync` in `expo-file-system` 57.0.7, already linked in the 1.1 binary. `docs/import-workouts.sql` (the name map table, its Fitbod rows and the `import_workouts` function) is already written; Alan runs it before the merge. Read it first.

Prompted by tester Justin, who was leaving Fitbod with three years of history. His file was imported by hand on 2 Nov 2026 (306 workouts, tagged `platform = 'import'`, `app_version = 'fitbod-csv'`), so the format below is checked against a real export. Strong and Hevy come in a second OTA once there are real exports to build from. Free for everyone with an account, never Pro: the roadmap rule is that nobody's data gets locked up.

Read before starting: `docs/import-workouts.sql`, `app/settings.tsx`, `components/workout/exercise-picker.tsx`, `components/settings-ui.tsx`, `data/workouts.ts` (catalog loading, `peekAllExercises`), `data/scan-cache.ts`, `data/medals.ts`, `lib/analytics.ts`, and in shared anything that normalizes exercise names for search (`search_text`, `alias_text`).

## Decisions already made

- Medals: imported history earns them. Nothing to build; `syncMedals` on the next Home load awards every milestone the dates reach, dated to its week.
- Unmatched exercises: map to a catalog exercise or skip. No creating custom exercises from an import (it would use up the free cap).
- Sources in this version: Fitbod only.

## The Fitbod file

Comma separated, header row exactly:

`Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier`

- `Date` is `YYYY-MM-DD HH:MM:SS +0000`, a real UTC time. Every row of one session carries the same `Date`.
- Numeric fields can have a leading space (`" 8"`, `" 2.0"`). Trim before parsing.
- `Weight(kg)` is always kg, per dumbbell for dumbbell work. Values converted from lb carry long decimals (`22.679618...`); round to 2 places.
- `multiplier` is Fitbod's volume factor (2 for a dumbbell pair, 4 for two dumbbells on each leg, 0 for cardio and holds). The weight is already per dumbbell, which is how LiftCamp stores it, so ignore the multiplier.
- `isWarmup` is `true` or `false`.
- Cardio rows have `Reps` 0, `Weight(kg)` 0, and time in `Duration(s)`, meters in `Distance(m)`, percent in `Incline`.
- Holds (Plank, Superman Hold) have `Reps` 0 and a duration.
- `Resistance` and `Note` were empty in the real file. Keep a non-empty `Note` as the set's note; ignore `Resistance`.
- Rows are newest session first. Inside a session, keep the file's order for exercises (first appearance) and for sets.

A file whose header doesn't match is refused with "This doesn't look like a Fitbod export." Notes can contain commas inside quotes, so parse CSV properly (RFC 4180 quoting), not with `split(',')`.

## Shared (with vitest)

New folder `packages/shared/src/import/`:

- `csv.ts`: `parseCsv(text): string[][]`. Quoted fields, doubled quotes, CRLF and LF, a UTF-8 BOM, a trailing newline.
- `fitbod.ts`: `parseFitbod(text): { ok: true, rows: FitbodRow[] } | { ok: false, reason: 'header' | 'empty' }`. A row: `{ startedAt: string (ISO), exercise, reps, weightKg, durationS, distanceM, incline, warmup, note }`, numbers trimmed and parsed, zeros kept as zeros here.
- `match.ts`: `matchExercises(names, map, catalog)`. Per distinct source name, in order: the `import_exercise_map` row (with its `close` flag), then an exact normalized name or alias match in the catalog (reuse the app's existing normalization), else unmatched. Returns `{ name, sets, exerciseId | null, close }` per name.
- `plan.ts`: `buildImportPlan(rows, choices, catalog, opts)` where `choices` maps each source name to an exercise id or `skip`, and `opts` is `{ source, existingDates: Set<string>, importedStarts: Set<string>, localDate(iso): string }`. It returns the payload for `import_workouts` and a summary.
  - A session becomes one workout, with every row for a skipped exercise left out. A session with nothing left is dropped.
  - `workout_date` is the device's local date of the start time, via `opts.localDate`.
  - A session on a local date that already has a finished workout not imported from this source is skipped. Users double-log while they switch, as Justin did for two weeks.
  - A session whose start is already in `importedStarts` is counted as already imported and left out.
  - `finished_at` is the start plus 150 seconds per set plus the cardio time, kept between 15 and 120 minutes. Fitbod doesn't export a duration.
  - `notes` is "Imported from Fitbod".
  - Sets for a cardio exercise (catalog `set_type` 'cardio') carry duration, distance and incline (incline only when the exercise `has_incline`, capped at 50) and no weight or reps. Other sets carry weight (null when 0, unit 'kg') and reps (null when 0), plus a duration when there is one. `set_type` is 'warmup' for warm-ups.
  - Summary: workouts to import, sets, first and last date, sessions skipped because the date is already logged, sessions already imported, sets left out by skipped exercises.
- Tests from a small hand-made fixture (no real user data): two sessions on one day, a warm-up, a treadmill row with incline, dumbbell rows with multiplier 2 and 4, a hold, a quoted note with a comma, leading spaces, a long kg decimal, a skipped exercise that empties a session, a double-logged date, an already-imported start.

## Mobile

### Settings

A new group "Your data", above Account:

- "Import workouts", chevron, opens `/import`. For a guest, an alert: title "Importing needs an account", message "Create a free account so your history is saved.", buttons "Not now" and "Create account" (to `/link-account`).
- When the user has imported workouts, a row "Imported from Fitbod" with the count, and "Remove" as the action. Confirm with title "Remove 306 imported workouts?", message "Workouts you logged in LiftCamp stay. Medals you've earned stay.", buttons "Cancel" and "Remove" (destructive). It deletes `workouts` where `platform = 'import'` and `app_version = 'fitbod-csv'` for the user (RLS allows deleting your own; exercises and sets cascade), then calls `invalidateScanCache`.

### `/import` screen

A stack screen with the title "Import workouts". Three steps, in place:

1. **Choose.** A short line: "Bring your history from Fitbod. Your workouts, sets and PRs come with it." Under it, a Fitbod row; tapping it opens the file picker (`File.pickFileAsync`, CSV types). One line of help under the row: "In Fitbod, export your workout data as a CSV and save it to Files." Below that, "More apps soon." Alan checks the help line against Fitbod before release.
2. **Review.**
   - At the top: "306 workouts, 3,970 sets", then "October 2023 to October 2026", then a line for each skip that applies ("12 sessions on days you already logged in LiftCamp", "306 already imported").
   - Then the exercise list, sorted: unmatched first, then close matches, then the rest under a "Matched" heading. Each row shows the Fitbod name with its set count, and on the right the LiftCamp exercise, or "Skip" in `text3`. A close match gets a small "Close match" label.
   - Tapping a row opens a sheet with "Choose exercise" (the ExercisePicker in single mode with New hidden; add a prop for that) and "Skip".
   - Unmatched rows start as Skip.
   - The primary button reads "Import 306 workouts" and updates as choices change. It's disabled at 0.
3. **Import.**
   - Calls `supabase.rpc('import_workouts', { p_source: 'fitbod', p_workouts })` 50 workouts at a time, with progress "Importing 150 of 306".
   - Offline at the start: "You're offline. Connect to import." If a call fails partway: "Imported 150 of 306. Try again to finish." Try again resends everything. The function skips what's already in, so nothing doubles.
   - When it's done: `invalidateScanCache()`, the catalog and history caches the History tab reads, then a done state with "306 workouts imported" and a "See History" button.

The whole flow reads the catalog with the app's existing loader and the map with one select on `import_exercise_map` for the source. Parsing happens on the phone; a 4,000-row file parses in well under a second.

### Analytics

Add `importStarted: 'import_started'` (props: `source`) when a valid file is parsed, and `importFinished: 'import_finished'` (props: `source`, `workouts`, `sets`, `skipped_exercises`) on success.

## What needs nothing

PRs, records, progress charts, strength levels, the week streak and Longest streak all read finished workouts and pick the imported ones up. Medals sync on the next Home load. The social feed hides notes for non-app platforms already, and imported workouts sort by their real dates, far below anything new.

## Order of work

1. Shared `import/` with tests, all shared tests green.
2. The ExercisePicker prop to hide New.
3. `/import` screen.
4. Settings group, guest alert, remove.
5. Analytics events.
6. Typecheck mobile and shared, commit and push.

Stop and ask before any decision this spec leaves open.

## Copy

As written above. No em dashes, no colons in app copy, numbers as digits with thousands separators ("3,970").

## Out of scope

Strong and Hevy (next OTA, from real exports), creating custom exercises from an import, importing routines or bodyweight, a web upload page, the marketing pages per source.
