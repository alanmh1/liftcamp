# Home, tabs, onboarding: design spec

Companion to `active-workout-spec.md`. Same tokens, type, and rules.

Decisions, 9 Sep 2026: four tabs. Home is a short, fixed list of sections
with no dismissible nudges. First-launch onboarding is a native flow, not
tooltips. Splash and icon use the LiftCamp logo.

---

## Tab bar

Native bottom tabs, system styling, accent for the selected tab.

| Tab | Content |
|---|---|
| Home | This spec |
| History | Finished workouts, newest first; detail on tap (Phase 6 screen 4) |
| Exercises | The full picker as a browsable library with detail sheet (screen 2) |
| Profile | Weekly target, level, equipment, units, theme (Light/Dark/Auto), account (claim, sign out, delete), PR goals |

No floating Start pill. Starting a workout is the first thing on Home, and
the active workout is a full-screen modal over the tabs, so the bar is hidden
while logging.

## Home, top to bottom

Everything below reads from Supabase on focus and caches. No section is
dismissible; if it does not apply, it does not render.

1. **Header.** Large title `Home` collapsing on scroll. Greeting line
   beneath in text2: first name if the account has one, else nothing.
   Right side: nothing (Profile is a tab).

2. **Week strip.** One row: `This week` label, seven weekday dots (accent
   filled for days with a finished workout, border for the rest, today
   ringed), then `2 of 3` in tabular figures against
   `user_profiles.weekly_target`.
   Tapping opens History. Replaces the web StreakCard; the consecutive-weeks
   count moves to Profile.

3. **Resume card.** Only when a workout has `finished_at` null and was
   created in the last 24 hours. Shows name, elapsed since start, exercise
   count. `Resume` opens it. Swipe left to discard (deletes sets,
   workout_exercises, workout, with undo). Also: if the app is relaunched
   while a workout is in progress, open the active workout directly and
   skip Home.

4. **Start workout.** Full-width accent button, `Start empty workout`.
   Opens the active workout with no exercises.

5. **Quick start.** New users only (zero finished workouts). Three chips
   under the button: the same three fixed lifts as web (`QuickStart`), one
   tap creates and seeds the workout. Hidden after the first finished
   workout.

6. **Routines.** Section title `Routines` with `See all` on the right
   (opens the routines list, filters pre-set to the profile). Body:
   - Your routines, as cards: name, exercise count, last done. Tap the card
     to preview, `Start` on the card to begin. Long-press for rename,
     duplicate, delete, share.
   - `Starter routines`, collapsed for existing users, expanded for new
     users, same cards with `Use` and `Save a copy`. Decided 14 Sep 2026:
     the list is matched to `user_profiles.training_level` and
     `equipment_access`, exact on both, and the sub-line names why (`For
     beginners with dumbbells`) with its own `See all` opening the full
     list. When the pair returns nothing the list widens to the same level
     with any equipment and says `Nothing matches exactly`. A user with a
     null `training_level`, which is every user from before the question
     existed, sees the unmatched list exactly as before.
   - `templates.hide_from_onboarding` now applies only on that null-level
     path. Matching supersedes it: a filtered list is short already, and
     the flag hides programs (Bodyweight Only, Dumbbell Only, two of the
     three advanced programs) the matcher needs. The flag can be removed
     once no user has a null level.
   - Below them, one row of four chips: `Push  Pull  Legs  Full`, the
     generator from web `GenerateWorkoutPanel`, unchanged logic.

   **Routines list** (`/routines`, pushed from Home). The Experience and
   Equipment tile rows from onboarding as filters at the top, pre-set from
   the profile, changeable here without writing back (Profile is where the
   settings live), a tile tapped again clears it. Below, the matched
   routines as the routine grid. No filters means every routine, flag or
   not.

   **Routine grid** (decided 14 Sep 2026). A routine is the group of
   templates sharing a `program_slug`; each template is one workout day,
   called a variation in copy. The grid shows routines, never variations,
   as two-column tiles of equal height: the equip-* clay illustration, the
   routine name on a fixed two-line block, the level as a word. No `Use` on
   the tile; tapping opens the routine detail. Onboarding's start choice and
   the routines list render the same component.

   **Routine detail.** A page sheet: routine name, `program_blurb` as the
   description, a metadata row (level illustration and label, equipment
   illustration and label, variation count), then every variation in order
   with its name and its exercises beneath (thumbnail, name, target as
   `3 × 8-10`, the same formatter as the workout card). One primary button
   at the bottom, `Use routine`: saves every variation as the user's own
   routine (what `Save a copy` did, targets included), does not start a
   workout, then dismisses. From the routines list it stays on the list and
   confirms with an alert; from onboarding it completes onboarding and lands
   on Home, where the routine is in the user's list with its own `Start`
   buttons. Variations keep the system template's name (`PPL - Push`) and
   the group's existing name order.

7. **Last workout.** Card: name, date, duration, volume, exercise count.
   Tap for the History detail. `Repeat` on the card creates a new workout
   seeded from it, same as web.

That is the whole screen. Six sections for an existing user, seven for a new
one.

## Dropped from web, and where it went

| Web section | Fate |
|---|---|
| Getting started checklist | Replaced by first-launch onboarding below |
| Frequency nudge, strength goal nudge | Become local notifications (Phase 7). Never on-screen |
| PR goal card | Moves to Profile, and later to the exercise sheet Records tab |
| Install nudge | Web-only |
| Empty-library state | Web-only; the app ships with the library |
| Secondary buttons (New template, Browse exercises, Browse routines) | Tabs and `See all` cover them |
| Guided tour (DOM tooltips) | Replaced by onboarding; native apps do not do coach marks over a live screen |
| Supporting line under greeting (dailySeed copy) | Dropped. One greeting line is enough |
| Landing page | Web-only. The app opens on onboarding or Home |

## First launch

Four screens, swipeable, skippable after the first. Order as built: welcome,
weekly target, level and equipment, pick a start.

1. **Welcome.** Logo, `LiftCamp`, one line: `Start logging now. Add an
   account later and keep everything.` Button: `Get started` (signs in
   anonymously). Small link: `I have an account` (Phase 5b sign-in).
2. **Weekly target.** `How many days a week can you train?` with 2, 3, 4, 5 as large
   tappable numbers, default 3, and the reason beneath: `Three is enough to
   make progress and easy to keep up.` Writes `user_profiles.weekly_target`
   on every exit from onboarding. `Continue`.
3. **Experience and equipment** (added 14 Sep 2026). `What are you working
   with?` then `We'll recommend routines based on your experience and what
   you can train with.` Both questions on one screen in the shape of a
   filter sheet: an Experience row of three tiles (Beginner, Intermediate,
   Advanced) and an Equipment 2x2 grid (Gym, Dumbbells, Bodyweight, Bands).
   Each tile is a clay illustration (`assets/images/onboarding`, 384px
   PNGs with transparency, drawn for light and dark) with the label beneath,
   so the tiles render the same on iOS and Android. Under them a live count,
   `Show N routines`, is the continue button, disabled until both are
   picked, no auto-advance; pressing it writes `user_profiles.training_level`
   and `equipment_access`. Swiping past leaves both null.
4. **Pick a start.** `Choose a starter routine` over the routine grid of
   the routines the answers match, with a `See all` link for everything and
   the one-line `Nothing matches exactly` fallback described under Routines.
   A tile opens the routine detail; `Use routine` saves it and completes
   onboarding onto Home (revised 14 Sep 2026; before, choosing a routine
   started a workout). `Start empty workout` still lands in the active
   workout. A `Skip` link goes to Home.

Notification permission is not asked here. It is asked the first time a rest
timer starts, with one line explaining why, which is when the user has a
reason to say yes (Phase 7).

Completion is stored in AsyncStorage under `liftcamp:onboarded`. Signing out
and back in does not repeat it; a fresh install does.

## Splash and icon

- `expo.icon`: the LiftCamp logo mark on plate blue, 1024×1024, no text.
- `expo.splash`: logo mark centered on paper (`#FDFCFB`), `resizeMode:
  contain`, dark variant on graphite via `expo.splash.dark`.
- iOS also needs the mark as a monochrome tinted-icon variant (iOS 18+)
  and the Android adaptive icon foreground with the same mark on plate blue.

Export the mark from the web logo asset (`replog-logo`) rather than
recreating it. Do this before the first EAS build so the phone install
looks like LiftCamp.

## Out of scope for this spec

History list and detail, the exercise library tab, Profile, routine preview
and editor, the summary screen after Finish. Each is its own spec.

## Words

"Routine" is the user-facing word everywhere, never "program", because
liftcamp.app/routines is indexed and the two should not diverge. The
`templates.program` column and the `ProgramGroup` type keep their names.
