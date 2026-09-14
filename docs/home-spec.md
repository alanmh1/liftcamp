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
| Profile | Weekly target, units, theme (Light/Dark/Auto), account (claim, sign out, delete), PR goals |

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
   (opens the routines list). Body:
   - Your routines, as cards: name, exercise count, last done. Tap the card
     to preview, `Start` on the card to begin. Long-press for rename,
     duplicate, delete, share.
   - `Starter routines`, collapsed for existing users, expanded for new
     users, same cards with `Use` and `Save a copy`.
   - Below them, one row of four chips: `Push  Pull  Legs  Full`, the
     generator from web `GenerateWorkoutPanel`, unchanged logic.

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

Three screens, swipeable, skippable after the first.

1. **Welcome.** Logo, `LiftCamp`, one line: `Start logging now. Add an
   account later and keep everything.` Button: `Get started` (signs in
   anonymously). Small link: `I have an account` (Phase 5b sign-in).
2. **Pick a start.** `Choose a starter routine` with the same starter cards
   as Home, or `Start empty workout`. Either choice lands in the active
   workout. A `Skip` link goes to Home.
3. **Weekly target.** `How many days a week?` with 2, 3, 4, 5 as large
   tappable numbers, default 3. Writes `user_profiles.weekly_target`.
   `Done` goes to Home.

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
