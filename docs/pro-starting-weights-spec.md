# Pro: starting weights, warm-up sets, plate calculator

Branch `pro-starting-weights`, worktree `~/code/liftcamp-pro-starting-weights`. Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL. Everything here is JS, so it ships OTA.

Three things a beginner would otherwise ask a coach, all behind the existing Pro gate (`useProgressionGate` in `lib/pro.ts`, `canShowProgression` in shared). Testers with a grant see them now; everyone else sees them when the paywall ships. Nothing free changes: the Previous column, placeholders, the cold-start reps and the beginner-note "Starting weight" text in the info sheet stay exactly as they are.

Read before starting: `packages/shared/src/progression.ts` (the engine, `loadRuleFor`, `classifySets`, `suggestProgression`, `progressionChip`, `progressionSheet`), `strength-standards.ts`, `suggestions.ts`, `keypad-step.ts`, `dumbbell-load.ts`, `set-placeholder.ts`, and on mobile `components/workout/exercise-card.tsx`, `progression-chip.tsx`, `progression-sheet.tsx`, `keypad-accessory.tsx`, `data/placeholders.ts`, `app/settings.tsx` (the Training group).

The standing rules from the roadmap apply: generated starting weights never ship free, not even as a preview; nothing already free moves behind the wall; every number a Pro surface shows must be reproducible from a pure function in shared with a test.

## 1. Starting weights

Today a first session on an exercise is `outcome: "first-session"` and the engine returns nothing. The chip is hidden and the placeholder falls back to the cold-start reps with an empty weight box. This fills that gap for Pro.

### What it suggests

A conservative working weight for the first session, built from one of three sources, tried in order. The source is part of the result so the chip can say where the number came from.

1. **Strength standards** (`strength-standards.ts`), for the 9 exercises that have them, when the user has sex and bodyweight set. The target is a weight a Beginner can do for the routine's reps: the Novice threshold for their sex, bodyweight and age (`strengthThresholds`), scaled from a 1RM to a working weight with the Epley inverse for the rep target (`one-rep-max.ts` has the model; add `weightForReps(oneRm, reps)` next to it), then taken at 60% so a true beginner lands under it, then rounded with `loadRuleFor`'s step or ladder. Floor is the empty bar (section 3's bar weight) for barbell, the ladder's first value for dumbbells and kettlebells.
2. **A related lift the user has logged.** For an exercise with no standards, look for history on a sibling: same `primary_muscle`, same `mechanic`, same equipment family (barbell with smith and EZ bar; dumbbell alone; cable with machine). Use the sibling's last working weight at 70%, rounded. Keeps a beginner from starting a close-grip bench at the empty bar after benching 95 last week.
3. **The empty bar or the lightest load**, by equipment: bar weight for barbell and smith, the ladder's first value for dumbbells and kettlebells, the lightest plate on the stack (step from `loadRuleFor`, so 10 lb for machines and 5 lb for cables) for machines and cables. Body only stays reps only and goes through the existing `sets` rule. Bands, balls and "other" get nothing.

Rep target: the routine's `target.reps` (low end of a range) when there is one, else the cold-start reps (`coldStartSuggestion`). Set count: the routine's or the cold-start count.

Age for the standards comes from the birthday in Settings when set, else null (the standards function already handles null).

### Where it shows

- **Set rows.** The engine returns `outcome: "first-session"` with `sets` filled and a new `why: "starting-weight"`, so `placeholderSuggestions` fills the gray weight and reps with no new plumbing. The `detail` carries `source: "standards" | "sibling" | "floor"` and, for a sibling, its exercise name.
- **The chip** under the exercise name reads "Start at 65 × 8" with the reason line from the source: "From your strength level", "From your bench press", "Empty bar, add weight when 10 feel easy". `progressionChip` gets the case.
- **The sheet** (`progressionSheet`) gets a first-session layout: the suggested sets, the source line in full, and one sentence of instruction: "Treat this as a guess. If every rep felt easy, go up a step on the next set and we'll start from there next time." No Last column, there is nothing to show.
- **The first-session banner** (`first-session-banner.tsx`, free) stays as it is.

### Gate

Free users keep today's behaviour: empty weight box, the two-line "Not sure what to lift?" hint from the first-workout spec, the beginner note. The suggestion is computed only when `useProgressionGate()` is true, same as every other progression surface.

### Shared

- `startingWeight(ex, input): StartingWeight | null` in a new `starting-weight.ts`, where input is `{ unit, sex, bodyweightKg, age, reps, siblings: HistorySession[] with exercise, barWeight }`. Pure. Returns `{ weight, reps, sets, source, siblingName? }`.
- `weightForReps(oneRm, reps)` in `one-rep-max.ts`, the inverse of the estimate the app already uses, with a test that round-trips.
- `suggestProgression` calls it on the first-session path when the input carries the new optional `startingWeight` fields; without them it behaves as today, so every existing test still passes.
- Tests: each source, the floor per equipment, rounding onto the dumbbell ladder, the 60% and 70% factors, a user with no body details falling through to the sibling and then the floor, and `unsupported` equipment returning null.

### Mobile

- `data/placeholders.ts` (or wherever the screen builds `ProgressionInput`) adds sex, bodyweight, birthday and the bar weight to the input. Bodyweight and sex already load for the strength level section; reuse that read.
- Sibling history: one query per first-session exercise in the workout, against the same scan cache the progress chart uses (`scan-cache.ts`), filtered by muscle, mechanic and equipment family. Cheap, and only for exercises with no history of their own.

## 2. Warm-up sets

The engine already understands warm-ups in history (`classifySets` marks them by `set_type` or by load under 90% of the top set) and repeats them as they were. What it doesn't do is generate them. This adds generation, Pro only.

### Rule

For a working weight W on a `linear` or `ladder` rule exercise with a compound mechanic, warm-ups are:

| W as a share of the bar (barbell) or absolute | Warm-up sets |
| --- | --- |
| W at or under the empty bar, or dumbbells under 20 lb / 10 kg | none |
| W up to 2× bar (barbell) or any dumbbell/machine compound | 1 set: 50% × 8 |
| W over 2× bar | 2 sets: 50% × 6, 75% × 3 |
| W over 3× bar | 3 sets: bar × 8, 55% × 5, 80% × 2 |

Percentages round to the exercise's step or ladder, never above W, never below the floor. Isolation exercises get none: a beginner curling 20 lb doesn't need a 10 lb warm-up. Bodyweight and reps-only rules get none. Cardio gets none.

A user who already logs their own warm-ups (any set typed `warmup` in the last session) keeps theirs: the engine repeats them as today and generates nothing. So the rule only fires for people who don't warm up at all, which is most beginners.

### Where it shows

- The suggestion's `sets` gain rows with `role: "warmup"` ahead of the working sets. `placeholderSuggestions` already passes `warmup: true` through, the sheet already prints "W" rows, and the set row already draws a warm-up marker for a typed warm-up set. Check the seeded row count: the card should seed working sets plus generated warm-ups, and a warm-up row's check logs it with `set_type: "warmup"` so history reads back right.
- The chip is unchanged: it names the working set. The sheet shows the warm-up rows above with a one-line note the first time: "Warm-up sets get you to the working weight safely. They don't count toward progress."
- **Setting.** Settings, Training group: "Warm-up sets" switch, default on, Pro only (hidden for free). Off means no generated warm-ups. Stored in `user_profiles` as `warmups_enabled boolean default true`; one line of SQL, which Alan runs (`ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS warmups_enabled boolean NOT NULL DEFAULT true;`). Add it to `database.types.ts` by hand.

### Shared

- `warmupSets(working: { weight, reps }, rule: LoadRule, ex, unit, barWeight): SuggestedSet[]` in `warmups.ts`, pure, with tests for each tier, the rounding, isolation and bodyweight returning nothing, and dumbbells under the threshold returning nothing.
- `suggestProgression` prepends them when `input.warmups !== false` and the last session has no typed warm-ups.

## 3. Plate calculator

A sheet that shows which plates go on each side of the bar for a weight, plus the bar weight and available plates as settings. Pro only.

### Where

- **Keypad tray.** The `keypad-accessory.tsx` tray gets a plates pill, after ±%, visible only for a weight box on a barbell, EZ bar or smith machine exercise and only for Pro. Tapping opens the plate sheet for the box's current value (or its placeholder when empty).
- **Set row.** Long-press on a logged weight of a barbell exercise opens the same sheet for that weight. Discoverable later; the tray pill is the main way in.
- **Exercise screen, Records.** The estimated max row gets a small plates glyph that opens the sheet for that value. Cheap and a nice touch for "what would that look like on the bar".

### Sheet

Title is the weight ("135 lb"). A bar drawn in the clay style is a stretch; v1 is a row of plate chips per side, largest first, labelled with the plate weight and coloured by the standard competition scheme (45 blue, 35 yellow, 25 green, 10 white, 5 red... use the Chalk palette's nearest tones, not the IPF colours exactly). Under it: "Per side: 45, 25, 10" in text for VoiceOver and for anyone who prefers reading. A "Can't make it" line when the weight isn't reachable with the plates set ("Closest is 132.5"), with that weight tappable to put it in the box.

Unit follows the user's unit setting. Plates are stored in that unit.

### Settings

Settings, Training group, "Plates" row opening a sheet with:

- Bar weight: chips 45 lb, 35 lb, 15 lb (or 20 kg, 15 kg, 10 kg), default 45 / 20. Also used by section 1's floor and section 2's bar-share tiers, so it lives in shared as `barWeight(unit, prefs)`.
- Available plates: a multi-select of 55, 45, 35, 25, 10, 5, 2.5, 1.25 (kg: 25, 20, 15, 10, 5, 2.5, 1.25, 0.5), default all except 55 and 1.25. The calculator uses only the checked plates, assuming a pair of each.

Stored in `user_profiles` as `bar_weight numeric` and `plates numeric[]` (null means the defaults). Two more columns in the same ALTER as the warm-up switch. Free users don't see the row; the calculator is Pro.

### Shared

- `platesForWeight(target, bar, plates): { perSide: number[]; exact: boolean; closest: number }` in `plates.ts`, greedy largest-first, with tests: 135 lb on a 45 bar is one 45 per side; 137.5 with no 1.25 plates gives closest 135 and exact false; a target under the bar gives an empty side and closest = bar; kg defaults.
- `barWeight(unit, prefs)` and the default plate sets.

## Order of work

1. Shared: `one-rep-max` inverse, `starting-weight.ts`, `warmups.ts`, `plates.ts`, the `suggestProgression` changes. All tests green before any mobile work. Run `pnpm --filter @liftcamp/shared test`.
2. Mobile, starting weights: input plumbing, chip and sheet cases. Check with a Pro tester account on an exercise with no history.
3. Mobile, warm-ups: seeded rows, the warm-up marker on generated rows, the setting.
4. Mobile, plate calculator: the sheet, the keypad pill, the settings sheet.
5. SQL for Alan (`docs/pro-starting-weights.sql`): the three `user_profiles` columns.

Each stage is its own commit with a message that says what the user sees.

## Copy

No colons in app copy, no em dashes, "routine" not "program". Spell out small numbers in prose ("two sets"), digits for weights and reps ("65 × 8"). The chip and sheet lines in section 1 are final copy; anything else new goes in the PR description for Alan to read before merge.

## Out of scope

Female and male demo media, a week 1 preview on onboarding (that's the Phase 4 onboarding change in the roadmap and comes after this), a clay bar illustration in the plate sheet, per-exercise warm-up overrides, RevenueCat and the paywall.
