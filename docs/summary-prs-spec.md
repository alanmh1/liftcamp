# Workout summary v2: PRs, feed-style cards, new share row

Branch `summary-prs`, worktree `~/code/liftcamp-summary-prs`. Mobile only, OTA-eligible (no new native modules). Decided 20 Nov 2026.

Prompted by tester Justin: the summary never mentions PRs. Fitbod ends a workout with "here's what you did today, that's a PR", and he misses it.

Design reference: the "LiftCamp feed options" canvas, boards "Summary v2" and "Summary share cards" (row "Workout summary v2 (20 Nov)"). The mockups use placeholder tiles for exercise thumbnails and the elephant art; the app uses the real ones.

## 1. What counts as a PR on the summary

A shared pure helper in `packages/shared` (next to `pr.ts`), with unit tests:

- **Previous best** for an exercise = the highest estimated 1RM (`oneRepMaxNumeric` on `effectiveLoad`, warm-ups skipped, the same rules as `computePrSetIds`) across that exercise's sets in workouts finished **before** this one. Keep the set that held it (weight and reps) for display.
- An exercise in this workout **has a PR** when its best working set this workout beats the previous best.
- **First-session rule:** no previous best means no PR. A beginner's first workout shows no PR card. The History ribbons keep working as they do today; this rule is for the summary only.
- **One row per exercise.** If two sets beat the old best, the row shows the better one.
- **Order:** biggest jump first, by percentage gain in estimated 1RM over the previous best.
- **Gain chip:** heavier than the previous best set → `+2.5 kg` (in the user's unit, formatted like other weights). Same weight, more reps → `+2 reps`. Anything else (lighter weight, more reps, higher estimate) → no chip.
- Cardio exercises never PR (as today).

Read the history from the existing scan (`getScanRows`), not new queries. The phone-only path (`summaryFromPhone`) must work too: if the scan is unavailable, there are simply no PRs, never an error.

## 2. Celebration on the screen

- **Subtitle pill:** after "Your 331st workout", a solid gold pill with a small filled star and "2 PRs" ("1 PR" singular). Gold background is the `gold` token, text `#3D2C05`-ish dark brown for contrast. No pill with zero PRs.
- **Confetti** fires on **any** summary PR (today it fires only on a compound-lift PR). The other triggers (first three workouts, milestones, weekly target) stay.
- No new haptic. The app keeps expo-haptics on its five existing call sites.

## 3. The carousel

Pages, in order: **PR card** (only with at least one PR), **workout card**, **comparison card** (as today, only above the lightest object), **medal card** (as today, when earned). `summaryPages()` and the dev gallery (`app/dev/week-card.tsx`) update together.

All cards keep today's structure: square 1080 design units, one scale factor, mark plus username at the top, `@liftcamp.app` at the bottom.

### PR card (new)
- Clay trophy at the top-right corner, about 76/350 of the card width, from `apps/mobile/assets/images/pr/pr-trophy.webp` (already in the repo, transparent). Core `Image`, like the comparison art, so the capture never races a decode.
- Label: a small filled gold star in a gold circle, then "2 PERSONAL RECORDS" in the card's gold text color. The label and title leave room for the trophy on the right.
- Workout name (one line, ellipsis), date.
- Up to **3 rows**: exercise thumbnail, name (one line, ellipsis), then the new set in bold gold ("37.5 kg × 10") and "· was 35 kg × 10" muted, with the gain chip on the right (gold-soft background, gold text).
- 4 or more PRs: the top 3 by the order above, then "+2 more PRs" in gold.

### Workout card (replaces the stats card and the exercises card)
Matches the social feed card:
- Workout name, date.
- Time, Volume, Sets in a row (value over a small uppercase label). The cardio fallback for volume stays as it is today.
- A thin divider, then rows: exercise thumbnail, "2 sets" muted, name (ellipsis). An exercise with a summary PR gets a solid gold "★ PR" pill at the end of its row.
- Up to 4 rows, then "+N more exercises" in the accent color.

### Comparison card (the elephant)
Art bigger: 420 → about 560 design units (the mockup went 110 → 150 at 350 px). The volume figure shrinks a little to fit (the mockup went 30 → 26 px at 350), and the opener line goes up one step. Everything else unchanged.

### Thumbnails in the capture
The thumbnails are remote images. The offscreen capture must not produce blank squares:
- Prefetch the thumbnails for the shown rows when the summary loads.
- Before capturing, wait until they've loaded, with a timeout of about 2 s. Any still missing draw as the letter tile that `ExerciseThumb` already uses for custom exercises.
- Reuse `useExerciseMedia` / `ExerciseThumb` lookups so the feed and the cards agree on which image an exercise gets.

## 4. Light and dark backgrounds

- Two card palettes. **Light**: card `#FFFFFF`, text graphite, muted `#6B6560`, thumb tile `#F4F1EC`, divider `#EFEAE3`, gold text `#8A6417`, gold-soft `#F7EFD9`, accent plate blue. **Dark**: card `#1F1D1A`, text `#F4F1EC`, muted `#ADA59C`, thumb tile `#2E2B27`, divider `#36322D`, gold text `#E3B957`, gold-soft `#3A3020`, accent `#8DB8EC`. Check text contrast (4.5:1) on both.
- The **Background** button toggles light/dark for the workout cards (PR, workout, comparison). The choice is remembered per user on the phone (AsyncStorage) and used next time.
- The medal card keeps its own look; Background is hidden while the medal page is showing.
- Instagram Stories gets the matching background color (light or dark) so the story behind the card matches.

## 5. The share row

Replaces the big Share button and the full-width "Share on Instagram" button. One row of round 56 px buttons with a label underneath, under "Posting as":

`Background · Stories · TikTok · Copy text · More`

- **Background**: a circle filled with the current card color and a diagonal-lines icon; the label reads "Light" or "Dark".
- **Stories**: the Instagram glyph in white on the Instagram gradient circle (draw the gradient with react-native-svg; do not add expo-linear-gradient). Shown only when `useShareTargets().instagram` is true (iOS with Instagram installed), as today. Label "Stories".
- **TikTok**: unchanged logic, still behind the `tiktok_share` flag. Shown only when the flag and app allow it.
- **Copy text**: copies the workout as text (section 6) with expo-clipboard and shows a "Workout copied" toast for about 1.5 s.
- **More**: today's Share (the system share sheet with the captured card and the message).

Every image button shares the card on the visible page, as today. "Preparing…" while capturing becomes a spinner in the circle instead of changing the label.

- A guest still gets **Create account**, now as a full-width tinted button under the row, with the "Create a free account…" line under it.
- **Save as routine** / **Update routine**, the note row, the medal line and **Done** stay where they are.
- `ShareActions` is also used by `streak-share-sheet.tsx`. Give it a prop for which buttons to show; the streak sheet shows Stories, TikTok and More (no Background, no Copy text).
- Android: no Stories button (iOS-only today), so the row is Background, Copy text, More.

## 6. Copy text format

Plain text, the user's unit, every exercise (not trimmed), completed sets only:

```
F - Upper Body
Friday, Nov 20 · 1h 06m · 6,794 kg

Incline Dumbbell Bench With Palms In
Set 1: 35 kg × 10
Set 2: 37.5 kg × 10 · PR

Preacher Curl
Set 1: 27.5 kg × 10
Set 2: 30 kg × 9 · PR

Treadmill Run
Set 1: 25:00 · 3.1 mi

Logged with LiftCamp · liftcamp.app
```

- Every set line starts with a label. Working sets are numbered in order within each exercise, from 1: "Set 1: ", "Set 2: ". Cardio sets too.
- Warm-up sets start "Warm-up: " instead and do not count toward the numbers, so the first working set after two warm-ups is "Set 1".
- "· PR" marks the set the PR row shows (section 1), nothing else.
- Bodyweight and assisted sets print the way the History set table prints them.
- Cardio sets print time and distance (and incline when set) the way History does.
- The workout note, if any, goes under the date line.

## Out of scope
- Transparent background (follow-up).
- A public workout link page (later, its own project).
- Replacing `PrRibbon` elsewhere in the app with the new pill (decide after this ships).
- Profile photos (branch `profile-photos`, next).
