# Edit a finished workout

Branch `edit-workout`, worktree `~/code/liftcamp-edit-workout`. Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL. Everything here is JS, so it ships OTA. The UPDATE, INSERT and DELETE policies on `workouts`, `workout_exercises` and `sets` already exist (own rows only).

Prompted by tester Justin: he logged a dumbbell exercise as the weight of both dumbbells, and logged sets onto a similar exercise because the right one wasn't in the library yet. Today the workout detail is read-only, so his history stays wrong.

Read before starting: `app/workout/[id].tsx` (the live workout screen), `components/history/workout-detail-view.tsx`, `components/history/delete-workout.ts`, `data/workouts.ts`, `data/write-queue.ts`, `data/history.ts` (`getWorkoutDetail`), and in shared `write-queue.ts` and `pending-overlay.ts`.

## Why streaks and medals need nothing

Streaks count training days from finished workouts. Weight and reps never enter them. The date is locked in this version, so no edit can create or extend a streak. Medals are stored rows, insert only, so an edit can never take one away. PRs, records, volume and set counts are all computed on read, so they follow the edit with no extra work. The social feed's counts come from `social_feed()` and `social_workout()` on the server, which also read live rows.

## Approach

Reuse the live workout screen in an edit mode. It already has the set rows, keypad, ±% tray, plate sheet, swipe-to-delete with undo, Add set, Add exercise and the exercise menu (Info, Reorder, Replace, Add Note, Remove). Building a second editor would duplicate all of it.

The live screen writes every change through the write queue as it happens. Editing history needs Save and Cancel, so edit mode holds its writes in a draft and only queues them on Save.

### The draft

In shared, a small pure `DraftBuffer` (new `write-draft.ts`, with vitest):

- `capture(body: WriteOpBody, workoutId): boolean` keeps a body that touches the workout (its id, or `workoutId` in its `parents`, or in any insert row's `parents`) and returns true. Anything else returns false and is not kept.
- `bodies()` returns the kept bodies in the order they arrived.
- `clear()`, `size`.
- Tests: an update, insert and delete for the workout are kept in order; a body for another workout passes through; clear empties it.

In `data/write-queue.ts`:

- `beginDraft(userId, workoutId)`, `commitDraft(): Promise<number>` (enqueues every kept body in order, returns how many), `discardDraft()`, `draftHasChanges(): boolean`.
- While a draft is open, `enqueueWrite` hands each body to the buffer first. A captured body resolves `true` without touching the queue. The queue's own merging collapses the per-keystroke updates once they are committed.
- Anything in `data/workouts.ts` that writes outside the queue during an edit (`rememberRoutineNote` in `setWorkoutNotes` today) waits for Save. Check every function the edit mode can reach.
- `invalidateScanCache()` runs again after a commit.

## Edit mode on the live screen

Opened as `/workout/[id]?mode=edit`, from the detail screen only. The param is ignored for a workout without `finishedAt`, so a live workout can never enter edit mode. On mount it calls `beginDraft`; on unmount without a Save it calls `discardDraft`.

### Header

- Left: "Cancel", a text button in `accentText`. Right: "Save", the accent pill in Finish's place. The trash button is hidden.
- The elapsed clock is replaced by the workout's date line, the same `dateLine` the detail screen shows.
- No progress bar.
- Cancel with no changes closes. With changes, an alert: title "Discard your changes?", message "The workout stays as it was.", buttons "Keep editing" (cancel style) and "Discard" (destructive). The Android back button does the same as Cancel.
- The screen is a `fullScreenModal`, which has no swipe-down dismiss on iOS. Keep it that way, so changes can't be lost by a drag.

### Off in edit mode

- Rest: ticking a set starts no rest, so no tray, no rest alert, nothing saved to rest-store.
- Live Activity: no start, update or end.
- The phone's copy: skip `readDeviceWorkout` and `saveDeviceWorkout`. Load once from `loadWorkout`; don't reload for a unit change mid-edit.
- First-session banner, the Last time note, the "Not sure what to lift?" hint.
- Pro: progression chips and sheet, starting-weight suggestions, and warm-up row generation (`addWarmupRows`). Existing warm-up rows stay editable and keep their W badge. The plate sheet stays.
- The PR success haptic. The set-done light haptic stays, since it confirms an action. No new haptic call sites.
- Anything Finish does: no summary, no `finishWorkout`, no nudges.

### On in edit mode

Everything else, unchanged: edit weight and reps (and time, distance, incline for cardio), tick and untick sets, swipe-to-delete with undo, Add set, Add exercise, Reorder, Replace, set notes, Remove exercise, the workout note.

### Locked in this version

The date and time, the workout name, and the routine link.

### Save

`commitDraft()`, then `track(EVENTS.workoutEdited, { ops, replaced })` where `replaced` is true when the draft held a `workout_exercises` update to `exercise_id`. Add `workoutEdited: 'workout_edited'` to `EVENTS` in `lib/analytics.ts`. Then wait up to 3 s for the server (`syncedWithin(workout.id, SAVE_WAIT_MS)`) and close back to the detail screen. PRs are worked out from the server's rows on every read, so the wait is what lets the detail screen's ribbons show the edit on return. With no signal Save closes without it and the queue sends as it does for every other write. Save with no changes just closes, with no wait.

## Detail screen

- The header ellipsis gets "Edit workout" above "Delete workout", for the owner only (same `canDelete` check, rename it `isOwner`).
- Refetch when the screen regains focus (`useFocusEffect`), so the edit shows on return. Keep the current load on `id` and unit changes.
- `getWorkoutDetail` applies the pending ops overlay to its sets and exercises with `applyPendingOps`, the way `loadWorkout` does. An edit saved with no signal then shows at once on the detail. History rows, ribbons and the exercise screens catch up when the queue sends; that's accepted.
- Update the component's doc comment: the detail is no longer read-only.

## Order of work

1. Shared `write-draft.ts` and its tests. All shared tests green.
2. The draft in `data/write-queue.ts`, and the deferred side effects in `data/workouts.ts`.
3. Edit mode on `app/workout/[id].tsx`.
4. Detail screen menu, focus refetch, overlay in `getWorkoutDetail`.
5. Analytics event.
6. Typecheck mobile and shared, run shared tests, commit and push.

Stop and ask before any decision this spec leaves open.

## Copy

"Edit workout", "Cancel", "Save", "Discard your changes?", "The workout stays as it was.", "Keep editing", "Discard". No em dashes, no colons.

## Out of scope

Changing the date or time, renaming, editing from a History row's swipe, an edit history, bulk fixes across many workouts, the web.
