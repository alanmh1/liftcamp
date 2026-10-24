# Workout tab redesign (rotation queue)

Status: agreed 23 Oct 2026. Depends on branch routine-link (commit a506e79) being merged first.

## Goal

Get someone into the right workout in one or two taps. The staleness data from routine-link drives the layout: the tab shows what to do next instead of a wall of identical cards.

## Tab layout, top to bottom

One scroll view, replacing the current three sections.

1. **Header.** Large title "Workout". The header pill shows only Resume while a workout is in progress. The + Workout pill goes away on this tab; empty start moves into the body (item 4).
2. **Up next hero.** The most stale routine day, drawn like Home's NextUpCard: "UP NEXT" eyebrow, name, muscle summary line, staleness line ("Done 6 days ago"), accent Start button, ⋯ opening the routine menu. Card body opens the routine detail screen (section below). Hidden when the user has no saved routines.
3. **Your routines.** Heading "Your routines" with a right-aligned caption "Sorted by last done". One white card containing the remaining days as compact rows (flat list, no program group headers):
   - Row: name, meta line "N exercises · Done X days ago", small outlined Start pill.
   - A day that belongs to a program keeps the program in its meta line, e.g. "6 exercises · Arnold Split · Done 4 days ago".
   - A day done today renders dimmed with a green check and "Done today".
   - Row body opens the routine detail. Long press opens the routine menu. No trash icon on this screen; Remove lives in the ⋯ menu and detail screen. Remove still removes the whole routine (all its days) with the existing confirm.
4. **Start empty workout.** Full-width row: plus icon, "Start empty workout", sub-line "Add exercises as you go, save it as a routine after". Same start gate as everything else.
5. **Find a routine.** Heading "Find a routine" (replaces the "Routines" heading), "See all N" link with the real count, sub-line from matchHeading as today. Horizontal carousel of reworked tiles:
   - Days-per-week chip overlaid top-left on the image ("4 days"), replacing the bottom meta line and its chevron.
   - Meta line under the name: workout count ("12 workouts").
   - Clay art unchanged. Tighter padding; image inset within the card.
   - No See all end tile; the header link is the only See all.
6. **Exercise library.** Row as today.

### Sort order

All saved days sort by staleness, oldest first. Sort key is lastDoneAt when present, else lastDone; a day never done sorts as oldest of all. Ties (including all-null on a fresh program copy) break by program training order (byVariationOrder), then name. Hero = first item; rows = the rest. This replaces nextRoutineDay's wrap-within-group behavior for this screen.

## Routine detail screen

New pushed route in the train stack (and home stack), not a modal. Split the existing RoutineDetail content out of RoutineDetailSheet; the Modal wrapper stays only for onboarding. Starter programs opened from the browser push the same screen.

- Header: routine name, back, ⋯ opening the existing routine menu (rename, duplicate, share, remove). For a starter routine the ⋯ is absent.
- Meta: muscle summary, exercise count, last-done line with duration and volume when history exists ("Last done Sat, Oct 17 · 52 min · 7,820 lb"), "Not done yet" otherwise.
- Exercise rows: thumbnail, name, set scheme plus last weights ("3 x 10 · 120 lb last time"). Needs a new query: latest completed workout with this template_id, per-exercise top weights. No history: set targets only, no placeholder dashes. Row tap pushes the exercise screen; rows carry chevrons.
- Footer: full-width accent Start (Use routine for starters). Layout reserves a second slot so Edit can land beside it when the editor ships.

## Find a routine browser (See all)

Replaces the current full-screen filter tiles.

- Experience as a segmented control (Beginner / Intermediate / Advanced), seeded from profile prefs.
- Equipment as one horizontal row of icon chips (Gym, Dumbbells, Bodyweight, Bands).
- Match line with counts ("For intermediates with a full gym · 8 routines, 28 workouts").
- Two-column grid of the reworked tiles (chip on image, workout count).
- Tile opens the routine detail screen with Use routine.
- **Request a routine row** after the grid: "Don't see the routine you want?" / "Request it and we'll build it". Opens mailto to hello@liftcamp.app, subject "Routine request", body prefilled with the selected level and equipment plus "I'm looking for: ". Use Linking.openURL; when canOpenURL('mailto:') is false, show an alert with the address and a Copy button.

## Post-workout summary CTA

On the summary of any workout without a template_id, add "Save as routine" (opens the existing SaveRoutineSheet). This is the create flow; there is no from-scratch builder yet.

## Empty states

- No saved routines: hero and Your routines absent; Find a routine leads the screen (current behavior preserved).
- Zero matches in the browser: match line says so; the request-a-routine row remains visible.

## Copy rules

"routine" never "program" in app copy; no colons or em dashes; middle dots as separators; AP-style numbers.

## Out of scope (parked)

Routine editor (Edit slot reserved), collapse-by-program for 10+ routines, "try day 1 without saving", dashboards of any kind on this tab.
