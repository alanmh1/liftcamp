# Import workouts from Strong and Hevy

Branch `import-strong-hevy`, worktree `~/code/liftcamp-import-strong-hevy`. Branch, commit, push. No merging, no Metro, no Simulator runs, database read-only. JS only, ships OTA, same as the Fitbod import.

`docs/import-strong-hevy.sql` is already written. It adds 175 Strong names and the same 175 Hevy names to `import_exercise_map`, and makes `import_workouts` keep each workout's name. Alan runs it before the merge. Read it first.

The test fixtures are already in `packages/shared/src/import/__fixtures__/`: `strong-ios.csv`, `strong-android.csv`, `strong-current.csv`, `hevy-kg.csv`, `hevy-lbs.csv`. Each copies a real export's exact header, delimiter and quoting, with made-up workouts in it. Don't change their headers.

Read before starting: everything in `packages/shared/src/import/`, `apps/mobile/src/app/import.tsx`, the "Your data" group in `apps/mobile/src/app/settings.tsx`, `docs/import-workouts-spec.md`, and `docs/import-strong-hevy.sql`.

## Where the formats come from

From six real Strong exports and three real Hevy exports in public GitHub repos (Nov 2026), plus the Strong and Hevy importers in Ryot (IgnisDa/ryot), an open-source tracker that has handled both for years. Neither app publishes its format. What follows is what the real files do, and the parsers should accept all of it.

### Strong: three header variants

Detect the delimiter from the first line: `;` when it has more semicolons than commas, else `,`. Read columns by header name, trimmed and case-insensitive, never by position, since columns differ between variants and some files leave out RPE or Notes.

1. **iOS, older** (`strong-ios.csv`). Comma. `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE`. **Weight has no unit anywhere in the file.** It's in whatever unit the person had Strong set to, so the review screen asks (below). Distance has no unit either and follows the same answer: km with kg, miles with lb.
2. **Android** (`strong-android.csv`). Semicolon. Adds `Weight Unit` per row (`lbs`, `kgs`, or empty on a bodyweight or cardio row) and `Distance Unit` (`mi.`, `km`, or empty), and calls the duration column `Workout Duration`.
3. **Current** (`strong-current.csv`). Semicolon, every field quoted. Starts with `Workout #`, uses `Duration (sec)` (seconds), `Weight (kg)` and `Distance (meters)`. Accept `Weight (lbs)` too, in case a lb user's file says so.

Everything else is common to the three:

- `Date` is local wall time with no offset (`2025-03-04 18:30:12`). Build it with `new Date(y, m - 1, d, h, mi, s)` so it's the phone's time zone, never `new Date(string)`.
- A workout is every row sharing `Date` and `Workout Name`.
- `Set Order` is a number for a working set, `W` for a warm-up (set_type `warmup`), `D` drop set and `F` failure set (both kept as ordinary working sets), and `Rest Timer` or `Note` for rows that aren't sets. Drop those two.
- `Duration` is a string like `1h 5m`, `38min`, `55m` or `2h`. `Workout Duration` is the same. `Duration (sec)` is seconds. Real files contain junk like `264h 1m`. If the duration is missing, zero, or over 6 hours, fall back to the estimate the Fitbod import uses.
- `Reps` can be `10.0`. Round it.
- `Seconds` is a set's time, for holds and cardio. `Distance` is a set's distance.
- `Notes` is the set's note. `Workout Notes` is the workout's note, repeated on every row of the workout.
- A bodyweight set's `Weight` is 0.

### Hevy

Comma, fields quoted. Header:

`title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe`

A lb user's file has `weight_lbs` and `distance_miles` in those two places (`hevy-lbs.csv`). The header says the unit, so Hevy needs no unit question. Read columns by name here too.

- `start_time` and `end_time` are local wall time, in one of two formats: `14 Oct 2025, 18:05` (current) or `Jun 8, 2025, 8:13 PM` (older; Ryot accepts both). English month abbreviations. Build with the `Date` constructor in the phone's time zone, as for Strong. A file whose dates don't parse in either format is refused.
- A workout is every row sharing `start_time` and `title`.
- `set_type` is `warmup`, `normal`, `failure` or `dropset`. Only `warmup` changes anything.
- `weight_kg` or `weight_lbs` is empty on a bodyweight set. For a weighted bodyweight exercise (`Pull Up (Weighted)`) it's the added load, and for an assisted one (`Pull Up (Assisted)`) it's the assistance. Both line up with how LiftCamp's bodyweight and assisted exercises store weight, so pass them through.
- `exercise_notes` is per exercise and repeated on every row. Put it on that exercise's first set as the set note. `description` is the workout's note.
- `end_time` gives the real finish. If it's missing, earlier than the start, or more than 6 hours after it, use the estimate.
- Ignore `superset_id` and `rpe`.

## Shared

### One row type for all three sources

Today `plan.ts` takes `FitbodRow`. Give the parsers one shared type and let the plan take only that:

```ts
type ImportRow = {
  sessionKey: string;          // groups rows into one workout
  startedAt: string;           // ISO
  finishedAt: string | null;   // ISO, null when the file has no usable end or duration
  workoutName: string | null;
  workoutNote: string | null;
  exercise: string;
  warmup: boolean;
  weight: number | null;       // null when the cell is empty
  unit: 'kg' | 'lb' | null;    // null only for Strong's iOS file, until the user answers
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  incline: number | null;      // Fitbod only
  note: string | null;
};
```

`parseFitbod` adapts its rows to this. Its tests keep passing unchanged, or get only the edits the type change forces.

### New files

- `strong.ts`: `parseStrong(text)`, returning `{ ok: true, rows, variant: 'ios' | 'android' | 'current', unitKnown: boolean } | { ok: false, reason: 'header' | 'empty' }`. A header that has none of `Exercise Name`, `Set Order` and `Date` is `header`.
- `hevy.ts`: `parseHevy(text)`, same shape, with `unitKnown` always true.
- `detect.ts`: `detectSource(text): 'fitbod' | 'strong' | 'hevy' | null`, from the header alone.

### Changes in `plan.ts`

- `ImportSource` becomes `'fitbod' | 'strong' | 'hevy'`. Labels are Fitbod, Strong and Hevy.
- `ImportSetPayload.unit` becomes `'kg' | 'lb' | null`. A lb set is stored as lb; nothing gets converted. Each set already records the unit it was logged in, and Settings converts for display.
- `buildImportPlan` options gain `unit?: 'kg' | 'lb'` (fills in the unit wherever a row has none) and `dumbbellsCombined?: boolean` (halves the weight on sets whose LiftCamp exercise has `equipment` `dumbbell`, rounded to 2 places). `PlanCatalogEntry` gains `equipment`.
- The payload gains `name` (the workout name, or null). The workout note is the source's own note when there is one, otherwise "Imported from Strong" or "Imported from Hevy". Fitbod's stays "Imported from Fitbod".
- `finished_at` is the row's `finishedAt` when there is one, otherwise the existing estimate.
- Sessions are grouped by `sessionKey` instead of `startedAt`. The already-imported check still compares start times.

### Changes in `match.ts`

Two changes. Both apply to every source.

- **Alias matches become close matches.** Today an alias match counts as exact, but the catalog's aliases are loose. Checked against the real Strong files, `Overhead Press (Barbell)` would alias-match Alternating Cable Shoulder Press, and `Lat Pulldown (Cable)` would match Banded Lat Pulldown. Keep the match, but set `close: true` so the review screen labels it "Close match".
- **Try one more name, after the exact name and before aliases.** For a name shaped like `Base (Equipment)`, try `Equipment Base` against catalog names. `Squat (Barbell)` becomes Barbell Squat. Also treat a match on this rewritten name as exact. It's for names the map doesn't cover, mostly from Hevy's and Strong's larger libraries.

### Tests

From the five fixtures:

- Every variant parses.
- Strong's iOS file reports `unitKnown: false`. Android's per-row units come through, including `kgs`.
- `W` becomes a warm-up. `D` and `F` stay working sets. `Rest Timer` rows are dropped.
- `264h 1m` falls back to the estimate. `38min` and `1h 5m` parse.
- Both Hevy date formats parse, including the PM time.
- The doubled quotes in Hevy's description come through.
- `exercise_notes` lands on the first set only.
- An empty Hevy weight on Pull Up becomes 0 once it's matched to a bodyweight exercise.
- `weight_lbs` sets carry unit `lb`, and `distance_miles` converts to meters.
- `detectSource` identifies all five files plus the Fitbod fixture.
- With `dumbbellsCombined`, Incline Bench Press (Dumbbell) at 36 becomes 18.
- An alias match comes back `close: true`.
- `Squat (Barbell)` with no map row matches Barbell Squat through the rewrite.

## Mobile

### `/import`

**Choose.** Three rows in one group: Fitbod, Strong, Hevy. Each opens the same file picker. The file's header decides the source. If someone taps Strong and picks a Hevy file, just import it as Hevy without making a fuss about it. A file none of the parsers accepts gets "This doesn't look like an export from Fitbod, Strong or Hevy."

Help lines under the rows:

- "In Fitbod, export your workout data as a CSV and save it to Files."
- "In Strong, go to Settings, then Export Strong data, and save the file to Files."
- "In Hevy, go to Profile, Settings, Export & Import Data, then Export Workouts."

The Hevy line matches Hevy's own help article. Alan checks the Strong one in the app before release.

**Review.** Two new questions above the exercise list, each a two-option row.

- **"Weights in Strong were in"**, with lb and kg. Shown only for Strong's iOS file (`unitKnown` false). It starts on the user's LiftCamp unit. Under it, one line from the file so they can tell which: "Your heaviest Bench Press (Barbell) set was 185". Use the most logged barbell exercise; if there isn't one, the most logged exercise with a weight.
- **"Dumbbells were logged as"**, with "One dumbbell" and "Both together". Shown for Strong and Hevy when any matched exercise has `equipment` `dumbbell`. It starts on One dumbbell. Under it: "Your Incline Bench Press (Dumbbell) was usually 36 kg", using the median working-set weight of the most logged dumbbell exercise. Neither app enforces either way of logging. One real Hevy file had 16 kg lateral raises, and another had 30 lb rows alongside 123 lb dumbbell RDLs, so it really is a question per person. Fitbod is always one dumbbell, so it never shows there.

Both answers update the summary and the Import button live, the same way exercise choices do.

**Import and done.** No changes, except that all wording names the source.

### Settings

"Your data" shows one "Imported from …" row per source that has imported workouts, each with its own count and its own Remove. Remove deletes by that source's tag (`strong-csv`, `hevy-csv`).

### Analytics

`importStarted` and `importFinished` already carry `source`. Add `unit_asked` and `dumbbells_combined` to `importFinished`.

## Order of work

1. Shared: the `ImportRow` type, then the Fitbod adapter. Existing tests stay green.
2. `strong.ts`, `hevy.ts` and `detect.ts`, with tests.
3. The `plan.ts` and `match.ts` changes, with tests.
4. Mobile: the three Choose rows, the two review questions, and the Settings rows.
5. Typecheck mobile and shared, run the shared tests, commit and push.

Stop and ask before any decision this spec leaves open.

## Copy

As written above. No em dashes, no colons in app copy.

## Out of scope

Prompting switchers to import, in onboarding and on an empty History (a separate branch). Opening a CSV straight from another app's share sheet (needs a native build). RPE. Supersets. The History scan's 5,000-row limit, which a big Strong history can pass (a separate fix). Routines and bodyweight from either app.
