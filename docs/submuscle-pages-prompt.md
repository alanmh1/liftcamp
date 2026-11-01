# Branch exercise-submuscle-pages: real pages for lats, glutes, triceps and the other sub-muscles

Start this after `web-seo-pass` is merged, since it builds on the hub changes and the sitemap rule from that branch. Worktree at `~/code/liftcamp-exercise-submuscle-pages`, branch `exercise-submuscle-pages` off `main`. Copy `apps/web/.env*` in. `apps/web` and `packages/shared` only. Read-only database. Commit by path, push, never merge.

## Why

Today lats, upper back, lower back, traps, biceps, triceps, forearms, quads, hamstrings, glutes, calves, abs, adductors and abductors are `#anchor` sections on the six muscle hubs. "glute exercises", "lat exercises" and "tricep exercises" are each searched more than "chest exercises", and the sections already contain the data. Each becomes its own page with a URL, title, intro, breadcrumb and sitemap entry.

## Routes

14 new pages at `/exercises/<slug>`:

| slug | parent hub | H1 |
| --- | --- | --- |
| lats | back | Lat Exercises |
| upper-back | back | Upper Back Exercises |
| lower-back | back | Lower Back Exercises |
| traps | back | Trap Exercises |
| biceps | arms | Bicep Exercises |
| triceps | arms | Tricep Exercises |
| forearms | arms | Forearm Exercises |
| quads | legs | Quad Exercises |
| hamstrings | legs | Hamstring Exercises |
| glutes | legs | Glute Exercises |
| calves | legs | Calf Exercises |
| adductors | legs | Adductor Exercises |
| abductors | legs | Abductor Exercises |
| abs | core | Ab Exercises |

Lower back appears under both Back and Core on `/exercises`. Its page has Back as the breadcrumb parent; the Core hub keeps linking to it.

Before writing routes, confirm no exercise row has a slug equal to any of the 14 (`select slug from exercises where slug in (...)`). The 14 hub slugs that exist today are handled somewhere as reserved; add these 14 to that list.

Leave the Shoulders sub-section and Neck as they are. Shoulders is already the hub, and neck has 8 exercises.

## Styling: Highland only

The marketing site was redesigned in October 2026 from Adobe Highland mockups. The homepage, `/exercises` (library), the exercise detail pages, `/guides` and `/routines` are on that design: Outfit, the cream background (`#FDFCFB` theme color), the six pastel card tints in `packages/shared` card-tints, the clay art, the shared header with Routines / Exercises / Guides / About and the Download button, and the shared footer. Anything that still uses the pre-Highland look (dark `#16151A` theme color, the old `og-image.png`, `user-scalable=no`, a page with no site header, a footer with a "Log in" link) is the old build and is never a reference.

Before building the 14 pages, check whether the existing 14 hubs (`/exercises/chest` ... `/exercises/smith-machine`) are on the Highland design. Compare their layout, header, footer and theme-color meta against `/exercises` and `/exercises/barbell-bench-press`. If they are still on the old template, port them to the Highland components first on this branch, then build the sub-muscle pages from the same components. Reuse the library page's exercise row or card component for the lists; do not copy markup from the old hub template.

## Page layout

Built from the Highland components used by `/exercises` and the exercise detail page, with these differences:

1. Title and meta description from the table in the Copy section.
2. H1 from the table above, then the two intro paragraphs from the Copy section.
3. A "Start with" row: the two or three exercises named in the Copy section, as cards linking to their pages. These all have beginner blocks, so each card shows the starting-weight sentence.
4. The list, grouped by equipment (Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Bands, Smith machine, Other), explained-in-full exercises first within each group. Full list, no collapse, alt text on every thumbnail.
5. Where the Copy section names a routine, a single card for it after the list.
6. "Other <parent> muscles" links to the sibling sub-muscle pages and the parent hub.
7. JSON-LD: Organization, BreadcrumbList (Exercises › Back › Lats). No ItemList.
8. Canonical, og tags, the same og image as the parent hub for now.

## Parent hubs and exercise pages

- On `/exercises/back`, `/exercises/arms`, `/exercises/legs` and `/exercises/core`, each sub-muscle section heading becomes a link to the new page, with the section's intro line kept. The `#anchor` ids stay so old links still land.
- On `/exercises`, the sub-muscle links under each muscle group point to the new pages instead of `#anchors`.
- On exercise detail pages where the primary muscle is one of the 14, the visible breadcrumb and the BreadcrumbList become Exercises › Back › Lats › Pullups (four items). Primary muscles that are a whole hub (chest, shoulders) keep three.
- "More <muscle> exercises" at the bottom of an exercise page pulls from the sub-muscle, not the parent, when the primary muscle is a sub-muscle, and its "See all" link goes to the sub-muscle page.

## Sitemap and llms.txt

- Add the 14 URLs with `lastmod` = max `updated_at` of the exercises on the page (same rule as the hubs).
- In `/llms.txt`, under each of the Back, Arms, Legs and Core hub lines, list the sub-muscle pages on one line: "Back: [Lats](...), [Upper back](...), [Lower back](...), [Traps](...)".

## Copy

Page copy follows the site voice: short sentences, numbers as digits, no em dashes, no colons in body copy, nothing about pain or injury beyond "see a physio". Use this copy as written; fix only typos.

### lats

Title: Lat Exercises: Pulldowns, Rows and Pull-Ups | LiftCamp
Meta: 39 lat exercises with instructions, equipment and difficulty. Where to start when you can't do a pull-up yet, and the pulldown weight that works on day one.

Your lats are the wide muscles down the sides of your back, the ones that pull your arms down and in toward your body. Every pull-up, chin-up, pulldown and most rows train them.

Most beginners can't do a pull-up yet, and that is the normal starting point. The wide-grip lat pulldown lets you pick any weight, so start there and add pull-up negatives on the bar twice a week.

Start with: Wide-Grip Lat Pulldown, Pullups, Straight-Arm Pulldown

### upper-back

Title: Upper Back Exercises: Rows, Face Pulls and Rear Delt Work | LiftCamp
Meta: 36 upper back exercises with instructions, equipment and difficulty. The rows to start with and the weight to use so your torso stays still.

The upper back is the muscle between your shoulder blades, the rhomboids, middle traps and rear delts. It holds your shoulders back under a bar, and it gets skipped by people who only press.

Rows do most of the work. A seated cable row or a one-arm dumbbell row is the easiest place to start, with a weight you can pull for 10 reps while your torso stays still.

Start with: Seated Cable Rows, One-Arm Dumbbell Row, Face Pull

### lower-back

Title: Lower Back Exercises: Hinges, Extensions and Deadlifts | LiftCamp
Meta: 27 lower back exercises with instructions, equipment and difficulty. Start with back extensions and a light Romanian deadlift, then work up to the deadlift.

The lower back holds your spine straight while your hips do the work. Deadlifts, Romanian deadlifts, good mornings and back extensions all train it, and so does every heavy squat.

Start with bodyweight back extensions, then a Romanian deadlift lighter than you expect. The deadlift comes once the hinge feels natural. A lower back that rounds under load is the one form problem worth stopping a set over.

Start with: Hyperextensions (Back Extensions), Romanian Deadlift, Barbell Deadlift

### traps

Title: Trap Exercises: Shrugs, Upright Rows and Carries | LiftCamp
Meta: 16 trap exercises with instructions, equipment and difficulty. Shrug weights for day one, and why deadlifts and carries already train your traps.

The traps run from your neck out to your shoulders and down your upper back. The upper part is the one you can see. It shrugs your shoulders and holds a heavy bar in your hands.

Shrugs are simple and hard to get wrong. Deadlifts and farmer's walks train the traps without a single shrug, so if you already do those, add shrugs last in the session.

Start with: Dumbbell Shrug, Barbell Shrug, Farmer's Walk

### biceps

Title: Bicep Exercises: Curls for Every Bar and Dumbbell | LiftCamp
Meta: 54 bicep exercises with instructions, equipment and difficulty. The dumbbell and EZ bar weights to start curling with, and the swing to avoid.

Biceps bend your elbow and turn your palm up. Curls are the direct work, and every row, pull-up and pulldown trains them too.

Pick a weight you can curl for 10 controlled reps without your elbows swinging forward or your torso rocking. 10 or 15 lb dumbbells, or the empty EZ bar, is where most people should start.

Start with: Dumbbell Bicep Curl, EZ-Bar Curl, Hammer Curls

### triceps

Title: Tricep Exercises: Pushdowns, Dips and Close-Grip Presses | LiftCamp
Meta: 72 tricep exercises with instructions, equipment and difficulty. The pushdown weight to start at, and when dips are ready for you.

Triceps straighten your elbow and make up most of your upper arm. Every press works them, and pushdowns, dips and the close-grip bench press hit them directly.

Start with a rope pushdown at 20 to 30 lb, a weight you can push for 12 clean reps with your elbows pinned to your sides. Dips come once you can hold a straight-arm position on the bars for a few seconds.

Start with: Triceps Pushdown - Rope Attachment, Close-Grip Barbell Bench Press, Bench Dips

### forearms

Title: Forearm Exercises: Grip, Carries and Wrist Work | LiftCamp
Meta: 25 forearm exercises with instructions, equipment and difficulty. Why grip gives out first on deadlifts and rows, and the two exercises that fix it.

Forearms close your hand and bend your wrist. Grip is usually what gives out first on deadlifts, rows and pull-ups, so forearm work pays off in every other lift.

Farmer's walks and hammer curls train them with no special equipment. Direct wrist curls can wait until grip is the thing holding back a lift.

Start with: Farmer's Walk, Hammer Curls, Alternate Hammer Curl

### quads

Title: Quad Exercises: Squats, Presses and Lunges | LiftCamp
Meta: 154 quad exercises with instructions, equipment and difficulty. The empty-bar squat, the goblet squat for gyms with no rack, and the leg press.

The quads are the front of your thigh. They straighten your knee, so every squat, leg press, lunge and leg extension trains them.

The barbell squat with the empty bar is the standard start. If your gym has no rack or the bar feels like too much, a goblet squat with a 20 or 25 lb dumbbell teaches the same movement.

Start with: Barbell Squat, Goblet Squat, Leg Press

### hamstrings

Title: Hamstring Exercises: Hinges, Curls and Deadlifts | LiftCamp
Meta: 83 hamstring exercises with instructions, equipment and difficulty. The Romanian deadlift weight that is enough on day one, and the seated curl to pair it with.

Hamstrings are the back of your thigh. They bend your knee and, more importantly for lifting, drive your hips forward, which is what every deadlift and hip hinge trains.

Start the Romanian deadlift lighter than your other lifts. 95 lb done properly is enough to leave you sore for two days. A seated hamstring curl at 30 to 40 lb covers the knee-bend side.

Start with: Romanian Deadlift, Seated Hamstring Curl, Stiff-Legged Dumbbell Deadlift

### glutes

Title: Glute Exercises: Hip Thrusts, Bridges and Squats | LiftCamp
Meta: 52 glute exercises with instructions, equipment and difficulty. Start with the empty bar on a hip thrust or glute bridge, plus a three-day glute routine.

Glutes extend your hip. Squats and deadlifts train them hard, and hip thrusts and glute bridges isolate them with the load across your hips instead of on your back.

Start with a barbell glute bridge or hip thrust using the empty 45 lb bar and a pad. Bulgarian split squats with bodyweight for the first two weeks cover one leg at a time.

Start with: Barbell Hip Thrust, Barbell Glute Bridge, Bulgarian Split Squat
Routine card: Glute Focus (/routines/glute-workout-plan)

### calves

Title: Calf Exercises: Standing and Seated Raises | LiftCamp
Meta: 29 calf exercises with instructions, equipment and difficulty. Starting weights for standing and seated raises, and the bounce that wastes most sets.

Calves point your foot down. Standing raises work the big muscle you can see. Seated raises work the one underneath, which is why both show up in most leg days.

Start the standing calf raise at about half your bodyweight on the machine and the seated raise with one 45 lb plate. Pause at the top and the bottom. Bouncing through reps is the mistake almost everyone makes.

Start with: Standing Calf Raises, Seated Calf Raise

### adductors

Title: Adductor Exercises: Inner Thigh | LiftCamp
Meta: 13 adductor exercises with instructions, equipment and difficulty. Inner thigh work from sumo deadlifts and the adductor machine.

Adductors are the inner thigh. They pull your legs together and steady your knees in squats and lunges.

Sumo deadlifts and wide-stance squats train them without a machine. The adductor machine isolates them, and the lightest plate or two is enough to start.

Start with: Sumo Deadlift

### abductors

Title: Abductor Exercises: Outer Hip and Glute Medius | LiftCamp
Meta: 12 abductor exercises with instructions, equipment and difficulty. Outer hip work from single-leg exercises, the abductor machine and banded walks.

Abductors are the outer hip, mostly the glute medius. They move your leg out to the side and keep your knee from caving in on squats and lunges.

Single-leg work trains them with no machine. The abductor machine and banded side steps isolate them, and both start light.

Start with: Bulgarian Split Squat, Bodyweight Walking Lunge

### abs

Title: Ab Exercises: Planks, Crunches and Leg Raises | LiftCamp
Meta: 95 ab exercises with instructions, equipment and difficulty. How long to plank on day one, the cable crunch weight, and when hanging leg raises are ready.

Abs flex your trunk and, during a squat or deadlift, keep it from bending. Heavy compound lifts train them more than most people expect.

Start with a plank for 20 to 30 seconds in three sets, and a cable crunch at 30 to 40 lb. Hanging leg raises come once you can hang from the bar long enough to do them with your knees tucked.

Start with: Plank, Cable Crunch, Hanging Leg Raise

## Checks

- Build passes, vitest passes.
- Every hub and sub-muscle page emits `theme-color` `#FDFCFB`, the shared header and footer, the Outfit font, and no `user-scalable=no`. Nothing on the branch imports from the old hub template.
- Each of the 14 pages returns 200 with the right H1, two BreadcrumbList items above the page name, no `<img>` without `alt`, and exercise counts matching the parent hub's section count.
- `/exercises/back` section headings link to the four new pages and the `#lats` anchor still scrolls.
- `/exercises/pullups` breadcrumb reads Exercises › Back › Lats › Pullups.
- Sitemap has 14 more URLs, all with `lastmod`.
- `/llms.txt` lists them.

## Report

Branch, worktree path, any exercise whose primary muscle did not map to a page, and any count mismatch between `/exercises` and the new pages.
