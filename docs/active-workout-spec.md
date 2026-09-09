# Active workout screen: design spec

Source of truth for the first mobile screen. Mock:
https://www.figma.com/design/T8giSu1boCjNSdYzfddgOl (frames B and C).

Decisions made 9 Sep 2026: light theme default, dark and auto as user
settings. System font for UI text, DM Mono for numbers. Swipe to delete
sets. Rest timer is an unboxed row with a depleting ring. PR is a gold
ribbon icon. Exercise detail (history, records, charts, notes) lives in a
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

Rules:
- Accent means tappable or done. Nothing decorative is blue.
- Gold appears only on PR marks. Never on buttons, never on charts.
- Cards on light get a 2px/8px shadow at 8% graphite. Cards on dark get a
  1px border and no shadow.
- Theme setting: Light, Dark, Auto (follows system). Stored per user.
  Default Light on first launch.

## Type

UI text: system font (SF Pro on iOS, Roboto on Android). Numbers in the
logging UI: DM Mono, always. Sizes:

| Use | Font | Size | Weight |
|---|---|---|---|
| Screen title | System | 24 | Bold, tracking -2% |
| Exercise name | System | 17 | Semibold |
| Set input numerals | DM Mono | 18 | Medium |
| Previous-session numerals | DM Mono | 13 | Regular, text3 |
| Rest timer time | DM Mono | 15 | Medium |
| Meta line, captions | System | 13 | Regular, text2 |
| Column labels, chips | System | 10 | Bold, tracking +6%, uppercase |
| Buttons | System | 15 | Semibold |

## Layout, top to bottom

1. **Header.** Title (workout name), meta line beneath it: elapsed time in
   DM Mono, then `· N exercises · N sets done`. Finish pill top right,
   accent fill, white text. Header collapses to a compact bar on scroll,
   standard large-title behaviour.
2. **Rest row.** A plain row under the header, no background. Left to
   right: `REST` label in accentText, a 22px ring that depletes clockwise
   from 12 o'clock (3px track at 15% text, accentText arc), remaining time
   in DM Mono, flexible space, `+30s` chip (surface2 fill) at the right
   edge. The ring shows fraction remaining, so it starts full and empties.
   Hidden when no rest is running. Tapping the time opens the timer sheet
   (change duration, skip). Runs as a local notification when the screen
   locks (Phase 7 item 1).
3. **Exercise cards.** One card per exercise. The current exercise is
   expanded; others collapse to a single row (name, `N sets`, chevron). Tapping a collapsed card expands it and collapses the previous.
4. **Bottom bar.** `+ Add exercise` full-width outline button above the home
   indicator. Nothing else lives here during a workout.

Padding: 20 horizontal at screen edge, 14 inside cards. Corner radius: 20
cards, 14 bars and outline buttons, 10 inputs and strips, 999 pills.

## Expanded exercise card

- Head: exercise name and a vertical ellipsis, nothing else. No muscle
  chip, no equipment, no last-session summary; the PREVIOUS column already
  carries last session per set. Everything else about the exercise lives
  one tap away behind the ellipsis.
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
  above the keypad has `−2.5  +2.5` for weight, `−1  +1` for reps, and
  Done. Tapping Done on the reps input marks the set done. No free-text
  fields anywhere on this screen.
- **Tap the done control** marks the set done, starts rest, fires a light
  haptic. Tap again to un-done.
- **Swipe a set row left** reveals Delete. Deleting shows a 5 second undo
  toast at the bottom. This is the only way to delete a set; there is no
  trash icon on the row.
- **Long-press a set row** enters reorder mode with drag handles (product
  priority 5).
- **Vertical ellipsis on a card** opens the exercise sheet, borrowing
  Hevy's structure. Top: exercise name, muscle chip, equipment, form notes
  from `beginner_notes` and the animated GIF (in-app only, per the
  ExerciseDB licence). Tabs beneath: About, History (every prior session for
  this exercise), Records (best set, est. 1RM, volume PRs), Charts
  (est. 1RM and volume over time). Actions at the bottom of the sheet:
  Replace exercise, Reorder exercises, Add note, Set rest time, Remove
  exercise (with confirm).
- **Finish** opens the summary (Phase 6 screen 3). If any set is still
  pending it asks whether to discard those sets or keep logging.
- **Cancel** is in the header overflow, not a visible button, and confirms
  before discarding.

## Offline

All writes go to the local store first (Phase 2 rules), then sync. The
screen never blocks on network. A small cloud-off glyph in the header meta
line indicates unsynced sets; nothing else changes.

## Out of scope for this screen

Timer sheet design, exercise picker (screen 2), summary (screen 3), the
share card, and the Live Activity. Each gets its own spec when its phase
starts.
