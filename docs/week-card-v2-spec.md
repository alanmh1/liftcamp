# Week card v2: ember streaks, clay flames, medal row

Decided 17 to 19 Oct 2026. Design canvas: https://claude.ai/artifact/QRxEEKmNpn41YBNb7sSQVQ (board "Final · Week card and streak", light and dark). The canvas is the visual reference; this doc is the rule set. Where the two disagree, this doc wins.

Supersedes these parts of `docs/week-card-spec.md`: the weight plates (count and chip), the accent border on a hit week, the chip opening the share preview, and the chip hidden at a zero streak. Everything else there stands: the phases, `weekCardLine` and its copy pools, the streak walk, rest weeks, medals, the celebration timing (`shouldCelebrate`), the reset-line-once rule, and the five haptic call sites.

Ships over the air. No new native modules (no expo-linear-gradient): every fill is solid.

## Why

The card read as blue, grey and white, the plate icons did not read as weight plates, and the clay medals only showed on the week one was earned. v2 gives the streak its own color, uses clay flames for the streak's three states, and puts the next medal on the card every week as the goal.

## Assets

From `docs/handoff/week-card-v2/` in the main checkout (untracked there; copy them in):

| File | Goes to | Use |
|---|---|---|
| `flame-ember.webp` | `apps/mobile/assets/images/streak/` | Streak active |
| `flame-ice.webp` | `apps/mobile/assets/images/streak/` | Rest week (banked token, protected state) |
| `flame-out.webp` | `apps/mobile/assets/images/streak/` | No streak |
| `flame-*.png` (600 px masters) | `apps/mobile/assets-src/images/streak/` | Not bundled, like the medal masters |

The WebPs are 360 px squares with alpha, all three on one shared frame so they swap without the shape moving. The flame fills about 93% of the height and 65% of the width, centered. Same convention as the medals.

New component `components/streak/flame.tsx`: `<Flame variant="ember" | "ice" | "out" size={n} />`, expo-image with static requires and `cachePolicy="memory-disk"`, decorative (`accessible={false}`), like `Medal`.

## Color

New palette keys in `theme/tokens.ts`. Values tuned to the real Chalk surfaces (light bg `#FDFCFB`, dark surface `#2C2823`), so they differ slightly from the canvas, which used stand-in darks.

| Key | Light | Dark | Use |
|---|---|---|---|
| `streak` | `#F2602B` | `#FF6A33` | Ember: hit border, at-risk ring, filled ticks |
| `streakText` | `#B33C0C` | `#FF9466` | Chip text, medal-row urgency line |
| `streakBig` | `#D9480F` | `#FF7A45` | The count on a hit week, the sheet's big number |
| `streakSoft` | `#FFE7D9` | `#3B2218` | Chip fill, celebration glow |
| `streakRiskBg` | `#FFF6EF` | `#33241B` | Card fill while at risk |
| `streakHitBg` | `#FFF1E6` | `#36231A` | Medal-week card fill, active sheet fill |
| `ice` | `#4FAEE8` | `#4FAEE8` | Cold end of the heat scale, today ring on a rest-week Monday |
| `iceText` | `#1B5FA8` | `#8ECBF5` | Rest-week token text, protected-sheet number |
| `iceSoft` | `#E4F2FC` | `#1E3346` | Rest-week token and chip fill |
| `iceBg` | `#F3F9FE` | `#24303A` | Card fill on a rest-week Monday, protected sheet fill |
| `iceBorder` | `#BFDDF5` | `#2F4D66` | Card border on a rest-week Monday |
| `noStreakSoft` | `#F1EDE6` | `#37322C` | Grey chip fill |

Update the rules comment at the top of `tokens.ts`:

- Ember means the streak. It appears nowhere else.
- Ice means a rest week, and is the cold end of the week's heat scale. It is a light sky blue, never `accent`, and never on a tappable control. This is the one decorative blue, and it stays inside the streak.
- Accent still means tappable. Gold still means PRs only. Green still means a done set. The medals' metal is the art's own and is not UI gold.

### Heat scale

The week warms up as it fills. Stops, as a fraction of the target:

| t | 0 | 0.30 | 0.60 | 1.0 |
|---|---|---|---|---|
| color | `#4FAEE8` | `#8DD3E0` | `#FFD166` | `#F2602B` |

`heatColor(t)` in `packages/shared` (new file `heat.ts`, pure): clamp t to 0 to 1, linear sRGB interpolation between the neighbouring stops, returns `#RRGGBB`. Same in both modes. `heatInk(hex)` returns `#221F1B` when the color's relative luminance is above 0.45, else `#FFFFFF`, for the check glyph on it. Unit tests for both: the four stops exactly, 1/3 and 2/3 (about `#9AD3D3` and `#FDBE5C`), clamping, and the ink switch.

- Segment i of the target (1-based) is filled with `heatColor(i / target)` once i workouts are done.
- The k-th training day this week (in date order) fills its day circle with `heatColor(min(k, target) / target)`, with a `heatInk` check. Days past the target use ember.

## The Home card

`components/home/week-card.tsx`, same props, `WeekCard` and `WeekCardView` split kept. Plates go (`plate.tsx` stays: the confetti uses it).

Top to bottom:

1. **Header row.** Left: "This week" (13 semibold, text2) over the count, `{done}` at 40 bold tabular then `of {target} workouts` at 17 medium text2. Right column, aligned end: the streak chip, and under it the rest-week token when `streak.restBanked`.
2. **Segments.** One per target workout, 12 pt tall, gap 6, radius 6. Filled per the heat scale. The next unfilled segment is the "now" segment: transparent with a 2 pt dashed `text3` border (ember while at risk). Over target, the segments stay at the target count and the count reads "4 of 3".
3. **Day row.** Seven columns: the letter (11 semibold) over a 30 pt circle. Trained days filled per the heat scale with a check. Today unfilled: dashed 2 pt `text3` ring (ember while at risk, `ice` on a rest-week Monday). Other days: `surface2` fill.
4. **The line.** `weekCardLine` as now, its own row, every state.
5. **Medal row.** Hairline divider, then the next medal as the goal. See below.

### Streak chip

32 pt pill, 26 pt clay flame then the count ("5 weeks", "1 week"), 14 bold tabular. Always shown, including at 0.

| Variant | When | Look |
|---|---|---|
| ember | streak ≥ 1 | `streakSoft` fill, `streakText` text, ember flame |
| hot | `atRisk` | `surface` fill with a 2 pt inset `streak` ring, ember flame. Not a solid ember fill: the flame would vanish into it |
| ice | `restUsedLastWeek && done === 0` | `iceSoft` fill, `iceText` text, ice flame |
| out | streak 0 | `noStreakSoft` fill, text3, grey flame, "0 weeks" |

The chip opens the streak sheet (below). It no longer opens the share preview directly; the sheet has Share. It stays its own pressable inside the card's, so it does not open History.

Rest-week token: 24 pt pill, 20 pt ice flame, "1 rest week", `iceSoft` fill, `iceText`.

### Medal row

New pure helper in `packages/shared/src/medals.ts`, with tests:

```ts
medalProgress(state: WeekCardState): {
  prev: number | null;   // highest rung <= streak.current, null below 2
  next: number;          // nextMedalRung(streak.current)
  toGo: number;          // next - streak.current; this week counts when not yet hit
  ticks: { on: number; now: boolean; total: number };
  bar: number | null;    // 0 to 1, used instead of ticks when total > 8
  line: string;
  urgent: boolean;       // toGo === 1 and the week is not hit yet
}
```

- `total = next - (prev ?? 0)`, `on = streak.current - (prev ?? 0)`, `now` is true when the week is not hit (this week is the next tick). Past 8 ticks (26 to 52 and up) draw one continuous bar instead, `bar = on / total`.
- `line`, first match wins, numbers through `proseNumber` (words to nine, digits from 10):
  - toGo 1, remaining 1, not hit: "One workout from your {next}-week medal"
  - toGo 1, not hit: "Hit this week for your {next}-week medal"
  - otherwise: "{toGo in words, capitalized} weeks to your {next}-week medal" ("week" when toGo is 1), e.g. "Three weeks to your 8-week medal", "One week to your 2-week medal"
- With no rung yet (`prev` null, streak 0): the row reads "Your first medal" (15 bold) over "Hit your target two weeks running and the 2-week medal is yours." (13, text3), ticks below, and the 2-week medal locked at 72 pt on the right.

Layout with a `prev`: earned `prev` medal at 44 pt, then the ticks (8 pt tall, gap 4; on = `streak`, now = dashed, rest = `surface2`) with the line under them (13 semibold text3), then the `next` medal locked at 60 pt.

`urgent`: the line turns `streakText` bold, the now tick's dash turns ember, and the next medal draws at 76 pt from its earned art at 0.65 opacity, over a soft `streakSoft` radial glow (a blurred circle view; no gradient module).

On a medal week the medal row is replaced by the medal hero (below).

### States

| State | When | Card |
|---|---|---|
| Normal | default | `cardSurface` as now |
| At risk | `atRisk` | `streakRiskBg` fill, 1.5 pt `streak` border, hot chip, ember now-segment and today ring |
| Hit | `phase` hit or over, not a medal week | 1.5 pt `streak` border (was accent), count in `streakBig` |
| Medal week | `weekMedal(state) != null`, all week | The medal hero |
| Rest week used | `restUsedLastWeek && done === 0` | `iceBg` fill, 1.5 pt `iceBorder` border, ice chip, `ice` today ring |
| No streak | `streak.current === 0` | Normal card, out chip, first-medal row |

One border width (1.5) in every state so nothing shifts, as now.

**Medal hero.** `streakHitBg` fill, `streak` border. Centered: the chip, the medal at 132 pt, "{n}-week medal" (22 bold), `weekCardLine` (15, centered, max two lines). Then a footer strip on `surface`: "This week {done} of {target}" (14 semibold text2), three mini segments (28 x 8), and a Share text button (accent) that opens the existing share preview. Share shows all week, not only after the celebration.

### Celebration

Same trigger and timing as now (`shouldCelebrate`). What moves: the filled segments pulse in turn where the plates did, the count pops, the chip lands or pops, the border animates to `streak`, the glow uses `streakSoft`. On a medal week the medal lands in the hero (scale in from 0, past 1.2, settle), as it landed in the plates' slot. Reduce Motion shows the end state. Haptics unchanged.

New segments filled since the card last drew this week pop in the way plates did (`drawnDone`).

### Skeleton

`WeekCardSkeleton` takes the new shape: header text plus a 32 pt pill, the segment row, the day row with 30 pt circles, one meta line, the medal row (44 and 60 pt circles). Same heights as the real card's normal state.

## The streak sheet

New `components/home/streak-sheet.tsx` on the app's `BottomSheet`. Opened from the chip (and the card's VoiceOver action "Open streak"). Background is the sheet's own fill per variant; content on `surface` panels with radius 18.

Top row: Share (icon button, opens the existing share preview; hidden at streak 0), then right-aligned the rest-week token ("1 rest week", or "0 rest weeks" with the ice flame greyed at 0.45 opacity) and Close.

Hero row: the number (72, weight 700; Outfit's bold is the heaviest face loaded) over "week streak" (20 bold), and the clay flame at 112 pt on the right.

| Variant | When | Fill | Number and label | Flame |
|---|---|---|---|---|
| Active | streak ≥ 1 | `streakHitBg` | `streakBig`, `streakText` "week streak" | ember |
| Protected | `restUsedLastWeek && done === 0` | `iceBg` | `iceText`, "week streak, safe" | ice |
| No streak | streak 0 | `surface2` | text3 "0", text2 "week streak" | out |

Panels, by variant:

- **This week** (active, protected): "This week" and "{done} of {target}", the day row as on the card, then a footer line under a hairline: the medal row's `line` in active, and "Your rest week covered last week, so the streak held. Hit four more weeks in a row to bank another." in protected (reword the last sentence to match how many hits remain to the next bank once that number is on `StreakResult`; until then use this line as written).
- **Medals** (active): "Medals" and a "See all" link to `/medals`. The two highest earned rungs at 56 pt with "Earned" (or ×N), the next rung locked at 72 pt with "{toGo} to go" in `streakText` bold, then the next two rungs locked at 48 pt and 0.3 opacity. Build the cabinet with `medalCabinet(medalEarnsFromDates(dates, target), streak.current)`: no new reads.
- **Ended** (no streak with `resetLastWeekFrom > 0`): "Your {proseNumber(n)}-week streak ended last week. Three workouts this week starts a new one, and your medals stay yours." with "Three" as `cap(proseNumber(target))`, then the earned medals at 56 pt. With no reset (never had a streak), show the first-medal text from the card's medal row instead.

Bottom: a full-width 52 pt accent button. "Start a workout" closes the sheet and starts Next up when there is one, else an empty workout, through Home's `run` and start gate. With a workout in progress it reads "Resume workout" and opens it.

## Home order

Default order is unchanged: Resume, What's new, Next up (or Start, checklist and routines), save row, week card, last workout, feed.

The week card moves above Next up (directly under Resume and What's new) in two cases:

1. The launch the celebration plays (the medal hero included).
2. `atRisk` is true.

The order is decided before the week card first draws on a focus and never changes while Home is on screen. Hold the week card's Reveal until the celebration check for this focus has resolved (`celebrationCheck`), so a card never jumps. The What's new card already waits on the same check.

## Accessibility

- Card label: "{done} of {target} workouts this week. {line}. {chip label}. {medal row line}. Open history." On a medal week, "{n}-week medal earned." in place of the medal row line.
- Chip label: "{n}-week streak, rest week banked. Open streak." (or "No streak yet. Open streak.").
- Card action "Open streak" for VoiceOver, since the card reads as one element.
- Sheet: buttons are real buttons with labels (Share streak, Close, See all medals, Start a workout).
- Text contrast: `streakText` and `iceText` on their soft fills pass 4.5:1 in both modes; check the dark `iceText` on `iceBg` and adjust the token if not.

## Dev gallery

`app/dev/week-card.tsx` shows every card state above (normal midweek, at risk, at risk with a medal one workout away, hit, medal week, rest week used, no streak, a streak past 26 with the bar instead of ticks, over target) and the three sheet variants, in the current theme, with a light/dark toggle if the gallery has one.

## Out of scope

- The streak chip in Home's header. Considered; parked.
- A campfire illustration for long streaks.
- Snapshotting weeks so a target change stops rewriting history.
