# Active workout screen: design spec

Source of truth for the first mobile screen. Mock:
https://www.figma.com/design/T8giSu1boCjNSdYzfddgOl (frames B and C).

Decisions made 9 Sep 2026: light theme default, dark and auto as user
settings. Swipe to delete sets. Rest timer is an unboxed row with a
depleting ring. PR is a gold ribbon icon. Type was decided as system font
plus DM Mono and revised to Outfit on 14 Sep 2026; see Type below. Exercise detail (history, records, charts, notes) lives in a
sheet behind the ellipsis, Hevy-style; the card shows only the name and
the set grid.

---

## Tokens

Chalk, remapped for two modes. Plate blue and gold are identical in both.

| Role | Light (default) | Dark |
|---|---|---|
| bg | `#FDFCFB` paper | `#221F1B` graphite |
| surface (cards) | `#FFFFFF` | `#2C2823` |
| surface2 (buttons, input fill) | `#F1EDE7` | `#37322C` |
| input fill, pending/active | `#F6F3EE` | `#221F1B` |
| border | `#DCD6CD` | `#3F3933` |
| text | `#221F1B` | `#FDFCFB` |
| text2 (secondary) | `#6B655D` | `#A8A29A` |
| text3 (labels, disabled) | `#9A948B` | `#7A746C` |
| accent | `#1B5FA8` | `#1B5FA8` |
| accentText (on-surface accent) | `#1B5FA8` | `#7FB0EE` |
| accentSoft (tinted backgrounds) | `#E3EDF9` | `#26406A` |
| gold (PR only) | `#F5D272` | `#F5D272` |
| gold deep (ribbon tails) | `#D9B24C` | `#D9B24C` |
| progressStart (progress bar at nothing done) | `#B9CCEA` | `#4A6283` |

Rules:
- Accent means tappable. Green (`success`) marks a done set. Nothing decorative is blue.
- Gold appears only on PR marks. Never on buttons, never on charts.
- Cards on light get a 2px/8px shadow at 8% graphite. Cards on dark get a
  1px border and no shadow.
- Theme setting: Light, Dark, Auto (follows system). Stored per user.
  Default Light on first launch.

## Type

Outfit throughout, on mobile and web, at 400, 500, 600 and 700. Decided
14 Sep 2026; this supersedes the 9 Sep decision of system font for UI
text and DM Mono for numbers. Outfit's digits are proportional by default
and it ships a tabular set (every digit 590 units in every weight), so
anything that lines numbers up in a column sets tabular figures:
`fontVariant: ['tabular-nums']` in React Native, `font-variant-numeric:
tabular-nums` on the web. That covers the set row weight and reps inputs,
the set number, the previous column, the header timer and the week strip
count. Sizes:

| Use | Size | Weight | Figures |
|---|---|---|---|
| Screen title | 24 | Bold, tracking -2% | |
| Exercise name | 17 | Semibold | |
| Set input numerals | 18 | Medium | tabular |
| Previous-session numerals | 13 | Regular, text3 | tabular |
| Rest timer time, elapsed time, week strip count | 15 | Medium | tabular |
| Meta line, captions | 13 | Regular, text2 | |
| Column labels, chips | 10 | Bold, tracking +6%, uppercase | |
| Buttons | 15 | Semibold | |

Mobile loads the four weights from `@expo-google-fonts/outfit` in the root
layout. React Native resolves `fontWeight` against the system font only, so
`Text` and `TextInput` come from `@/components/text`, which swaps the weight
for the matching Outfit family. Screens never import `Text` from
`react-native`.

## Layout, top to bottom

1. **Header.** Title (workout name), meta line beneath it: elapsed time in
   tabular figures, then `· N exercises · N sets done`. Finish pill top right,
   accent fill, white text. Header collapses to a compact bar on scroll,
   standard large-title behaviour.
2. **Progress bar and rest tray.** See "Progress bar" and "Rest tray"
   below (3 Oct 2026). The inline rest row under the header is gone; the
   rest sheet it opened stays, reached from the tray.
3. **Exercise cards.** One card per exercise. A card with any incomplete
   set is always expanded. Once every set on a card is done it collapses to
   a summary row: exercise name, `N sets`, and the best set as
   `weight × reps` in tabular figures. Tapping the header of a collapsed card
   expands it, and tapping again collapses it. Adding a set or un-completing
   a set re-expands the card and clears the toggle, so it collapses again
   when the last set is finished. Collapse state is UI state only, never
   persisted. The height change animates over 200ms with Reanimated layout
   animations.
4. **Bottom bar.** `+ Add exercise` full-width outline button above the home
   indicator. Nothing else lives here during a workout.

Padding: 20 horizontal at screen edge, 14 inside cards. Corner radius: 20
cards, 14 bars and outline buttons, 10 inputs and strips, 999 pills.

## Progress bar

Decided 3 Oct 2026 from the A2 mock. The header's bottom edge is the
workout's progress: 4 pt tall, full bleed (outside the header's padding),
no label. It sits under the header, which stays put while the list
scrolls. The header never had a bottom hairline, so nothing was removed.

- Only exercises with at least one set count: `total` is those,
  `done` the ones with every set checked, `setFraction` the sum of checked
  over sets across them (`workoutProgress` in packages/shared).
- Two layers on a `border` track. The tint is `setFraction / total`, the
  partial credit for sets checked on unfinished exercises; the solid on top
  is `done / total`. Five exercises, two done, the third at one of three:
  solid 40%, tint 46.7%. Adding an exercise raises `total`, so the bar can
  shrink; an exercise with no sets never holds it short of full.
- The solid deepens with progress: linear RGB from `progressStart` (t = 0)
  to `accent` (t = 1), t = `done / total`. The tint is the solid mixed half
  with `surface`. The mock's ramp ran to `#1E56A0`; here it ends on Chalk's
  accent `#1B5FA8`. Dark starts at `#4A6283`, a slate blue that reads on
  the dark track, and also ends at accent.
- Widths and colors ease out over 250 ms (Reanimated). Left end square,
  each layer's right end rounded.
- `accessibilityRole="progressbar"`, value `min 0`, `max total`, `now done`,
  text "2 of 5 exercises".

## Rest tray

Decided 3 Oct 2026 from the A2 mock. While a rest runs, a tray is pinned to
the bottom of the screen, over the Add exercise bar.

- `surface`, top corners 24, a soft upward shadow (0 −6 20 at 8% text), no
  border. Padding 16 top, 20 sides, bottom `max(insets.bottom − 8, 16)`.
- One row, gap 14: the rest ring at 52 pt (stroke 5, `accentSoft` track,
  `accentText` arc depleting clockwise from 12 o'clock); "Rest" 13/500 in
  text2 over the time 30/700 in text, tabular, `m:ss`; `−15` and `+15`,
  48×44, radius 12, `surface2`, 15/600 text, a real minus sign; Skip, 44
  tall, padding 16, radius 12, a 2 pt `accentText` outline and text.
- Slides up over 220 ms when a set is checked, down when the rest ends.
  Not modal: no backdrop, taps outside reach the list, nothing outside
  dismisses it. While it is up, the list is padded by the part of the tray
  that overhangs the Add exercise bar, so the last set scrolls above it.
- `−15` and `+15` move the end time and never dismiss. `−15` taking it to
  zero ends the rest the way running out does, rest-end haptic included.
  Skip ends it at once with no haptic. Running out fires the rest-end
  haptic, from the same ticker effect as before. Checking another set
  restarts the rest for that set; the tray stays up.
- Remaining time is the stored end time less now, so it is right after
  the app comes back from the background.
- A tap on the ring or the time opens the rest sheet (presets, "Remember
  for <exercise>", its own ±15 and Skip), since the tray has no Edit. The
  sheet's ±15 keep their rule: taking the rest to zero skips it without the
  haptic.
- Out of scope: swiping the tray down to a mini pill, and the background
  rest notification.

## Expanded exercise card

- Head: exercise name and a vertical ellipsis, nothing else. No muscle
  chip, no equipment, no last-session summary; the PREVIOUS column already
  carries last session per set. Everything else about the exercise lives
  one tap away behind the ellipsis. The head is the collapse toggle once
  every set is done, and inert before that.
- Column labels: `SET  PREVIOUS  LBS  REPS` plus an unlabelled done column.
  Widths 32 / 104 / 84 / 60 / 36 at 393pt screen width; scale
  proportionally.
- Set rows, 60px tall.
- `+ Add set` full-width, surface2 fill.

### Set row states

| State | Number circle | Inputs | Done control |
|---|---|---|---|
| pending | surface2 fill, text2 number | input fill, border, text2 numerals | empty square, border |
| active | surface2 fill, text number | input fill, accentText 1.5px outline, text numerals; row tinted 4% text | empty square |
| done | accent fill, white number | surface2 fill, text numerals | accent fill, white check |

Active means the next set to complete. There is exactly one active set per
expanded exercise. When a set is marked done, the next pending set becomes
active and the rest timer starts.

PR: a 22×26 gold ribbon icon (rosette with two tails, `PR` in the medal)
inline after the previous-session value. Shown when this set's estimated
1RM beats the exercise's prior best. Haptic on the moment it appears
(Phase 7 item 2).

### Prefill

Position N takes prior session set N (`getPriorSets` from
`@liftcamp/shared`). Past the end of the prior session, a new set copies the
previous set in this workout. Cold start uses `coldStartSuggestion`.
Prefilled values render in the pending style; they are not logged until
the done control is tapped.

## Interactions

- **Tap an input** opens the numeric keypad with the value selected. A bar
  above the keypad, styled as part of the keyboard, has `−2.5  +2.5` for
  weight, `−1  +1` for reps, and one action key: Next while another input
  follows in the exercise (weight to reps, reps to the next set's weight),
  Done on the last. Both move focus only; neither completes a set. No
  free-text fields anywhere on this screen.
- **Tap the done control** marks the set done, starts rest, fires a light
  haptic. Tap again to un-done.
- **Swipe a set row left** reveals Delete. Deleting shows a 5 second undo
  toast at the bottom. This is the only way to delete a set; there is no
  trash icon on the row.
- **Long-press a set row** enters reorder mode with drag handles (product
  priority 5). Not built yet; exercise reordering is, see below.
- **`+ Add exercise`** opens the picker in multi-select. Tapping a row
  toggles it; a selected row shows a filled accent circle carrying its
  selection-order number. A sticky footer button reads `Add N exercise(s)`
  and is hidden while nothing is selected. Confirming adds every selected
  exercise in selection order, each seeded from the prior session as a
  single add is, then closes the picker. Searching never clears the
  selection. **Replace exercise** from the ellipsis sheet opens the same
  picker in single-select: the first tap confirms.
- **Vertical ellipsis on a card** opens the exercise sheet, borrowing
  Hevy's structure. Top: exercise name, muscle chip, equipment, form notes
  from `beginner_notes` and the animated GIF (in-app only, per the
  ExerciseDB licence). Tabs beneath: About, History (every prior session for
  this exercise), Records (best set, est. 1RM, volume PRs), Charts
  (est. 1RM and volume over time). Actions at the bottom of the sheet, in
  title case: Exercise Info, Reorder, Replace, Add Note, Set Rest Time,
  Remove (destructive, with confirm). Reorder opens the whole-workout
  reorder screen from any card, and is disabled with fewer than two
  exercises.
- **Finish** opens the summary (Phase 6 screen 3). If any set is still
  pending it asks whether to discard those sets or keep logging.
- **Discard** is a trash button in the header, left of Finish. With
  completed sets it confirms, naming how many will be lost; with none it
  discards at once. The caret at the top left is the non-destructive exit
  and leaves the workout in progress.

## Reorder screen

A full-screen modal over the workout, reached from Reorder exercises on any
exercise card's ellipsis menu.
One row per exercise in workout order: the exercise thumbnail, the name,
and a `line.3.horizontal` drag handle at the right, nothing else. Rows are
64 tall with an 8 gap, surface fill, radius 14.

- **Long-press anywhere on a row** picks it up: it scales to 1.03 and gains
  a shadow. Dragging moves it; the other rows slide to show where it will
  land; release drops it there.
- **Auto-scroll.** Within 72pt of the list's top or bottom edge the list
  scrolls under the held row, so a workout longer than one screen can be
  reordered end to end without releasing.
- **Done** closes the screen. Nothing is written while dragging. On Done,
  every exercise whose position changed is written in one request, an
  upsert on `workout_exercises.id`, so a reorder is one statement whatever
  the length of the workout. Dismissing the modal any other way also counts
  as Done.

Built on react-native-reanimated and react-native-gesture-handler only; no
drag-and-drop library.

## Offline

All writes go to the local store first (Phase 2 rules), then sync. The
screen never blocks on network. A small cloud-off glyph in the header meta
line indicates unsynced sets; nothing else changes.

## Out of scope for this screen

Timer sheet design, exercise picker (screen 2), summary (screen 3), the
share card, and the Live Activity. Each gets its own spec when its phase
starts.
