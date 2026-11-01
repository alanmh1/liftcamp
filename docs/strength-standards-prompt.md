# Branch strength-standards: strength standards pages and calculator on liftcamp.app

Worktree at `~/code/liftcamp-strength-standards`, branch `strength-standards` off `main`. Copy `apps/web/.env*` in. `apps/web` and `packages/shared` only. No database changes. Commit by path, push, never merge. This file sits in the main checkout at `~/code/liftcamp/docs/strength-standards-prompt.md`; copy it into the worktree and commit it on the branch.

## Why

"How much should I bench", "squat standards" and "deadlift standards" are some of the most searched beginner lifting questions, and LiftCamp already has the data in `packages/shared/src/strength-standards.ts` (7 lifts, men and women, scaled by bodyweight and age). The app and the MCP `strength_level` tool use it. This branch gives it 8 public pages: a hub at `/strength-standards` and one page per lift, each with server-rendered tables, a calculator, and an App Store CTA.

## Routes

TanStack Start file routes, same pattern as `routines.tsx` and `routines_.$slug.tsx`:

- `src/routes/strength-standards.tsx` for `/strength-standards`
- `src/routes/strength-standards_.$lift.tsx` for `/strength-standards/<slug>`, `notFound()` for any slug not in the table below

| slug | exercise id | exercise page slug | name | H1 |
| --- | --- | --- | --- | --- |
| bench-press | d5f93fa3-b43b-4306-8081-ee5bff0d4ca6 | barbell-bench-press | Bench press | Bench Press Standards |
| squat | 85495e85-bd72-445d-a6c8-5961f17ec2e5 | barbell-squat | Squat | Squat Standards |
| deadlift | 034ebb98-56b3-4073-a726-1709d14b4455 | barbell-deadlift | Deadlift | Deadlift Standards |
| overhead-press | 83e390eb-2f53-427e-8870-2997eb172279 | standing-military-press | Overhead press | Overhead Press Standards |
| barbell-row | 7492d613-b2ff-41c0-9131-af0bb9832438 | bent-over-barbell-row | Barbell row | Barbell Row Standards |
| romanian-deadlift | 21e9e394-1151-4a07-bb3a-2fd487e461dd | romanian-deadlift | Romanian deadlift | Romanian Deadlift Standards |
| lat-pulldown | 653288a1-8c39-4840-a2bc-c6eb64790c82 | wide-grip-lat-pulldown | Lat pulldown | Lat Pulldown Standards |

Put this table and all page copy in `apps/web/src/lib/strength-pages.ts`, in the same shape as `submuscle-pages.ts`. The exercise ids must equal `STRENGTH_EXERCISES`; add a test that checks it. The MCP tool's `LIFT_SLUGS` map in `lib/mcp/tools.ts` should read from this table instead of keeping its own copy.

## Shared helpers (packages/shared, with vitest)

Add to `strength-standards.ts`:

1. `estimatedMaxKg(weightKg, reps)`: a single is the weight itself, 2 to 12 reps use `oneRepMaxNumeric` (Epley), anything else returns null. The MCP tool already has this rule inline; switch it to the helper.
2. `strengthTableRow(exerciseId, sex, bodyweight, unit)`: the four thresholds for that bodyweight in `unit`, each through `roundLoadNearest`, age factor 1. Null when `strengthThresholds` is null.

Tests, using numbers checked by hand against the current table:

- bench, male, 180 lb → 135, 180, 270, 360
- bench, female, 140 lb → 55, 90, 125, 170
- squat, male, 180 lb → 180, 270, 360, 445
- deadlift, male, 180 lb → 225, 315, 445, 535
- bench, male, 120 lb → 100, 135, 205, 275 and 280 lb → 180, 240, 360, 480
- `estimatedMaxKg(100, 1)` is 100, `(100, 5)` is about 116.7, `(100, 13)` and `(100, 0)` are null

## Styling

Highland only, same rules as every other public page: `CatalogHeader`, `SiteFooter`, the cream background, Outfit with tabular figures for every number, the card tints from `packages/shared` card-tints. Use `guides_.$slug.tsx` and `routines_.$slug.tsx` as the reference for spacing, breadcrumb, answer block (`AnswerBlock`), FAQ (`Faq`) and the CTA section. Anything on the pre-Highland look is never a reference. Works at phone width with a 16px gutter and no horizontal scroll; tables scroll inside their own container on small phones.

Level colours: no red or warning colour for Beginner, and no gold anywhere (gold is PRs only). Use the accent at increasing strength across the five segments, same as the app's strength bar.

## Lift page layout

1. Breadcrumb: Strength standards › {name}
2. H1, then intro paragraph 1 (shared template) and intro paragraph 2 (per lift)
3. `AnswerBlock` with the computed answer (template below)
4. Calculator card
5. Two tables, "{H1 without Standards} standards for men" and "... for women", with a lb / kg toggle that shares state with the calculator's unit. Columns Bodyweight, Beginner, Novice, Intermediate, Advanced, Elite. The Beginner cell reads "under 135". Rows in lb: men 120 to 280 in steps of 20, women 100 to 240 in steps of 20. Rows in kg: men 55 to 125 in steps of 10, women 45 to 105 in steps of 10. When the calculator has a bodyweight, highlight the closest row. Under the tables, one line: the load note for the lift, then "Ages 18 to 39. The calculator adjusts for your age."
6. "What the levels mean" list (shared copy below)
7. Two link cards. The exercise page ("How to {name lowercase}, with a starting weight") and the Full Body 3x a week routine (`/routines/full-body-3-day`)
8. FAQ: the per-lift beginner question, the per-lift second question, then the two shared questions
9. CTA section (copy below), `AppStoreBadge` with `campaign="strength"`
10. "Other lifts" list linking the other 6 pages, then `SiteFooter`

Every number on the page comes from the shared helpers at render time. No threshold is typed into copy.

## Hub layout

1. H1, the two hub intro paragraphs
2. Calculator card with a lift picker (all 7)
3. Summary table. Lift (linked to its page), Novice and Intermediate for a 180 lb man, Novice and Intermediate for a 140 lb woman, with the same lb / kg toggle (82 kg and 64 kg in kg mode)
4. "What the levels mean"
5. Hub FAQ, CTA section, footer

## Calculator

One component, `StrengthCalculator`, used on both page types. Fields:

- Lift (hub only)
- Weight lifted, Reps (1 to 12, stepper), Bodyweight
- Standards for, a two-option segmented control, Men and Women. Nothing preselected
- Age, optional
- lb / kg toggle, lb by default

Validation. Weight above 0. Bodyweight 70 to 500 lb or 30 to 230 kg. Reps over 12 show "Use a set of 12 reps or fewer for a good estimate." No result until weight, reps, bodyweight and sex are filled.

Result, from `estimatedMaxKg`, `strengthThresholds` (with `ageFactor` when age is set), `strengthLevel` and `strengthBarPosition`:

- The level name, large
- "Estimated max 167 lb", or "Max 185 lb" when reps is 1. The words are "estimated max" everywhere in UI, never "1RM"
- The five-segment bar with a marker
- "15 lb to Intermediate" via `roundLoadUp`, or "Top level" at Elite
- Share and Copy link buttons. Share uses `navigator.share` where it exists, else copies. Shared text is "I'm {level} on the {name lowercase}. See where you stand on LiftCamp." plus the URL

State lives in search params (`validateSearch`, like `routines_.build.tsx`): `w`, `r`, `bw`, `s` (m or f), `u` (lb or kg), `a`, and `lift` on the hub. Update with `replace`. The page server-renders the result when the params are complete, so a shared link shows it on first paint. Canonical always points at the clean path.

If `track()` in `lib/analytics.ts` works for signed-out web visitors, add a `strength_calculated` event with `{ lift, level }`, fired once per settled result. If it needs a user, skip this and say so in your report.

## Head and structured data

- Title and meta description from the copy below
- Canonical, og tags. og:image is the exercise's card via `exerciseOgPath(exerciseSlug)` when it exists, the squat's for the hub
- JSON-LD: BreadcrumbList, FAQPage built from the same list the page renders (the `Faq` component pattern), and WebPage with the Organization publisher from `lib/brand`

## Links in and out

- `SiteFooter`: add "Strength standards" after Guides
- The 7 exercise detail pages: one line linking to their standards page, "See the {name lowercase} strength standards", next to the beginner block. Other exercise pages get nothing
- MCP `strength_level`: the closing site link goes to `/strength-standards/<slug>` with the same utm tags. Update its tests
- `/llms.txt`: a "## Strength standards" section after the routines section. Hub line "[Strength standards](https://liftcamp.app/strength-standards): LiftCamp's strength levels for 7 lifts, for men and women by bodyweight, with a calculator." Then one line per lift page with the note "Novice and Intermediate thresholds by bodyweight, men and women."
- Sitemap: the 8 URLs, lastmod `STRENGTH_LAST_MODIFIED` in `page-dates.ts`, set to the day you finish. Update `sitemap.test.ts`

## Copy

Site voice. Short sentences, digits for numbers, no em dashes, no colons in body copy, no injury claims. Use as written; fix only typos. `{m.novice}` means the Novice threshold for a 180 lb man, written "135 lb (60 kg)" with each unit rounded on its own. `{f.*}` is a 140 lb woman. `{lift}` is the lowercase name.

### Shared

Lift page intro 1: These are the {lift} numbers for each of LiftCamp's 5 levels, from Beginner to Elite, at your bodyweight. Put in a recent set and the calculator places you on the scale and shows how far it is to the next level.

Answer block: For a 180 lb (82 kg) man, a Novice {lift} starts at {m.novice} and Intermediate at {m.intermediate}. For a 140 lb (64 kg) woman, Novice starts at {f.novice} and Intermediate at {f.intermediate}. Anything under Novice is Beginner, where nearly everyone starts.

Lift page meta: {Name} standards for men and women at every bodyweight, from Beginner to Elite. Free calculator that estimates your max from any set and shows your next level.

What the levels mean:
- Beginner. Under Novice. Where nearly everyone starts.
- Novice. A few months of steady training, usually 2 or 3 days a week.
- Intermediate. Usually a year or more of training with a plan.
- Advanced. Years of focused training.
- Elite. Competitive lifters. Few people reach it on any lift.

Beginner FAQ answer, every lift: For a 180 lb man, anything under {m.novice} is Beginner. For a 140 lb woman, it's anything under {f.novice}. In your first few months, pick a weight you can lift for 10 clean reps and add a little when every set hits its reps.

Shared FAQ 1. Q: Do I need to test my 1-rep max? A: No. Put in any recent set of 1 to 12 reps and the calculator estimates your max with the Epley formula. Sets under 10 reps give the closest estimate.

Shared FAQ 2. Q: Where do these numbers come from? A: They're LiftCamp's own standards, set as multiples of bodyweight and scaled so heavier lifters need a little less per pound. They match the level the LiftCamp app shows on each lift. Other sites use different tables, so your level may differ by a step between them.

CTA heading: Track your level as you lift

CTA body: The free LiftCamp app shows your strength level on all 7 of these lifts and how far you are from the next one, updated every time you log a set. Free on iPhone.

### Hub

Title: Strength Standards for Beginners: How Much Should You Lift? | LiftCamp

Meta: Strength standards for bench, squat, deadlift, overhead press and 3 more lifts, for men and women at every bodyweight. Free calculator with your level and the next one.

H1: Strength Standards

Intro 1: How much should you lift? These tables show where each of LiftCamp's 5 levels starts on 7 lifts, for men and women at your bodyweight. Pick a lift, put in a recent set, and the calculator shows your level and how far it is to the next.

Intro 2: Almost everyone starts at Beginner. Novice is a fair goal for your first 6 months, and moving up one level on any lift is real progress.

Hub FAQ:
- Q: What's a good strength level for a beginner? A: Beginner is where nearly everyone starts, and Novice is a fair goal for your first 6 months. Pick one lift you care about and watch it move up a level.
- Shared FAQ 1 and 2
- Q: Does age change my level? A: Yes, a little. The tables assume ages 18 to 39. From 40 the thresholds drop 5%, and they drop further each decade after that. Under 18 they're 15% lower. Add your age in the calculator and it adjusts.

### Per lift

**bench-press**
Title: Bench Press Standards: How Much Should You Bench? | LiftCamp
Intro 2: Most people start under Novice, and that's the normal place to be in your first few months. The empty bar weighs 45 lb (20 kg), and pressing it for a few weeks before adding plates is a fine start.
Beginner Q: How much should a beginner bench?
Q2: Is a bodyweight bench press good? A: Yes. At an average bodyweight, benching your own weight is around the start of Intermediate for men and around Advanced for women.

**squat**
Title: Squat Standards: How Much Should You Squat? | LiftCamp
Intro 2: The numbers are for a barbell back squat to at least parallel, bar included. Goblet squats and dumbbell squats count as training, and they're a good way in, but they aren't on this table.
Beginner Q: How much should a beginner squat?
Q2: Is a bodyweight squat good? A: At an average bodyweight, squatting your own weight is around the start of Novice for men and around the start of Intermediate for women.

**deadlift**
Title: Deadlift Standards: How Much Should You Deadlift? | LiftCamp
Intro 2: The deadlift has the biggest numbers of any lift here, so compare it with other people's deadlifts and leave your squat and bench out of it. The weight is the whole bar plus plates, pulled from the floor.
Beginner Q: How much should a beginner deadlift?
Q2: Is a 2x bodyweight deadlift good? A: Yes. At an average bodyweight, pulling twice your weight is solidly Intermediate for men and Advanced for women.

**overhead-press**
Title: Overhead Press Standards: How Much Should You Press? | LiftCamp
Intro 2: This is the standing barbell press, also called the military press, from your shoulders to locked out overhead. It has the smallest numbers of the main lifts, so small jumps of 2.5 lb a side are normal.
Beginner Q: How much should a beginner overhead press?
Q2: Why is my overhead press so much lower than my bench? A: Pressing overhead uses smaller muscles and a longer path. On this table the overhead press is roughly two thirds of the bench press at each level.

**barbell-row**
Title: Barbell Row Standards by Bodyweight | LiftCamp
Intro 2: This is the bent-over barbell row with your torso close to parallel to the floor. Standing more upright lets you row more weight, so numbers from an upright row will read high here.
Beginner Q: What's a good barbell row for a beginner?
Q2: How should my row compare to my bench? A: On this table the barbell row is a little under the bench press, roughly 70 to 90% of it at each level.

**romanian-deadlift**
Title: Romanian Deadlift Standards by Bodyweight | LiftCamp
Intro 2: The Romanian deadlift starts standing and lowers the bar to about mid-shin with soft knees, so its numbers sit below the deadlift. The table puts it at about three quarters of the deadlift at every level.
Beginner Q: What's a good Romanian deadlift for a beginner?
Q2: Should my Romanian deadlift be as heavy as my deadlift? A: No. It stops short of the floor and keeps the work on your hamstrings, so expect about three quarters of your deadlift.

**lat-pulldown**
Title: Lat Pulldown Standards by Bodyweight | LiftCamp
Intro 2: The weight is the number on the stack. Stacks differ between machines and brands, so treat your level here as a rough guide and compare against yourself on the same machine.
Beginner Q: What's a good lat pulldown for a beginner?
Q2: Is pulling my bodyweight on the pulldown good? A: Yes. At an average bodyweight it's past Intermediate for men and around the start of Elite for women. Stacks vary, so take it as a rough read.

Load notes for the line under the tables: bar lifts "The weight is the whole bar, plates included." Lat pulldown "The weight is the number on the stack." (same strings as the MCP tool's `LOAD_NOTE`; share them).

## Done means

- `pnpm vitest` passes in `packages/shared` and `apps/web`, typecheck passes, `apps/web` builds
- View source on a lift page shows both tables and the answer block as HTML, without JavaScript
- A URL with all params renders the result on first load, and its canonical is the clean path
- Report back with the branch, commits, the Vercel preview URL if it posts one, anything in this file you changed or skipped and why, and whether the analytics event went in
