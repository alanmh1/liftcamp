# Import prompts, plus two fixes

Branch `import-prompts`, worktree `~/code/liftcamp-import-prompts`. Branch, commit, push. No merging, no Metro, no Simulator runs, database read-only. JS only, ships OTA. No SQL.

The import shipped on 3 Nov 2026 (Fitbod, Strong, Hevy), but the only way in is Profile, gear, Your data. Someone switching apps decides in their first few minutes whether their history comes with them, so they should be offered the import then, not have to go looking for it. Two entry points do that. Two small fixes ride along in the same branch.

Read before starting: `app/onboarding.tsx` (page 4, the routines page, and `finish`), `components/history/history-screen.tsx` (the empty state), `app/import.tsx`, the "Your data" group in `app/settings.tsx`, `app/link-account.tsx`, `lib/analytics.ts`, `data/history.ts` (`scanWorkoutExercises`, `PR_SCAN_PAGE`, `PR_SCAN_MAX_PAGES`), and `packages/shared/src/setup-checklist.test.ts` around line 319.

## 1. Onboarding, page 4

At the end of the routines page's scroll content, under the routine cards and See all, add one centred text link in `accentText`:

"Switching from Fitbod, Strong or Hevy? Import your workouts"

Tapping it finishes onboarding exactly as Skip does, with the same `finish('skip')` path, the target write and the iOS reminders sheet for a new account. Then it opens `/import` with `entry=onboarding`. If finishing and navigating in one tap fights the router (onboarding unmounts on `complete()`), have Home open `/import` once on its first mount after onboarding instead, from a one-time flag. Stop and ask if neither works cleanly.

It shows for returning users too.

## 2. Empty History

Under "Finish your first workout and it will show up here.", add a gap and then a text button in `accentText`, "Import from another app". It opens `/import` with `entry=history`.

It appears only in the empty state, never once there's a workout.

## 3. Guests on `/import`

Today only the Settings row stops guests, with an alert. The two new entries open `/import` directly, so the screen needs to handle guests itself.

For an anonymous user, the Choose step replaces the three app rows and help lines with:

- The existing intro line.
- "Importing needs a free account, so your history is saved." in `text2`.
- A primary button, "Create free account", that pushes `/link-account`. That screen goes back when it's done, so the user lands on `/import` again, now signed in, and sees the app rows. Check that the screen re-reads the session on return. If it holds the stale anonymous state, re-read on focus.

Settings keeps its alert as it is.

## 4. Analytics

`importStarted` and `importFinished` gain `entry`: `settings`, `onboarding` or `history`, from the route param, defaulting to `settings`. That shows which prompt brings people in.

## 5. Fix: the History scan's row cap

`scanWorkoutExercises` reads `workout_exercises` 500 rows per page, one page after another, and gives up past 10 pages (5,000 rows). It's all or nothing on purpose, since a partial scan invents PRs. But past the cap, every PR ribbon, Profile's PRs, volume and strength levels, and the exercise records all go blank. Five exercises a workout, four workouts a week, for five years, is about 5,200 rows. An import makes that reachable on day one.

Change it so that:

- The first page's request asks for the total with `count: 'exact'`.
- If the total is over one page, the remaining pages are fetched in parallel, at most 4 requests at once, and put back in page order. The `order('id')` and the range maths stay as they are.
- `PR_SCAN_MAX_PAGES` becomes `PR_SCAN_MAX_ROWS = 20_000`. A total above that returns null straight away, before any further page is fetched. Update the doc comment to say why it's still all or nothing.
- Everything else stays the same: the deleted-workout filter, `toUserUnit`, the scan cache, and null on any failed page.

For scale, Justin's account after his import has about 1,300 rows, which is 3 pages. Keep the "lower it to 1" testing hint, reworded for rows.

The proper fix is computing PRs on the server, which is a bigger branch for later. Leave a one-line comment saying so.

## 6. Fix: `setup-checklist.test.ts` type error

`tsc` fails at line 319 on main. The `ids` helper's parameter is typed `{ id: string }[]`, but `routinesByStaleness` needs the full day shape. Type it as `Parameters<typeof routinesByStaleness>[0]`. That's a test-only change, and shared `tsc` should then pass clean.

## Order of work

1. Fix 6, then confirm shared `tsc` is clean.
2. Fix 5.
3. Guests on `/import`, then the two entry points, then analytics.
4. Typecheck mobile and shared, run the shared tests, commit and push. One commit per numbered section is fine.

Stop and ask before any decision this spec leaves open.

## Copy

As written above. No em dashes, no colons in app copy.

## Out of scope

A Home card or setup checklist item for importing. Opening a CSV from another app's share sheet (needs a native build). Server-side PRs.
