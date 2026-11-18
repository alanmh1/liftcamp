# Profile progress sections and Pro Trends

Branch: `profile-progress`. OTA-eligible: JS only, drawn with `react-native-svg` (already in the binary), no new native modules, no schema change. iOS and Android.

Mockup: Claude Design canvas "LiftCamp routine builder mockups", "Profile data viz" row: P1 (Profile), P2 (Trends, Pro), P3 (Trends card for free users), P4 (custom range sheet). Mockup numbers are placeholders.

## Data

Everything derives from the account-wide scan the Profile already reads (`getScanRows` / `scanCache`, `ScanRow`), so there are no new queries and nothing new to invalidate. All derivation is pure functions in a new `packages/shared/src/progress.ts`, with tests, taking scan-shaped rows, bodyweight, unit and a date range. Only finished workouts and counted (working) sets, same as `profileStatsFromScan`. Memoise per screen on (scan generation, range).

Shared rules used below:
- **Session best e1RM**: per exercise per finished workout, `summarizeSession(...).best.estimatedMax` (the exercise screen's number), so every number agrees with the exercise screen.
- **Weighted exercise**: rep-based (`isRepBased`), not cardio, not `weight_type` 'bodyweight' or 'assisted'.
- **Muscle group** of a set: the exercise's `primary_muscle` canonicalised with `canonMuscle`, mapped to display groups: Chest, Back (lats, upper back, traps, lower back), Shoulders, Biceps, Triceps, Abs, Quads, Hamstrings, Glutes, Calves. Forearms, adductors, abductors and neck are left out of the bars (still lit on the body map).

## Date range

Shared helper `rangeFor(preset | {start, end}, today)` returning inclusive local dates, plus `rangeLabel` ("Aug 25 to Nov 17", "Last 30 days").
- Profile presets: 7D, 30D, 3M, 1Y, All. Default 30D.
- Trends presets: 1M, 3M, 6M, 1Y, All. Default 3M.
- Custom: from the calendar button (P4). All = first finished workout to today.
- State lives in memory for the session (a module-level store keyed by screen), resets on app launch. No AsyncStorage.

Control: a segmented track (surface2 fill, selected segment white with a light shadow) plus a 40 pt round calendar button on the right, accent-soft when idle, accent fill when a custom range is active. A custom range shows its label under the track.

## Profile (P1), `src/app/(tabs)/profile/index.tsx`

New order below the existing header, stats, social counts, medals and History row (unchanged):

1. **Workouts per week** chart, unchanged.
2. **Your progress** heading with the range control and the line "Applies to muscles worked and the PR timeline".
3. **Muscles worked** card.
   - Front and back `BodyDiagram` figures side by side, existing painted layers. Per region, average sets per week across the range (`sets / max(1, weeks in range)`): 10 or more lights as primary, 1 to 9 as secondary, 0 unlit. A set counts once toward its primary muscle's regions (`MUSCLE_REGIONS`).
   - Legend row: "10+ sets a week", "1 to 9", "None", using the primary and secondary tints.
   - Gap tip (shared `TipNote`, gold): only when the range is 7 days or longer and the user has finished workouts on at least 2 different weeks in the last 28 days. Pick the first of hamstrings, glutes, calves, back, chest, shoulders, quads with zero sets in the last 14 days. Copy: "No {muscle} work in 14 days. {Exercise A} and {Exercise B} cover it." with a static map in shared from muscle to two beginner catalog exercises (hamstrings: Dumbbell Romanian Deadlift, Leg Curl; calves: Standing Dumbbell Calf Raise, Seated Calf Raise; and so on; use exercise ids that exist). Exercise names are links to the exercise screen.
   - Accessible label lists the trained and untrained groups in words.
4. **Strength levels**, the existing section, restyled: each row shows the lift name, "{n} {unit} to go" on the right, a 10 pt rounded bar filled to `strengthBarPosition` within the current level, and the current and next level names under the bar's ends. At Elite: full bar, "Top level". The missing-body-details row stays as is. Not range dependent.
5. **Since you started**: up to 4 weighted exercises with the most finished sessions all time and at least 3 sessions. Each row: name, "{first} → {best} {unit}" where first is the top working-set weight of the first session and best is the heaviest top set since, a sparkline of per-session top-set weight (72×28, accent, end dot), and a gain pill "+{best - first}". Heading's right side: "{first workout date} to now". Not range dependent. Hidden with fewer than 1 qualifying exercise.
6. **PR timeline**: replaces Recent PRs. Every PR set in the range, newest first, 5 shown, See All pill pushes a full list (new route `profile/prs`, same rows, the selected range, paginated by render). Row: date eyebrow, exercise name, set ("155 lb × 5"), a vertical connector line between rows. **Milestones** get a gold star marker and " · Milestone": the first set at or above a plate milestone on a barbell lift (lb 135, 225, 315, 405; kg 60, 100, 140, 180), and the first squat or deadlift set at or above bodyweight when bodyweight is known. Milestone label replaces the exercise name: "First 135 lb deadlift".
7. **Trends row**: for Pro, a card row (mini two-line glyph, "Trends", "Estimated max and weekly sets", chevron) pushing `profile/trends`. For free users where `useProUpsell().available`, the P3 card: blurred sample chart, "See where your lifts are heading", "Estimated max over time and weekly sets for every muscle.", button "Unlock with Pro" opening the paywall with a new `PaywallSource` value `trends`. Where Pro is not on sale (Android, flag off), hide the row.

Empty state (no finished workouts): unchanged existing faded preview; the new sections do not render.

## Trends (P2), new route `src/app/(tabs)/profile/trends.tsx`

Pro only (guard with `usePro`; a non-Pro deep link shows the P3 card and nothing else). Header "Trends" with a small black PRO badge.

1. Range control, Trends presets.
2. **Strength gain**: the selected exercises (below), sorted by percent gain. Gain = (running-max e1RM at range end − running-max e1RM at range start) / start, where start is the best e1RM on or before the range start (or the first session in range if none before). Bar width relative to the largest gain; label "+{n}%"; sub-line "{start} → {end} {unit} estimated max". Negative or zero shows "No change" and an empty bar.
3. **Estimated max**: heading with an Edit pill; sub-line "Your four most-logged exercises. Each step up is a new best." (or "Your pinned exercises." when pinned). 2×2 grid of cards: name, current running-max e1RM (24 pt bold) with unit, "+{gain}" in accent on the right, a step chart of the running-max e1RM per session (drawn at the card's real size, no `preserveAspectRatio="none"`: 2.5 pt rounded line, vertical gradient fill fading to 0, faint baseline, one ringed end dot), footer "{n} new bests".
   - **Selection**: up to 4 weighted exercises with the most finished sessions in the range, at least 3 sessions each. Fewer than 4 qualifying: show those plus a line "Log an exercise three times in this range to see its trend."
   - **Edit**: a sheet listing the user's weighted exercises (most-logged first) with up to 4 checkboxes; pinned ids saved in AsyncStorage per user (`trends-pins:{userId}`). Pinned exercises with fewer than 2 sessions in range show "Not enough sessions in this range" in place of the chart.
4. **Weekly sets per muscle**: one row per display group: label, a bar with a light green band from 10 to 20 sets on a 0 to 24 scale, the fill in accent (10 to 20), coral (under 10) or gold (over 20), the number on the right. Value = average sets per week across the range. Sub-heading right side: "Average per week". Legend line: "10 to 20 sets, the usual growth range".

## Custom range sheet (P4), new `components/date-range-sheet.tsx`

Bottom sheet (existing BottomSheet). Left edge layout (it has inputs).
- Header row: Cancel (left, accent), title "Custom range" with the live range under it ("Nov 3 to Nov 17 · 15 days"), Reset (right, text2) clearing the selection.
- Shortcut chips, one row, horizontal scroll: Last 7 days, This month, Last month, All time. A chip applies immediately and closes.
- Month header with round previous and next buttons; next disabled at the current month; previous disabled at the month of the first finished workout.
- Grid from shared `monthGrid`. First tap sets start, second sets end (swap if earlier), third starts over. The range is one continuous accent-soft band per row, rounded where it wraps; start and end are solid accent circles joined to the band; today has a small dot; future days disabled and text3.
- Apply (full width, accent) disabled until both ends are set.
- Range selection logic (tap sequence, swap, clamp to first workout and today, day count) in shared with tests.

## Copy rules

No em dashes, no colons in app copy, spelled-out numbers under ten in prose ("three times") but digits in data ("6 new bests", "+45"). Units follow the user's unit.

## Out of scope

Home changes, web, notifications, bodyweight trend, rep range mix, monthly recap.

## Test steps

1. TERMINAL: shared tests pass (new `progress.test.ts`, range selection tests); `pnpm --filter @liftcamp/mobile exec tsc --noEmit` passes.
2. SIMULATOR (Alan, Pro tester account): Profile shows Your progress with 30D selected, Muscles worked with trained regions tinted, Strength levels with bars, Since you started with 4 lifts, PR timeline with milestones, Trends row.
3. SIMULATOR: switch 7D, 3M, All. Muscles worked and PR timeline change; Since you started and Strength levels do not.
4. SIMULATOR: calendar button, pick a range across two months, Apply. The label shows under the control and the calendar button turns solid. Shortcut "Last month" applies and closes.
5. SIMULATOR: open Trends. Strength gain bars sorted by gain; four step charts; Edit, pin two exercises, Done; the grid shows the pins. Change the range to 1M and check the cards update.
6. SIMULATOR (free account, alanmh@gmail.com with Pro off, or a fresh account): the Trends row is the locked card; Unlock with Pro opens the paywall.
7. SIMULATOR: Justin-sized history (an account with 300 imported workouts) scrolls Profile without a visible stall when switching ranges.
8. SIMULATOR: dark mode for every new section.
9. ANDROID EMULATOR: steps 2 and 5 (Trends row hidden if Pro is not on sale there).
