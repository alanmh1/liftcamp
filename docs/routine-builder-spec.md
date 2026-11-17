# Routine builder and Workout tab refresh

Branch: `routine-builder`. Free (custom routine cap applies as it does to Save routine), OTA-eligible (JS only, no new native modules). iOS and Android.

Mockup: Claude Design canvas "LiftCamp routine builder mockups", frame 1 (Workout tab) and frame 8 (Find a routine tiles). Frames 2 to 5 predate the decisions below and are layout reference only.

## Why

Users plan a workout before they lift (tester example: planning a hotel leg day). Today the only way to build a routine is to start an empty workout, which starts the timer, then save it as a routine afterward. The builder lets them plan without starting anything.

## Part 1: Routine builder

### Route

New root modal route `src/app/routine-builder.tsx`, presented like `/workout/[id]` (full screen, slides up), so it opens the same way from the Workout tab and Home.

- `/routine-builder` creates a new routine.
- `/routine-builder?id=<templateId>` edits an existing user routine (name and exercises).

### Screen

Header row, level with the title (same pattern as Finish on the workout screen):
- Left: **Cancel** (text button). With unsaved changes, confirm: "Discard this routine?" / "Keep editing" / "Discard" (destructive). Edit mode copy: "Discard your changes?".
- Center title: **New routine** or **Edit routine**.
- Right: **Save** (filled accent pill). Disabled until the name is non-blank and there is at least one exercise.

Body, in a ScrollView with the keyboard overlap handling the workout screen uses:
1. **Name** field, label "Name", placeholder "Routine name". Autofocus on a new routine. A same-name hint below it when the trimmed name matches one of `getUserRoutineNames` (reuse the copy from Save routine's same-name warning).
2. Gold `TipNote` on a new routine only: "Plan it now, lift later. Starting weights get filled in when you start the workout." Hidden in edit mode.
3. One card per exercise (card surface, not flat rows), in order:
   - Thumbnail, exercise name, and a ⋯ button opening a small menu: **Replace**, **Remove** (destructive). Replace opens `ExercisePicker` in `single` mode.
   - **Sets**: a stepper (− value +), 1 to 10, default 3.
   - **Reps**: a text input, placeholder "8-12", default empty. Free text, stored as `target_reps` exactly as typed (trimmed; blank stores null). Same free-text rules the system routines use ("8-12", "10", "30s", "8 each").
4. **+ Add exercise** outline button after the last card (matches the workout screen's in-list placement). Opens `ExercisePicker` in `multi` mode, `excludeIds` = exercises already in the routine. Confirmed picks append in selection order with default targets.
5. **Reorder** text button next to the exercise count heading when there are 2+ exercises, opening the existing `ReorderListModal`. No drag handles in this build.
6. **In rotation** switch row, new routine only: label "In rotation", sub-line "Shows up in Up next after your other routines". Default on. Edit mode hides it (the routine menu already toggles rotation).

### Save

- New: `useRoutineCapCheck` runs **before the builder opens** (at every entry point), not at Save, so nobody builds a routine they cannot keep. Save calls `insertRoutine(userId, { name, program: null, exercises, inRotation })`.
- Edit: if the name changed, `renameTemplate`; if exercises or targets changed, `updateRoutineExercises`. Edit is only offered for the user's own routines, never system templates.
- Online only, like every routine write. On `offline`: "You're offline. Your routine is still here, save it when you're back online." and stay on the screen with the draft intact. On `failed`: "Could not save that routine." / "Try again."
- After a new save: dismiss the modal, then push the new routine's detail on the current tab's stack (`navHref({ kind: 'routine', id })`), where Start is the primary action. After an edit save: dismiss back to where it opened, which reads again on focus.
- Invalidate the user templates cache the same way `updateRoutineExercises` does so Workout and Home show the change on focus.

Note on program copies: a routine saved via Use routine (has `program_slug`) is still the user's own row and can be edited. Allow it; editing does not change its program grouping.

### Entry points

1. Workout tab start card, second row: **Build a routine** / "Plan exercises, sets and reps ahead" (see Part 2).
2. Routine menu (`RoutineMenuSheet`, used by ⋯ on rows, the Up next card and the routine detail header): new first item **Edit routine**, opening `/routine-builder?id=`. Keep Rename as is.

Guests: same rule Save routine follows today for guests. Do not add a new gate.

## Part 2: Workout tab (`src/app/(tabs)/train/index.tsx`)

Order top to bottom, with a saved rotation:

1. **Up next** card, unchanged.
2. **Your rotation**: header "Your rotation" with Edit (unchanged behavior). Sub-line changes to "Then these, in order". The list now **starts after the Up next routine** and continues in rotation order, wrapping around (so it reads as what comes next). Show the first 3. When there are more, a full-width row at the bottom of the list, accent text with a down chevron: "Show all N routines" (N = every saved routine: rotation plus out of rotation, minus the Up next one). Expanded, it shows the rest of the rotation, then the out-of-rotation routines under a small "Not in rotation" label, then "Show less" with an up chevron. Expanded state is local, resets on blur.
   - This replaces the separate **Other routines** section.
   - Rows keep their current content and Start pill. Add the rotation position as a small number badge at the left of rotation rows (1, 2, 3 relative to after Up next). Out-of-rotation rows get no badge.
   - With 1 routine in the rotation (only Up next), the section hides unless there are out-of-rotation routines, in which case it shows only the collapsed "Not in rotation" group behind the Show all row.
3. **Start card**: one card surface holding two rows separated by a hairline:
   - **Start empty workout** / "Add exercises as you go" (behavior unchanged; shorter sub-line).
   - **Build a routine** / "Plan exercises, sets and reps ahead", leading icon a pencil in the same accent-soft circle as the plus. Runs the cap check, then opens `/routine-builder`.
4. **Find a routine**: replaces the horizontal `ProgramRow` on this tab with a 2×2 grid of the first 4 programs from `starterPrograms`.
   - Heading "Find a routine" with the existing sub-line (`matchHeading`). Right side: **See All** pill (accent-soft fill, accent text, 14 pt semibold, about 30 pt tall) opening the routines browser. A matching pill style is fine for Edit later; not in this build.
   - Tile (new `ProgramGridTile`, in `routine-grid.tsx` beside `RoutineTile`): card radius, 1 pt hairline border, no shadow. Top area plain card background, about 86 pt tall, the program's clay art (`art` map, same as today) contained and centered. A hairline divider, then a band in `c.accentSoft` (one color for every tile, no per-card tints) holding the program name (exercise-name style) and "N days a week" (meta style, `c.text2`). Tile height ends up about 146 pt.
   - Fewer than 4 programs: show what there is. The skeleton is 4 tile placeholders.
   - Home keeps `ProgramRow` (carousel) for now.
5. **Exercise library**: same card, text centered (title and count), chevron pinned to the right edge and vertically centered.

With no rotation (new user): Find a routine leads as today, then the start card (both rows), then out-of-rotation routines if any, then Exercise library.

Dark mode: every new color comes from theme tokens (`accentSoft`, `accentText`, `text2`, `text3`, hairline/border token); no hard-coded hex.

## Out of scope

- Timer starting on the first completed set (separate change).
- Weights in routines (no schema change).
- Drag to reorder in the builder.
- Home's Find a routine carousel.

## Test steps

1. TERMINAL: shared tests pass; `pnpm --filter @liftcamp/mobile exec tsc --noEmit` passes.
2. SIMULATOR (Alan): Workout tab with 9 saved routines. Up next shows one; Your rotation shows the next 3 numbered 1 to 3; "Show all" expands to the rest plus a "Not in rotation" group; "Show less" collapses; leaving the tab and coming back shows it collapsed.
3. SIMULATOR: tap Build a routine. Save is disabled. Type a name, add 3 exercises from the picker, set one to 4 sets and "10" reps, reorder two, leave In rotation on, Save. You land on the new routine's detail with Start. Back on Workout it is last in the rotation.
4. SIMULATOR: Build a routine, add one exercise, Cancel. The discard confirm appears; Discard closes with nothing saved.
5. SIMULATOR: on the new routine, ⋯ then Edit routine. Change the name, remove an exercise, add one, Save. The detail shows the change; Up next and Your rotation show the new name.
6. SIMULATOR: type the name of an existing routine in a new builder. The same-name hint shows.
7. SIMULATOR: with a free (non-Pro) test account at the custom routine cap, tap Build a routine. The cap alert shows and the builder does not open.
8. SIMULATOR: airplane mode, build a routine, Save. The offline message shows and the draft stays.
9. SIMULATOR: Find a routine shows a 2×2 grid with art, one band color, See All pill opens the browser; a tile opens the routine detail. Check light and dark.
10. ANDROID EMULATOR: steps 3 and 9.
