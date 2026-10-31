# Custom exercises

Branch `custom-exercises`, worktree `~/code/liftcamp-custom-exercises`. Mobile half is OTA-eligible (no native modules). Web half ships on Vercel with the same merge.

Users create their own exercises when the catalog lacks one. Free accounts get a capped number (an /admin setting, 5 at launch); Pro is uncapped. The feature sits behind a `custom_exercises` flag with the same switch-plus-grant model as social, and is off for everyone until Alan turns it on in /admin.

The database half is `docs/custom-exercises.sql`, which Alan runs himself. It is already written and tested; read it before touching code, because it fixes the contract. Summary:

- `exercises.owner_id` (null = catalog, user id = that user's custom row) and `exercises.archived_at` (a deleted custom row; history keeps it).
- RLS: everyone reads catalog rows, each user also reads their own custom rows, insert and update only on own rows, no delete. The trigger `private.exercises_guard_custom` refuses writes when the flag is off (`custom_exercise_off`), past the cap for non-Pro (`custom_exercise_limit: N`), or malformed (`custom_exercise_invalid: ...`). All are SQLSTATE P0001; the app keys on the first word of the message.
- The trigger also forces the row's shape: slug `custom-<id>`, `all_primary_muscles` = `primary_muscle`, every media and catalog-only column nulled. The app sends only `id, name, owner_id, primary_muscle, secondary_muscles, equipment, weight_type, set_type, is_unilateral, mechanic`.
- `custom_exercise_status()` returns `{enabled, member, pro, used, limit}` for the caller.
- `app_settings` table, `admin_list_settings()`, `admin_set_setting(key, value)`. The only key is `free_custom_exercise_limit`.
- `admin_set_flag` and `admin_set_global_flag` now accept `'custom_exercises'` as well as `'social'`; `admin_list_flags(p_flag)` already takes the flag name.

Do not start Metro or the Simulator. Alan checks UI himself.

## Mobile

### 1. Access store: `lib/custom-exercise-access.ts`

Copy the pattern in `lib/tester-pro.ts`, not `lib/social-access.ts`. Social latches its launch answer for the whole run because surfaces appearing mid-session would be jarring. A Create row can appear mid-session without harm, and the cap count changes every time the user creates or deletes, so this store should refresh.

- Reads `supabase.rpc('custom_exercise_status')` on user change, on foreground, and on demand (`refreshCustomExerciseStatus()` after every create, delete and restore).
- Caches the last answer per user in AsyncStorage under `${APP_STORAGE_PREFIX}custom-exercises:<userId>` so the Create row draws on the first frame after launch.
- Fails closed: signed out, guest, or no cached answer means `enabled: false`.
- Exposes `useCustomExerciseStatus(): { enabled, pro, used, limit } | null`.

Guests never see the feature. The trigger refuses them anyway (`is_member`), so the UI only has to hide the row.

### 2. Data: `data/custom-exercises.ts`

```ts
export type CustomExerciseDraft = {
  name: string;
  primaryMuscle: string;        // CANONICAL_MUSCLES key
  secondaryMuscles: string[];   // joined with '|' like the catalog
  equipment: string | null;     // one of the canonical equipment values or null
  trackType: 'weighted' | 'bodyweight' | 'timed';
  unilateral: boolean;
};
```

`trackType` maps to columns: weighted → `weight_type 'standard', set_type null`; bodyweight → `weight_type 'bodyweight', set_type null`; timed → `weight_type 'standard', set_type 'cardio'`. `has_incline` stays false. `mechanic` is `'isolation'` when one muscle is chosen and `'compound'` with any secondaries; it only affects the progression step and the meta line.

- `createCustomExercise(userId, draft)`. Client-generated `id` via `randomUUID()` (the slug is derived from it server side). Resolves with the row as read back, so the picker can select it at once.
- `updateCustomExercise(userId, id, draft, lockTracking)`.
- `archiveCustomExercise(userId, id)` sets `archived_at = now()`. `restoreCustomExercise` clears it.
- `customExerciseHasSets(userId, id)`, which decides the tracking lock.

**Built as direct writes, not through the write queue.** The user is in a form and wants the answer now; a refusal at the cap or with the flag off has to show in the sheet, not surface minutes later from a queue flush. Offline, the sheet says "You're offline. Try again when you have signal." and keeps the draft. Sets logged against a custom exercise still go through the queue like any other; the exercise row is on the server before any set can reference it.

Errors come from `classifyCustomExerciseError` in shared: the trigger's three refusals (`off`, `limit`, `invalid`), `offline` for a transport failure, else `unknown`. Copy in `customExerciseErrorCopy`.

Add `owner_id` and `archived_at` to `EXERCISE_FIELDS` and `START_EXERCISE_FIELDS` in `data/workouts.ts` and to `ExerciseInfo`. Add `isCustom(e)`.

### 3. Search and library

`searchExercises` in `data/workouts.ts` already returns the user's custom rows, because RLS includes them and the generated `search_all` covers the name. Two changes:

- Filter `archived_at is not null` out of search and the library (`.is('archived_at', null)`). History and workout detail load exercises by id through joins and must keep showing archived ones.
- The session cache `allExercisesCache` must be invalidated after any custom create, update, archive or restore. Add `invalidateExerciseCache()` next to `peekAllExercises` and call it from the data layer.

Add a "Custom" chip to `FilterChips` in `library-filters.tsx`, after Yours, that filters to `owner_id != null`. Empty copy for it: "Exercises you create will show up here."

### 4. The Create row

In both the library (`exercise-library.tsx`) and the picker (`workout/exercise-picker.tsx`), when `status.enabled`:

- Any search term with zero results: the empty state becomes a tappable row, `Create "<term>"`, with a plus icon, that opens the create sheet with the name pre-filled from the raw (not normalized) term.
- The list footer, always: a quieter `Create a custom exercise` row. When `!pro`, its meta line reads `<used> of <limit> used`.
- At the cap (`!pro && used >= limit`): both rows still render, but tapping opens the cap sheet instead of the create sheet. Don't hide the row; the user should learn the feature exists and what the limit is.

When `status` is null or `enabled` is false, none of this renders and the two screens look exactly as they do today.

### 5. Create / edit sheet: `components/exercises/custom-exercise-sheet.tsx`

A `BottomSheet` (the existing `components/BottomSheet`) with:

- Name (TextInput, 2 to 60 chars, required)
- Primary muscle (opens `PickSheet` with `CANONICAL_MUSCLES`, required)
- Secondary muscles (same, multi-select, optional)
- Equipment (PickSheet over the canonical equipment list, optional, default none)
- Tracking: segmented control (`components/exercises/segmented.tsx`) with Weight and reps / Bodyweight reps / Time
- One arm or leg at a time: switch
- Save button. Disabled until name and primary muscle are set.

Edit mode is the same sheet with fields pre-filled, plus a Delete row at the bottom. Delete asks once ("Delete <name>? Your logged sets stay in your history.") and archives. Tracking type cannot be changed once the exercise has any logged set (Hevy's rule; mixing weighted and timed sets in one history breaks PRs). Show the control disabled with the meta "Can't change once you've logged it".

Copy rules: no colons in app copy, no em dashes, "routine" not "program".

### 6. Cap sheet: `components/exercises/custom-limit-sheet.tsx`

Title "You've used your free custom exercises". Body: "Free accounts can create <limit>. Delete one to make room, or upgrade to Pro for unlimited." Until Pro is purchasable (`PRO_LAUNCHED` false, see `docs/pro-billing.md`), the Pro line reads "Pro is coming soon with unlimited custom exercises." and there is no upgrade button, only Done. When `PRO_LAUNCHED` is true, add an Upgrade button that opens the paywall; wire it to whatever pro-billing lands.

### 7. Where custom exercises show up elsewhere

- Exercise rows and cards (`ExerciseThumb`): no media, so they get the `LetterTile`. That is fine for v1. Backlog: a tile per equipment using the clay renders in `assets/images/equipment/`.
- Exercise screen (`exercises/exercise-screen.tsx`): history, records and progress chart work as is since they key on `exercise.id`. Hide the How-To button and the description block when `isCustom`. Replace the strength level section with nothing (no standards). Add an Edit button in the header that opens the sheet in edit mode.
- Exercise info sheet from the picker: same, no media and no How-To; show the meta line and an Edit action.
- Progression chip: `progressionFor` works off `weight_type`, `equipment` and `mechanic`, all of which custom rows carry, so it keeps working. Keep it; it's a Pro surface already.
- Routines: `template_exercises` references `exercises.id`, so custom exercises save into routines like any other. Nothing to change.
- Body diagram on the summary: driven by `primary_muscle`, works.
- Share cards and the social feed: show the name as is.
- Guest merge (`merge_guest_account`): guests can't create, so there is nothing to move. Leave it.
- Account deletion: `owner_id` cascades, and `workout_exercises.exercise_id` rows for that user are already deleted by the existing cascade from workouts. Verify `admin_delete_user` in the SQL editor doesn't trip on the new FK ordering; it deletes from `auth.users`, so the cascade handles it.

## Web

`apps/web` reads the catalog with the publishable key (`publicClient()` in public-catalog and mcp/catalog), so RLS already keeps custom rows off every public page. The `.is("owner_id", null)` filter on every catalog query is belt and braces: it states the intent and survives a client swap to the service role. Only `migrate-images` uses the service role, and it filters by image host, which custom rows never have. Files:

- `src/lib/public-catalog.functions.ts`, every `.from("exercises")` (there are seven; the two `.in("id", ...)` lookups for substitutes and routine days can skip it since those ids come from catalog rows, but adding it costs nothing).
- `src/lib/mcp/catalog.ts`.
- `src/lib/migrate-images.functions.ts`.
- `src/routes/sitemap[.]xml.ts` and `src/routes/llms[.]txt.ts` if they query directly rather than through public-catalog.
- The exercise count on the homepage and library ("900+ exercises") must count catalog rows only.
- Any admin RPC that joins `exercises` for "Most used exercises" should filter in SQL; check `admin_overview` and add `AND e.owner_id IS NULL` if it joins.

Test: a Vitest case in `public-catalog` that inserts nothing but asserts the query builder adds the filter is thin; better, add the `owner_id IS NULL` guard to the SQL functions the web calls where they exist, and rely on the `.is()` filter on the direct reads.

### /admin: Feature flags section

A new section between Pro access and Delete user in `src/routes/admin.tsx`, `FeatureFlagsSection`:

- One card per flag (`social`, `custom_exercises`). Each shows the global switch (a toggle calling `admin_set_global_flag`), then the per-user list from `admin_list_flags(p_flag)` with state and granted-by, and a form to grant, revoke or clear by email through `admin_set_flag`. Social has had these RPCs since October with no UI, so this gives it one too.
- A Settings card under the flags: each row from `admin_list_settings()` with an inline number input and Save calling `admin_set_setting`. Today that's one row, the free custom exercise limit. Show the "updated by, when" meta.
- Errors from the RPCs are shown as is, same as `ProAccessSection`.

Highland styling, same as the rest of /admin.

## Order of work

1. Alan runs `docs/custom-exercises.sql` (SUPABASE, SQL editor). Flag stays off, so nothing changes for users.
2. Web: owner_id filters, admin section, deploy. Built 31 Oct 2026 (branch `custom-exercises`).
3. Mobile: store, data, search changes, Create row, sheets, exercise screen tweaks. Built 31 Oct 2026, same branch, tsc clean; not yet checked in the Simulator.
4. Alan merges, ships OTA, grants `custom_exercises` to himself and Justin in /admin, tests, then flips the global switch.

## Status, 31 Oct 2026

Built and committed on `custom-exercises`, unmerged. Still to do:

- Simulator pass on the create sheet (17 muscle chips wrap; check it reads well), the picker's Create row in both modes, the exercise screen's Edit button, and delete.
- `admin_overview`'s "Most used exercises" joins `exercises` without an `owner_id IS NULL` guard, so a custom exercise could show its name to admins. Harmless, fix in SQL when convenient.
- The exercise info sheet from the picker shows a custom exercise as is (no steps, letter tile). Fine for v1.
- Tracking type lock reads `workout_exercises` on each edit open; cheap, but could be cached.

## Tests

- `packages/shared`: `custom-exercise.ts` with `draftToRow`, `rowToDraft`, `classifyCustomExerciseError`, each with a test file.
- Existing `set-focus` and `progression` tests get a custom-exercise fixture (`owner_id` set, no media) to prove nothing keys on media or description.
- Web: `public-catalog` tests assert custom rows are excluded from `listExercises`, `getExerciseBySlug` and the sitemap list.

## Out of scope

Photos or GIFs on custom exercises. Duplicating a catalog exercise as a starting point (good follow-up: "Duplicate" in the catalog exercise menu that opens the sheet pre-filled). Sharing custom exercises between users. The `assisted` weight type for the two assisted machines added 31 Oct, which needs reversed PR and progression math; separate branch.
