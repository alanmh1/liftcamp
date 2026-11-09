# LiftCamp

Here's the full v1 prompt, updated so the exercise library points at the dataset you're importing rather than asking Lovable to invent one. The main changes are the EXERCISE LIBRARY and SPLIT sections, plus the build order.

PROJECT
Build a personal strength-training workout tracker as a web app, optimized for
mobile (iPhone, added to home screen). The single most important quality is
SPEED of logging. Design philosophy is spartan and utilitarian — like a tool
built by a lifter who wants to log a set and get back to training. Minimal,
fast, no clutter, no social features. "Notes app for lifting," not "Instagram
for lifting."

USERS & DATA
- Multi-user from the start: email/password sign-up and login.
- Each user sees only their own data. Use Supabase with Row Level Security
  enabled on every table that holds user data. Confirm RLS is on before done.

EXERCISE LIBRARY (pre-populated — do NOT generate exercises)
- Create an "exercises" table with EXACTLY these columns so I can import a CSV
  into it myself: name, primary_muscle, ppl_day, all_primary_muscles,
  secondary_muscles, equipment, mechanic, force, level (all text).
- Leave this table EMPTY. I will import ~873 rows directly via the Supabase
  dashboard. Do not insert, generate, summarize, or seed any exercise data
  yourself, and never overwrite this table.
- Column meaning: primary_muscle = main muscle group (use to group alternatives);
  ppl_day = push / pull / legs / core / other; all_primary_muscles &
  secondary_muscles = pipe-separated lists; mechanic = compound/isolation.
- This exercises table is a SHARED reference list (same for all users) and is
  read-only to the app. A user's own added exercises, if any, go in a separate
  user-scoped table — do not mix them into the shared library.

WORKOUTS & FAST LOGGING
- A user has many Workouts. A Workout has a date (defaults today), an optional
  day-type/title, and Exercises in order. A logged Exercise has Sets in order.
  A Set has reps (integer) and weight stored as FREE TEXT, so it holds "40",
  "40 (x2)" for dumbbell pairs, "Body weight", or "Body weight (-100)" for
  assisted machines. Never force weight to be a number.
- Primary action: "Start workout" creates a workout dated today.
- Add exercises by name with autocomplete from the exercises table + my past
  exercises.
- Log sets in a couple of taps: type weight and reps, press enter to add the
  next set.
- When I add an exercise I've done before, pre-fill each new set with the
  weight and reps from the most recent time I did THAT exercise. This pre-fill
  is the single most important feature.

SPLIT & SUGGESTIONS (Push / Pull / Legs)
- Starting a workout I pick a day type: Push, Pull, or Legs.
- For the chosen day, pull candidate exercises from the exercises table where
  ppl_day matches. For each primary_muscle the day covers, suggest:
  (a) the exercise I did for that muscle last time I trained this day, and
  (b) 1-2 alternatives from the same primary_muscle that I have NOT done in my
  last couple of sessions of this day (e.g. last push day incline barbell press
  -> this time a different chest exercise).
- If no history for this day yet, suggest a sensible default per primary_muscle.
- One tap adds a suggestion. I can always ignore them and add anything manually.

QUIET GAMIFICATION (display-only; must NOT add taps or latency to logging)
- PR detection: when a logged set beats my previous best for that exercise
  (max weight, or estimated 1RM via Epley = weight x (1 + reps/30)), mark it
  with a SMALL, subtle indicator on the set — no modal, no confetti. Track max
  weight, max estimated 1RM, and best session volume. Parse the leading number
  from the weight text for PR math; skip entries with no number or bodyweight.
- Consistency: the week streak and the Workouts this week card, specified in
  docs/roadmap.md (Phase 2) and docs/week-card-spec.md.
- Lapse nudge: if I haven't logged in 5+ days, show a gentle, supportive in-app
  prompt on the home screen (never guilt-based). In-app only, no push notifs.

SCREENS
1. Active workout — pick day type, see suggestions, add/log exercises and sets.
2. History — past workouts by date and day type; tap to view/edit.
3. Progress — pick an exercise, line chart of weight over time (plot leading
   number; skip sets with none).

OUT OF SCOPE FOR NOW (keep the data model clean so it can be added later)
- No social feed, followers, likes, comments, or leaderboards in v1. Build none
  of it now, but don't architect in a way that would block a friends +
  reactions layer later.

DESIGN DIRECTION
- Minimalist, high-contrast, large tap targets, fast and responsive. Restraint
  over decoration. Every screen makes the next tap obvious. Gamification
  follows docs/roadmap.md: the week streak card, gold for PRs only, confetti
  on the workout summary only.

BUILD ORDER (get each step working before the next)
1. Auth + the empty "exercises" table with the exact columns above (I'll import
   the CSV before moving on).
2. Active workout with fast set logging + per-exercise pre-fill.
3. Push/Pull/Legs day types + suggestion engine reading from the exercises table.
4. History.
5. Progress chart.
6. Quiet PR detection, then streak + lapse nudge.


The key sequencing note: after step 1, stop and import workout_exercise_library.csv into the exercises table via the Supabase dashboard before you let it build step 3 — the suggestion engine has nothing to suggest from until the data's in there. Once it's imported, a good sanity-check prompt is "confirm the exercises table has 873 rows and read suggestions from it."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://liftcamp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a8f2143a-5a22-42a9-9aad-3d5a76261087).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
