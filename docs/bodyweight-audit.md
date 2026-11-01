# Bodyweight audit

Read-only audit for adding bodyweight-only routines. 15 Oct 2026. Exercise and
program data come from live queries on `mnsigwjyskxfuszeegtp`, not the migration
folder. Routine art was computed by running `routineArtByProgram` from `main`
over the live system templates (82 rows).

## Findings to act on

1. **Bodyweight Only is not equipment-free.** Its blurb and FAQ say "No
   equipment" and "A floor and something to hold onto for rows is enough", but
   Day 2 has Chin-Up (pull-up bar), Day 3 has Dips - Triceps Version (dip
   station) and Hanging Leg Raise (pull-up bar, exercise level `expert`), and
   Days 1 and 2 have Inverted Row (low bar or sturdy table).
2. **"Needs a pull-up bar" is not modeled in the database.** Bar, dip and
   ring exercises are all `equipment = 'body only'` (or `other` for rings). The
   only flag is the constant `PULL_UP_BAR_EXERCISES` in
   `packages/shared/src/routine-art.ts`, four ids, used only for card art.
3. **Routine art will repeat.** A beginner bodyweight routine can only take
   `bodyweight-mat` or `pull-up-bar`. A second beginner bodyweight routine
   already repeats the mat unless a fifth of its exercises are on the bar list.
   A fourth always repeats. Details in section 4.
4. **The engine never suggests a harder variation for body-only exercises.**
   It goes reps, then sets (up to 5), then +5 lb. "Harder variation" is only
   for the `reps` rule (`other`, balls). Details in section 6.
5. **There is no rest field on templates.** Rest is a per-user, per-exercise
   preference (`exercise_rest_prefs`), default 120 s
   (`DEFAULT_REST_SECONDS` in `apps/mobile/src/app/workout/[id].tsx`).
6. Stale comments: `matchPrograms` in `packages/shared/src/templates.ts` says
   there is no intermediate bodyweight program (Calisthenics Full Body is
   one). `routine-art.ts` says "Fourteen images"; there are 15 keys.
7. Body-only strength exercises with no media: Bird Dog, Clamshell, Fire
   Hydrant, Wall Sit. Wall Sit is in Bodyweight Only Day 1.

---

## 1. Bodyweight exercises

The no-equipment value is `exercises.equipment = 'body only'`: 251 rows.

| category | rows |
|---|---|
| strength | 103 |
| stretching | 104 |
| plyometrics | 42 |
| cardio | 2 |

Equipment values across the table: body only 251, barbell 167, dumbbell 129,
cable 82, other 57, machine 54, kettlebells 52, smith machine 28, bands 27,
medicine ball 17, foam roll 14, exercise ball 13, e-z curl bar 11.

`weight_type` is `bodyweight` on 11 body-only rows and `standard` on the other
240. The progression engine and weight box treat all 251 the same (they test
`equipment`, not `weight_type`), so `weight_type` is not a usable filter.

Media: `GIF` means `gif_url` is set (ExerciseDB, in-app only), `photo` means
only `image_url` (free-exercise-db, public pages OK), `none` means neither.

### How bar, dip and ring exercises are modeled

There is no column or flag. They sit in `body only` with everything else,
except Ring Dips and Inverted Row with Straps (`other`) and Band Assisted
Pull-Up (`bands`). The one code-level list is `PULL_UP_BAR_EXERCISES` in
`routine-art.ts`: Pullups, Chin-Up, Dips - Chest Version, Dips - Triceps
Version. It gates the `pull-up-bar` card image and nothing else. Hanging Leg
Raise is not on it.

The "needs" column below is my reading of each exercise, not data.

### Strength (103)

| slug | name | level | primary | secondary | weight_type | media | needs |
|---|---|---|---|---|---|---|---|
| clamshell | Clamshell | beginner | abductors | glutes | standard | none |  |
| fire-hydrant | Fire Hydrant | beginner | abductors | glutes, abs | standard | none |  |
| 3-4-sit-up | 3/4 Sit-Up | beginner | abs | none | standard | GIF |  |
| air-bike | Air Bike | beginner | abs | none | standard | GIF |  |
| alternate-heel-touchers | Alternate Heel Touchers | beginner | abs | none | standard | GIF |  |
| bent-knee-hip-raise | Bent-Knee Hip Raise | beginner | abs | none | standard | GIF |  |
| bottoms-up | Bottoms Up | beginner | abs | none | standard | GIF |  |
| butt-ups | Butt-Ups | beginner | abs | none | standard | GIF |  |
| cocoons | Cocoons | beginner | abs | none | standard | GIF |  |
| cross-body-crunch | Cross-Body Crunch | beginner | abs | none | standard | GIF |  |
| crunch-hands-overhead | Crunch - Hands Overhead | beginner | abs | none | standard | photo |  |
| crunches | Crunches | beginner | abs | none | standard | GIF |  |
| dead-bug | Dead Bug | beginner | abs | none | standard | GIF |  |
| decline-crunch | Decline Crunch | intermediate | abs | none | standard | GIF | bench, box or step |
| decline-oblique-crunch | Decline Oblique Crunch | beginner | abs | none | standard | photo | bench, box or step |
| decline-reverse-crunch | Decline Reverse Crunch | beginner | abs | none | standard | photo | bench, box or step |
| elbow-to-knee | Elbow to Knee | beginner | abs | none | standard | GIF |  |
| flat-bench-leg-pull-in | Flat Bench Leg Pull-In | beginner | abs | none | standard | GIF | bench, box or step |
| flat-bench-lying-leg-raise | Flat Bench Lying Leg Raise | beginner | abs | none | standard | GIF | bench, box or step |
| frog-sit-ups | Frog Sit-Ups | intermediate | abs | none | standard | photo |  |
| gorilla-chin-crunch | Gorilla Chin/Crunch | intermediate | abs | biceps, lats | standard | GIF | pull-up bar |
| hanging-leg-raise | Hanging Leg Raise | expert | abs | none | bodyweight | GIF | pull-up bar |
| hanging-pike | Hanging Pike | expert | abs | none | standard | GIF | pull-up bar |
| jackknife-sit-up | Jackknife Sit-Up | beginner | abs | none | standard | GIF |  |
| janda-sit-up | Janda Sit-Up | beginner | abs | none | standard | GIF |  |
| knee-hip-raise-on-parallel-bars | Knee/Hip Raise On Parallel Bars | beginner | abs | none | standard | photo | dip station |
| leg-pull-in | Leg Pull-In | beginner | abs | none | standard | photo |  |
| oblique-crunches | Oblique Crunches | beginner | abs | none | standard | GIF |  |
| oblique-crunches-on-the-floor | Oblique Crunches - On The Floor | beginner | abs | none | standard | GIF |  |
| plank | Plank | beginner | abs | none | standard | photo |  |
| reverse-crunch | Reverse Crunch | beginner | abs | none | standard | GIF |  |
| russian-twist | Russian Twist | intermediate | abs | lower back | standard | GIF |  |
| seated-flat-bench-leg-pull-in | Seated Flat Bench Leg Pull-In | beginner | abs | none | standard | photo | bench, box or step |
| seated-leg-tucks | Seated Leg Tucks | beginner | abs | none | standard | photo |  |
| side-bridge | Side Bridge | beginner | abs | shoulders | standard | GIF |  |
| side-jackknife | Side Jackknife | beginner | abs | none | standard | photo |  |
| sit-up | Sit-Up | beginner | abs | none | standard | GIF |  |
| spider-crawl | Spider Crawl | beginner | abs | chest, shoulders, triceps | standard | photo |  |
| tuck-crunch | Tuck Crunch | beginner | abs | none | standard | GIF |  |
| wind-sprints | Wind Sprints | beginner | abs | none | standard | GIF |  |
| bodyweight-calf-raise | Bodyweight Calf Raise | beginner | calves | none | bodyweight | GIF |  |
| donkey-calf-raises | Donkey Calf Raises | intermediate | calves | none | standard | GIF |  |
| clock-push-up | Clock Push-Up | intermediate | chest | shoulders, triceps | standard | GIF |  |
| decline-push-up | Decline Push-Up | beginner | chest | shoulders, triceps | standard | GIF | bench, box or step |
| dips-chest-version | Dips - Chest Version | intermediate | chest | shoulders, triceps | bodyweight | GIF | dip station |
| incline-push-up | Incline Push-Up | beginner | chest | shoulders, triceps | standard | GIF | bench, box or step |
| incline-push-up-medium | Incline Push-Up Medium | beginner | chest | abs, shoulders, triceps | standard | GIF | bench, box or step |
| incline-push-up-reverse-grip | Incline Push-Up Reverse Grip | beginner | chest | abs, shoulders, triceps | standard | GIF | bench, box or step |
| incline-push-up-wide | Incline Push-Up Wide | beginner | chest | abs, shoulders, triceps | standard | photo | bench, box or step |
| isometric-wipers | Isometric Wipers | beginner | chest | abs, shoulders, triceps | standard | GIF |  |
| knee-push-up | Knee Push-Up | beginner | chest | shoulders, triceps | bodyweight | GIF |  |
| push-up-to-side-plank | Push Up to Side Plank | beginner | chest | abs, shoulders, triceps | standard | GIF |  |
| push-up-wide | Push-Up Wide | beginner | chest | abs, shoulders, triceps | standard | GIF |  |
| push-ups-with-feet-elevated | Push-Ups With Feet Elevated | beginner | chest | shoulders, triceps | standard | photo | bench, box or step |
| pushups | Pushups | beginner | chest | shoulders, triceps | standard | GIF |  |
| pushups-close-and-wide-hand-positions | Pushups (Close and Wide Hand Positions) | beginner | chest | shoulders, triceps | standard | photo |  |
| single-arm-push-up | Single-Arm Push-Up | intermediate | chest | shoulders, triceps | standard | GIF |  |
| butt-lift-bridge | Butt Lift (Bridge) | beginner | glutes | hamstrings | standard | photo |  |
| flutter-kicks | Flutter Kicks | beginner | glutes | hamstrings | standard | GIF |  |
| glute-kickback | Glute Kickback | beginner | glutes | hamstrings | standard | photo |  |
| leg-lift | Leg Lift | beginner | glutes | hamstrings | standard | photo |  |
| single-leg-glute-bridge | Single Leg Glute Bridge | beginner | glutes | hamstrings | standard | GIF |  |
| step-up-with-knee-raise | Step-up with Knee Raise | beginner | glutes | hamstrings, quads | standard | photo | bench, box or step |
| floor-glute-ham-raise | Floor Glute-Ham Raise | intermediate | hamstrings | calves, glutes | standard | photo | partner or anchor |
| natural-glute-ham-raise | Natural Glute Ham Raise | intermediate | hamstrings | calves, glutes, lower back | standard | GIF | partner or anchor |
| platform-hamstring-slides | Platform Hamstring Slides | beginner | hamstrings | glutes | standard | photo |  |
| prone-manual-hamstring | Prone Manual Hamstring | beginner | hamstrings | none | standard | GIF | partner or anchor |
| split-squats | Split Squats | intermediate | hamstrings | calves, glutes, quads | standard | GIF |  |
| chin-up | Chin-Up | beginner | lats | biceps, forearms, upper back | bodyweight | GIF | pull-up bar |
| gironda-sternum-chins | Gironda Sternum Chins | intermediate | lats | biceps, upper back | standard | GIF | pull-up bar |
| kipping-muscle-up | Kipping Muscle Up | intermediate | lats | abs, biceps, forearms, upper back, shoulders, traps, triceps | standard | GIF | pull-up bar |
| london-bridges | London Bridges | intermediate | lats | biceps, forearms, upper back | standard | GIF | climbing rope |
| muscle-up | Muscle Up | intermediate | lats | abs, biceps, forearms, upper back, shoulders, traps, triceps | standard | GIF | pull-up bar |
| pullups | Pullups | beginner | lats | biceps, upper back | bodyweight | GIF | pull-up bar |
| rocky-pull-ups-pulldowns | Rocky Pull-Ups/Pulldowns | intermediate | lats | biceps, upper back, shoulders | standard | GIF | pull-up bar |
| side-to-side-chins | Side To Side Chins | intermediate | lats | biceps, forearms, upper back, shoulders | standard | GIF | pull-up bar |
| v-bar-pullup | V-Bar Pullup | beginner | lats | biceps, upper back, shoulders | standard | GIF | pull-up bar |
| weighted-pull-ups | Weighted Pull Ups | intermediate | lats | biceps, upper back | standard | GIF | pull-up bar |
| wide-grip-rear-pull-up | Wide-Grip Rear Pull-Up | intermediate | lats | biceps, upper back, shoulders | bodyweight | GIF | pull-up bar |
| bird-dog | Bird Dog | beginner | lower back | glutes, shoulders | bodyweight | none |  |
| hyperextensions-with-no-hyperextension-bench | Hyperextensions With No Hyperextension Bench | intermediate | lower back | glutes, hamstrings | standard | GIF |  |
| isometric-neck-exercise-front-and-back | Isometric Neck Exercise - Front And Back | beginner | neck | none | standard | photo |  |
| isometric-neck-exercise-sides | Isometric Neck Exercise - Sides | beginner | neck | none | standard | photo |  |
| bodyweight-squat | Bodyweight Squat | beginner | quads | glutes, hamstrings | standard | photo |  |
| bodyweight-walking-lunge | Bodyweight Walking Lunge | beginner | quads | calves, glutes, hamstrings | standard | GIF |  |
| freehand-jump-squat | Freehand Jump Squat | intermediate | quads | calves, glutes, hamstrings | standard | GIF |  |
| single-leg-high-box-squat | Single-Leg High Box Squat | beginner | quads | glutes, hamstrings | standard | photo | bench, box or step |
| wall-sit | Wall Sit | beginner | quads | hamstrings, calves | bodyweight | none |  |
| handstand-push-ups | Handstand Push-Ups | expert | shoulders | triceps | standard | GIF |  |
| pike-push-up | Pike Push-Up | intermediate | shoulders | triceps, upper back | bodyweight | GIF |  |
| scapular-pull-up | Scapular Pull-Up | beginner | traps | lats, upper back | standard | GIF | pull-up bar |
| bench-dips | Bench Dips | beginner | triceps | chest, shoulders | standard | GIF | bench, box or step |
| body-tricep-press | Body Tricep Press | beginner | triceps | none | standard | GIF | bench, box or step |
| body-up | Body-Up | intermediate | triceps | abs, forearms | standard | GIF |  |
| dips-triceps-version | Dips - Triceps Version | beginner | triceps | chest, shoulders | bodyweight | GIF | dip station |
| incline-push-up-close-grip | Incline Push-Up Close-Grip | beginner | triceps | chest, shoulders | standard | GIF | bench, box or step |
| parallel-bar-dip | Parallel Bar Dip | beginner | triceps | chest, shoulders | standard | photo | dip station |
| push-ups-close-triceps-position | Push-Ups - Close Triceps Position | intermediate | triceps | chest, shoulders | standard | GIF |  |
| standing-towel-triceps-extension | Standing Towel Triceps Extension | beginner | triceps | none | standard | GIF |  |
| bodyweight-mid-row | Bodyweight Mid Row | intermediate | upper back | biceps, lats | standard | GIF | low bar or sturdy table |
| inverted-row | Inverted Row | beginner | upper back | lats | standard | GIF | low bar or sturdy table |
| mixed-grip-chin | Mixed Grip Chin | expert | upper back | biceps, lats | standard | GIF | pull-up bar |
| one-arm-chin-up | One Arm Chin-Up | expert | upper back | biceps, forearms, lats | standard | GIF | pull-up bar |

Related exercises outside `body only` that need a bar, rings or a dip station:

| slug | name | equipment | level | primary | media |
|---|---|---|---|---|---|
| band-assisted-pull-up | Band Assisted Pull-Up | bands | beginner | lats | GIF |
| inverted-row-with-straps | Inverted Row with Straps | other | beginner | upper back | GIF |
| ring-dips | Ring Dips | other | intermediate | triceps | GIF |
| weighted-bench-dip | Weighted Bench Dip | other | intermediate | triceps | GIF |
| dip-machine | Dip Machine | machine | beginner | triceps | GIF |

### Plyometrics (42)

Note: Mountain Climbers is `plyometrics`. Superman (below, in stretching) is
`stretching`. Both are in both existing bodyweight programs.

| slug | name | level | primary | secondary | media |
|---|---|---|---|---|---|
| carioca-quick-step | Carioca Quick Step | beginner | adductors | abs, abductors, calves, glutes, hamstrings, quads | photo |
| lateral-bound | Lateral Bound | beginner | adductors | abductors, calves, glutes, hamstrings, quads | photo |
| lateral-box-jump | Lateral Box Jump | beginner | adductors | abductors, calves, glutes, hamstrings, quads | photo |
| lateral-cone-hops | Lateral Cone Hops | beginner | adductors | abductors, calves, glutes, hamstrings, quads | photo |
| drop-push | Drop Push | intermediate | chest | shoulders, triceps | GIF |
| incline-push-up-depth-jump | Incline Push-Up Depth Jump | beginner | chest | shoulders, triceps | GIF |
| isometric-chest-squeezes | Isometric Chest Squeezes | beginner | chest | shoulders, triceps | GIF |
| plyo-push-up | Plyo Push-up | beginner | chest | shoulders, triceps | GIF |
| box-jump-multiple-response | Box Jump (Multiple Response) | beginner | hamstrings | abductors, adductors, calves, glutes, quads | photo |
| box-skip | Box Skip | beginner | hamstrings | abductors, adductors, calves, glutes, quads | photo |
| front-box-jump | Front Box Jump | beginner | hamstrings | abductors, adductors, calves, glutes, quads | photo |
| hurdle-hops | Hurdle Hops | beginner | hamstrings | abductors, adductors, calves, glutes, hamstrings | photo |
| knee-tuck-jump | Knee Tuck Jump | beginner | hamstrings | abductors, adductors, calves, glutes, quads | photo |
| linear-3-part-start-technique | Linear 3-Part Start Technique | beginner | hamstrings | calves, quads | photo |
| linear-acceleration-wall-drill | Linear Acceleration Wall Drill | beginner | hamstrings | calves, glutes, quads | photo |
| moving-claw-series | Moving Claw Series | beginner | hamstrings | calves, quads | photo |
| alternate-leg-diagonal-bound | Alternate Leg Diagonal Bound | beginner | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| bench-jump | Bench Jump | intermediate | quads | calves, glutes, hamstrings | photo |
| bench-sprint | Bench Sprint | beginner | quads | calves, glutes, hamstrings | photo |
| depth-jump-leap | Depth Jump Leap | beginner | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| double-leg-butt-kick | Double Leg Butt Kick | beginner | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| fast-skipping | Fast Skipping | beginner | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| front-cone-hops-or-hurdle-hops | Front Cone Hops (or hurdle hops) | beginner | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| linear-depth-jump | Linear Depth Jump | intermediate | quads | calves, glutes, hamstrings | photo |
| mountain-climbers | Mountain Climbers | beginner | quads | chest, hamstrings, shoulders | GIF |
| quick-leap | Quick Leap | beginner | quads | calves, hamstrings | photo |
| rocket-jump | Rocket Jump | beginner | quads | calves, hamstrings | photo |
| scissors-jump | Scissors Jump | beginner | quads | glutes, hamstrings | GIF |
| side-hop-sprint | Side Hop-Sprint | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| side-standing-long-jump | Side Standing Long Jump | beginner | quads | calves, glutes, hamstrings | photo |
| side-to-side-box-shuffle | Side to Side Box Shuffle | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| single-leg-butt-kick | Single Leg Butt Kick | beginner | quads | calves, hamstrings | photo |
| single-leg-push-off | Single Leg Push-off | beginner | quads | calves, hamstrings | photo |
| single-cone-sprint-drill | Single-Cone Sprint Drill | beginner | quads | calves, glutes, hamstrings | photo |
| single-leg-hop-progression | Single-Leg Hop Progression | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| single-leg-lateral-hop | Single-Leg Lateral Hop | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| single-leg-stride-jump | Single-Leg Stride Jump | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| split-jump | Split Jump | beginner | quads | calves, glutes, hamstrings | photo |
| standing-long-jump | Standing Long Jump | beginner | quads | calves, glutes, hamstrings | photo |
| star-jump | Star Jump | beginner | quads | calves, glutes, hamstrings, shoulders | GIF |
| stride-jump-crossover | Stride Jump Crossover | beginner | quads | abductors, adductors, calves, hamstrings | photo |
| kneeling-arm-drill | Kneeling Arm Drill | beginner | shoulders | abs | photo |

### Cardio (2)

| slug | name | level | primary | secondary | media |
|---|---|---|---|---|---|
| skating | Skating | intermediate | quads | abductors, adductors, calves, glutes, hamstrings | photo |
| trail-running-walking | Trail Running/Walking | beginner | quads | calves, glutes, hamstrings | photo |

### Stretching (104)

| slug | name | level | primary | secondary | media |
|---|---|---|---|---|---|
| hip-circles-prone | Hip Circles (prone) | beginner | abductors | adductors | photo |
| it-band-and-glute-stretch | IT Band and Glute Stretch | intermediate | abductors | none | photo |
| lying-crossover | Lying Crossover | expert | abductors | none | photo |
| standing-hip-circles | Standing Hip Circles | beginner | abductors | adductors | photo |
| windmills | Windmills | intermediate | abductors | glutes, hamstrings, lower back | photo |
| lower-back-curl | Lower Back Curl | beginner | abs | none | GIF |
| overhead-stretch | Overhead Stretch | beginner | abs | chest, forearms, lats, triceps | photo |
| scissor-kick | Scissor Kick | beginner | abs | none | photo |
| seated-overhead-stretch | Seated Overhead Stretch | beginner | abs | none | photo |
| standing-lateral-stretch | Standing Lateral Stretch | beginner | abs | none | GIF |
| stomach-vacuum | Stomach Vacuum | beginner | abs | none | photo |
| toe-touchers | Toe Touchers | beginner | abs | none | photo |
| adductor-groin | Adductor/Groin | intermediate | adductors | none | photo |
| groin-and-back-stretch | Groin and Back Stretch | intermediate | adductors | none | photo |
| groiners | Groiners | intermediate | adductors | none | photo |
| lying-bent-leg-groin | Lying Bent Leg Groin | expert | adductors | none | photo |
| side-leg-raises | Side Leg Raises | beginner | adductors | none | GIF |
| side-lying-groin-stretch | Side Lying Groin Stretch | beginner | adductors | hamstrings | GIF |
| seated-biceps | Seated Biceps | expert | biceps | chest, shoulders | photo |
| standing-biceps-stretch | Standing Biceps Stretch | beginner | biceps | chest, shoulders | photo |
| ankle-circles | Ankle Circles | beginner | calves | none | GIF |
| calf-stretch-elbows-against-wall | Calf Stretch Elbows Against Wall | beginner | calves | none | GIF |
| calf-stretch-hands-against-wall | Calf Stretch Hands Against Wall | beginner | calves | none | GIF |
| knee-circles | Knee Circles | beginner | calves | hamstrings, quads | GIF |
| peroneals-stretch | Peroneals Stretch | intermediate | calves | none | GIF |
| posterior-tibialis-stretch | Posterior Tibialis Stretch | intermediate | calves | none | GIF |
| seated-calf-stretch | Seated Calf Stretch | beginner | calves | hamstrings, lower back | GIF |
| standing-gastrocnemius-calf-stretch | Standing Gastrocnemius Calf Stretch | beginner | calves | hamstrings | GIF |
| standing-soleus-and-achilles-stretch | Standing Soleus And Achilles Stretch | beginner | calves | none | photo |
| behind-head-chest-stretch | Behind Head Chest Stretch | expert | chest | shoulders | GIF |
| chest-and-front-of-shoulder-stretch | Chest And Front Of Shoulder Stretch | beginner | chest | shoulders | GIF |
| dynamic-chest-stretch | Dynamic Chest Stretch | beginner | chest | upper back | GIF |
| elbows-back | Elbows Back | beginner | chest | shoulders | photo |
| kneeling-forearm-stretch | Kneeling Forearm Stretch | beginner | forearms | none | photo |
| wrist-circles | Wrist Circles | beginner | forearms | none | GIF |
| ankle-on-the-knee | Ankle On The Knee | beginner | glutes | none | photo |
| crossover-reverse-lunge | Crossover Reverse Lunge | intermediate | glutes | abs, hamstrings, quads | photo |
| knee-across-the-body | Knee Across The Body | beginner | glutes | abductors, lower back | photo |
| lying-glute | Lying Glute | expert | glutes | abductors | GIF |
| one-knee-to-chest | One Knee To Chest | beginner | glutes | hamstrings, lower back | photo |
| seated-glute | Seated Glute | expert | glutes | adductors | GIF |
| 90-90-hamstring | 90/90 Hamstring | beginner | hamstrings | calves | photo |
| chair-leg-extended-stretch | Chair Leg Extended Stretch | beginner | hamstrings | adductors | GIF |
| front-leg-raises | Front Leg Raises | beginner | hamstrings | none | photo |
| hamstring-stretch | Hamstring Stretch | beginner | hamstrings | none | GIF |
| inchworm | Inchworm | beginner | hamstrings | none | GIF |
| intermediate-groin-stretch | Intermediate Groin Stretch | intermediate | hamstrings | none | photo |
| leg-up-hamstring-stretch | Leg-Up Hamstring Stretch | beginner | hamstrings | none | GIF |
| lying-hamstring | Lying Hamstring | expert | hamstrings | calves | photo |
| runners-stretch | Runner's Stretch | beginner | hamstrings | calves | GIF |
| seated-floor-hamstring-stretch | Seated Floor Hamstring Stretch | beginner | hamstrings | calves | photo |
| seated-hamstring | Seated Hamstring | expert | hamstrings | calves | photo |
| seated-hamstring-and-calf-stretch | Seated Hamstring and Calf Stretch | intermediate | hamstrings | calves | photo |
| standing-hamstring-and-calf-stretch | Standing Hamstring and Calf Stretch | beginner | hamstrings | none | GIF |
| standing-toe-touches | Standing Toe Touches | beginner | hamstrings | calves | GIF |
| the-straddle | The Straddle | beginner | hamstrings | adductors, calves | photo |
| upper-back-leg-grab | Upper Back-Leg Grab | beginner | hamstrings | lower back, upper back | photo |
| worlds-greatest-stretch | World's Greatest Stretch | intermediate | hamstrings | calves, glutes, quads | GIF |
| chair-lower-back-stretch | Chair Lower Back Stretch | beginner | lats | lower back | GIF |
| dynamic-back-stretch | Dynamic Back Stretch | beginner | lats | none | photo |
| one-arm-against-wall | One Arm Against Wall | beginner | lats | none | GIF |
| one-handed-hang | One Handed Hang | beginner | lats | biceps | photo |
| overhead-lat | Overhead Lat | expert | lats | triceps | photo |
| side-lying-floor-stretch | Side-Lying Floor Stretch | beginner | lats | none | GIF |
| cat-stretch | Cat Stretch | beginner | lower back | upper back, traps | photo |
| childs-pose | Child's Pose | beginner | lower back | glutes, upper back | photo |
| dancers-stretch | Dancer's Stretch | beginner | lower back | abductors, glutes | photo |
| hug-knees-to-chest | Hug Knees To Chest | beginner | lower back | glutes | GIF |
| pelvic-tilt-into-bridge | Pelvic Tilt Into Bridge | intermediate | lower back | none | GIF |
| standing-pelvic-tilt | Standing Pelvic Tilt | beginner | lower back | glutes | GIF |
| superman | Superman | beginner | lower back | glutes, hamstrings | photo |
| chin-to-chest-stretch | Chin To Chest Stretch | beginner | neck | traps | photo |
| side-neck-stretch | Side Neck Stretch | beginner | neck | none | GIF |
| all-fours-quad-stretch | All Fours Quad Stretch | intermediate | quads | quads | GIF |
| frog-hops | Frog Hops | intermediate | quads | calves, glutes, hamstrings | photo |
| intermediate-hip-flexor-and-quad-stretch | Intermediate Hip Flexor and Quad Stretch | intermediate | quads | none | GIF |
| iron-crosses-stretch | Iron Crosses (stretch) | intermediate | quads | none | GIF |
| kneeling-hip-flexor | Kneeling Hip Flexor | beginner | quads | quads | photo |
| looking-at-ceiling | Looking At Ceiling | beginner | quads | none | photo |
| lying-prone-quadriceps | Lying Prone Quadriceps | expert | quads | none | GIF |
| on-your-side-quad-stretch | On Your Side Quad Stretch | beginner | quads | none | GIF |
| on-your-back-quad-stretch | On-Your-Back Quad Stretch | beginner | quads | none | photo |
| one-half-locust | One Half Locust | beginner | quads | abs, biceps, chest | photo |
| quad-stretch | Quad Stretch | intermediate | quads | none | photo |
| rear-leg-raises | Rear Leg Raises | beginner | quads | none | photo |
| sit-squats | Sit Squats | beginner | quads | abductors, glutes, hamstrings | photo |
| standing-elevated-quad-stretch | Standing Elevated Quad Stretch | beginner | quads | none | photo |
| standing-hip-flexors | Standing Hip Flexors | beginner | quads | none | photo |
| arm-circles | Arm Circles | beginner | shoulders | traps | photo |
| chair-upper-body-stretch | Chair Upper Body Stretch | beginner | shoulders | biceps, chest | photo |
| elbow-circles | Elbow Circles | beginner | shoulders | traps | photo |
| round-the-world-shoulder-stretch | Round The World Shoulder Stretch | beginner | shoulders | biceps, chest | photo |
| seated-front-deltoid | Seated Front Deltoid | expert | shoulders | chest | photo |
| shoulder-circles | Shoulder Circles | beginner | shoulders | traps | photo |
| shoulder-raise | Shoulder Raise | beginner | shoulders | lats | photo |
| shoulder-stretch | Shoulder Stretch | beginner | shoulders | none | photo |
| side-wrist-pull | Side Wrist Pull | beginner | shoulders | forearms, lats | GIF |
| upward-stretch | Upward Stretch | beginner | shoulders | chest, lats | photo |
| overhead-triceps | Overhead Triceps | expert | triceps | lats | GIF |
| tricep-side-stretch | Tricep Side Stretch | beginner | triceps | shoulders | photo |
| triceps-stretch | Triceps Stretch | beginner | triceps | lats | GIF |
| middle-back-stretch | Middle Back Stretch | beginner | upper back | abs, lats, lower back | photo |
| spinal-stretch | Spinal Stretch | beginner | upper back | lats, lower back, neck, traps | GIF |
| upper-back-stretch | Upper Back Stretch | beginner | upper back | upper back | GIF |

---

## 2. Existing bodyweight programs

These are the only two system programs with `templates.equipment =
'bodyweight'`. There is no `programs` table: a program is the set of
`templates` rows sharing `program` / `program_slug`, one row per day
("variation"), with the program-level fields repeated on every row.

Rest: no column exists on `templates` or `template_exercises`. Every exercise
rests 120 s unless the user saved their own length from the rest sheet
(`exercise_rest_prefs`, per user and exercise). Presets are 60, 90, 120, 180 s.

### Program-level fields (identical on each day's row)

| field | Bodyweight Only | Calisthenics Full Body |
|---|---|---|
| program_slug | bodyweight-workout-plan | calisthenics-full-body |
| level | beginner | intermediate |
| days_per_week | 3 | 3 |
| equipment | bodyweight | bodyweight |
| hide_from_onboarding | false | true |
| program_order | 9 | 22 |
| cover_image_url | /routines/bodyweight-workout-plan.webp | null |
| created_at | 2026-09-02 22:50:56.802351+00 | 2026-09-17 04:26:59.644463+00 |
| share_token, shared_at | null | null |

Blurbs, verbatim:

- Bodyweight Only: "No equipment, three days a week, full body each time. Day 1
  uses the easiest version of every movement so you can finish it on day one,
  then the harder versions come in as you go."
- Calisthenics Full Body: "Three full body days using only your bodyweight. You
  need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy
  chairs."

`cover_image_url` is read only by the web (`public-catalog.functions.ts`); the
mobile cards use the clay art from section 4.

### Day rows

| id | program_slug | name | position |
|---|---|---|---|
| 2b7dbf7b-89c8-48a1-988c-760146208014 | bodyweight-workout-plan | Day 1 Full Body A | 1 |
| da148a79-b841-4223-8f7c-9568ca5827a2 | bodyweight-workout-plan | Day 2 Full Body B | 2 |
| e8ed5176-9ab4-4d0b-a89f-fa281c831a30 | bodyweight-workout-plan | Day 3 Full Body C | 3 |
| 1075a9c6-71fd-4078-b337-04cbf1488184 | calisthenics-full-body | Day A | 1 |
| 513952cd-6207-48d9-b1ee-002f4c8e656d | calisthenics-full-body | Day B | 2 |
| bd28f9db-00e6-40f6-bc7f-53935f77e841 | calisthenics-full-body | Day C | 3 |

### Exercise rows (`template_exercises`, verbatim values)

Bodyweight Only

| day | position | exercise | target_sets | target_reps |
|---|---|---|---|---|
| Day 1 Full Body A | 0 | Knee Push-Up | 3 | 8-10 |
| Day 1 Full Body A | 1 | Inverted Row | 3 | 8-10 |
| Day 1 Full Body A | 2 | Bodyweight Squat | 3 | 8-10 |
| Day 1 Full Body A | 3 | Butt Lift (Bridge) | 3 | 10-12 |
| Day 1 Full Body A | 4 | Wall Sit | 3 | 30s |
| Day 1 Full Body A | 5 | Plank | 3 | 30s |
| Day 2 Full Body B | 0 | Pushups | 3 | 8-10 |
| Day 2 Full Body B | 1 | Chin-Up | 3 | 8-10 |
| Day 2 Full Body B | 2 | Bodyweight Walking Lunge | 3 | 8-10 |
| Day 2 Full Body B | 3 | Single Leg Glute Bridge | 3 | 10-12 |
| Day 2 Full Body B | 4 | Bodyweight Calf Raise | 3 | 12-15 |
| Day 2 Full Body B | 5 | Mountain Climbers | 3 | 8-10 |
| Day 3 Full Body C | 0 | Pike Push-Up | 3 | 8-10 |
| Day 3 Full Body C | 1 | Dips - Triceps Version | 3 | 8-10 |
| Day 3 Full Body C | 2 | Split Squats | 3 | 8-10 |
| Day 3 Full Body C | 3 | Superman | 3 | 8-10 |
| Day 3 Full Body C | 4 | Bird Dog | 3 | 10-12 |
| Day 3 Full Body C | 5 | Hanging Leg Raise | 3 | 12-15 |

Calisthenics Full Body

| day | position | exercise | target_sets | target_reps |
|---|---|---|---|---|
| Day A | 0 | Pullups | 4 | 5-8 |
| Day A | 1 | Dips - Chest Version | 4 | 6-10 |
| Day A | 2 | Split Squats | 3 | 10-12 each |
| Day A | 3 | Single Leg Glute Bridge | 3 | 10-12 each |
| Day A | 4 | Hanging Leg Raise | 3 | 8-12 |
| Day B | 0 | Chin-Up | 4 | 5-8 |
| Day B | 1 | Pike Push-Up | 4 | 6-10 |
| Day B | 2 | Bodyweight Walking Lunge | 3 | 10-12 each |
| Day B | 3 | Inverted Row | 3 | 8-12 |
| Day B | 4 | Plank | 3 | 45s |
| Day C | 0 | Inverted Row | 4 | 8-12 |
| Day C | 1 | Pushups | 4 | 10-15 |
| Day C | 2 | Bodyweight Squat | 4 | 15-20 |
| Day C | 3 | Superman | 3 | 10-12 |
| Day C | 4 | Mountain Climbers | 3 | 20 |

Every exercise in both programs has `equipment = 'body only'`. Bodyweight Only
has no `each` on its unilateral rows; Calisthenics does.

---

## 3. Schemas and the insert pattern

### `templates` (live)

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | yes | |
| name | text | no | |
| created_at | timestamptz | no | now() |
| is_system | boolean | no | false |
| program | text | yes | |
| program_blurb | text | yes | |
| program_order | integer | no | 0 |
| hide_from_onboarding | boolean | no | false |
| share_token | text | yes | |
| shared_at | timestamptz | yes | |
| program_slug | text | yes | |
| cover_image_url | text | yes | |
| level | text | yes | |
| days_per_week | integer | yes | |
| equipment | text | yes | |
| position | integer | yes | |

Constraints: `templates_pkey`, `templates_user_id_fkey` (auth.users, cascade).
No CHECK on `level` or `equipment`; the allowed values live in code
(`TRAINING_LEVELS`, `EQUIPMENT_ACCESS` in `packages/shared/src/templates.ts`).
No unique constraint on `program_slug` (plain partial index
`templates_program_slug_idx`), so `ON CONFLICT (slug)` is not available; the
existing SQL guards with `if exists`. Partial unique index on `share_token`.

`program_order` values in use: 1 to 26, and 40. Bodyweight Only is 9,
Calisthenics 22.

### `template_exercises` (live)

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| template_id | uuid | no | |
| exercise_id | uuid | no | |
| user_id | uuid | yes | |
| position | integer | no | 0 |
| created_at | timestamptz | no | now() |
| target_sets | integer | yes | |
| target_reps | text | yes | |

Constraints: pkey; `template_id` FK to templates (cascade delete);
`exercise_id` FK to exercises (no cascade); `user_id` FK to auth.users
(cascade). Index on `(template_id, position)`.

`target_reps` is free text. Forms in use: `8-10`, `20`, `30s`, `10-12 each`.

### `docs/new-programs.sql` pattern

Structure: Section 0 diagnostic SELECT (every new slug must return 0 rows),
Section 1 one transaction with one `DO` block per program, Section 2 copy
updates, Section 3 read-only check (variation and exercise counts per slug).
Exercise ids are literals resolved by exact name, with the name as a trailing
comment. Section 0, verbatim:

```sql
select program_slug, count(*) as existing_variations
from public.templates
where program_slug in ('upper-lower-push-pull-legs', 'torso-limbs', 'volume-light-heavy', 'tiered-strength', 'dumbbell-full-body', 'calisthenics-full-body', 'bands-upper-lower', 'dumbbell-push-pull-legs-6-day', 'two-day-full-body', 'two-day-dumbbell-full-body')
group by program_slug;
```

One program block, verbatim (the Calisthenics one):

```sql
-- Calisthenics Full Body (calisthenics-full-body): 3 variations, 15 exercises
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.templates where program_slug = 'calisthenics-full-body') then
    raise notice 'skipping calisthenics-full-body: already present';
    return;
  end if;

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day A', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 1, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, 'ec472562-635a-4216-91e9-165a09f623a6', null, 0, 4, '5-8'),  -- Pullups
    (v_id, '61103781-eac4-4bdc-9879-2dd29a51e3db', null, 1, 4, '6-10'),  -- Dips - Chest Version
    (v_id, '451a9b82-e045-454a-8d45-5ba1353abb1b', null, 2, 3, '10-12 each'),  -- Split Squats
    (v_id, '6ba8aad6-b38d-432a-a1b3-393a740d03d6', null, 3, 3, '10-12 each'),  -- Single Leg Glute Bridge
    (v_id, '33330454-1ac1-486f-8b3c-7adaf9df03b5', null, 4, 3, '8-12');  -- Hanging Leg Raise

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day B', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 2, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '63c49305-7b82-4a51-87bc-9aa379b7e116', null, 0, 4, '5-8'),  -- Chin-Up
    (v_id, '0c97a268-f6b4-45e8-9a09-72803400ef74', null, 1, 4, '6-10'),  -- Pike Push-Up
    (v_id, 'ec11c1d9-ed7a-49a1-8d4a-ee380fc7ceec', null, 2, 3, '10-12 each'),  -- Bodyweight Walking Lunge
    (v_id, '8158e7bf-fd93-43ea-bec0-1d822e456ea6', null, 3, 3, '8-12'),  -- Inverted Row
    (v_id, 'c0f86c40-21ec-4135-bef6-908d2bc3154b', null, 4, 3, '45s');  -- Plank

  insert into public.templates (name, is_system, user_id, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, cover_image_url, level, days_per_week, equipment)
  values ('Day C', true, null, 'Calisthenics Full Body', 'calisthenics-full-body', 'Three full body days using only your bodyweight. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.', 22, 3, true, null, 'intermediate', 3, 'bodyweight')
  returning id into v_id;
  insert into public.template_exercises (template_id, exercise_id, user_id, position, target_sets, target_reps) values
    (v_id, '8158e7bf-fd93-43ea-bec0-1d822e456ea6', null, 0, 4, '8-12'),  -- Inverted Row
    (v_id, '9d7eb3e6-9f33-422d-b3b6-de5eaa503982', null, 1, 4, '10-15'),  -- Pushups
    (v_id, '5c81a81d-cee6-4be5-96fd-3ddb65eeea00', null, 2, 4, '15-20'),  -- Bodyweight Squat
    (v_id, '190ed825-f7db-4e9b-ac63-2e75913e0cc1', null, 3, 3, '10-12'),  -- Superman
    (v_id, '3b8e41fe-27c7-4d4e-87f9-8387f58c237a', null, 4, 3, '20');  -- Mountain Climbers
end $$;
```

Section 3 check, verbatim:

```sql
select t.program, t.program_slug, t.level, t.equipment, t.days_per_week, t.program_order,
  count(distinct t.id) as variations,
  count(te.id) as exercises,
  string_agg(distinct t.name, ' | ') as variation_names
from public.templates t
left join public.template_exercises te on te.template_id = t.id
where t.is_system and t.program_slug in ('upper-lower-push-pull-legs', 'torso-limbs', 'volume-light-heavy', 'tiered-strength', 'dumbbell-full-body', 'calisthenics-full-body', 'bands-upper-lower', 'dumbbell-push-pull-legs-6-day', 'two-day-full-body', 'two-day-dumbbell-full-body', 'arnold-split')
group by t.program, t.program_slug, t.level, t.equipment, t.days_per_week, t.program_order
order by t.program_order;
```

Full file: `docs/new-programs.sql` (490 lines), source spec
`docs/new-programs.md`.

---

## 4. Routine art for bodyweight routines

`routineArtByProgram` pools system programs by `level|equipment` (the
template's `level` and `equipment` fields), so beginner bodyweight routines
share one pool and intermediate ones another. Each pool walks most
constrained first and takes images without repeats at
`GROUP_REUSE_THRESHOLD = 0.4` (an unused image is taken if it scores at least
40% of the routine's best).

Score per image: `0.6 × share of exercises whose equipment the image lists +
0.4 × share in the image's focus` (0.5 for `any`).

Only two of the 15 images list `body only`:

| image | equipment | focus | eligibility |
|---|---|---|---|
| pull-up-bar | body only | any | only when exercises in `PULL_UP_BAR_EXERCISES` are at least 20% of the routine |
| bodyweight-mat | body only | any | always |

An all-body-only routine scores 0.8 on both. Every other image scores 0.2
(`any` focus) or `0.4 × focus share`, so it clears the 0.32 bar only when
80% or more of the routine is one focus group (for example an all-legs day
reaches `leg-press` at 0.4).

Current picks (live data):

| pool | program | image |
|---|---|---|
| beginner, bodyweight | Bodyweight Only | bodyweight-mat |
| intermediate, bodyweight | Calisthenics Full Body | pull-up-bar |

Bodyweight Only has 2 of 18 bar-list exercises (Chin-Up, Dips - Triceps
Version), 11%, so the bar image is ineligible and it takes the mat; it is the
only beginner bodyweight program, so nothing competes. Calisthenics has 3 of 15
(Pullups, Dips - Chest Version, Chin-Up), exactly 20%, so it is eligible and
takes the bar (tie at 0.8 goes to the earlier row in `ROUTINE_IMAGES`).

### Would a fourth beginner bodyweight routine repeat art?

Yes, and so would the second. Simulated by adding hypothetical beginner
bodyweight programs to the live rows and running the same function:

| added to the beginner bodyweight pool | result |
|---|---|
| 3 mixed full-body routines | all four show bodyweight-mat |
| 1 routine with 2 of 6 on the bar list, 2 mixed | bar routine gets pull-up-bar; the other three share bodyweight-mat |
| 1 all-quads day, 1 all-chest day, 1 mixed | leg-press, chest-press (machine art on a bodyweight card), and the mixed one shares bodyweight-mat |

With two eligible images, at most two beginner bodyweight routines can have
distinct, correct art, and only if one of them is at least 20% Pullups,
Chin-Up or the two Dips. Avoiding repeats past that needs new clay images
tagged `body only` (or a split by focus, such as a push-up or squat image).

---

## 5. `routine-copy.ts`

File: `apps/web/src/lib/routine-copy.ts`. Keyed by `program_slug`; a slug with
no entry gets a generated fallback from `routineCopy()` (title suffix
"(N-Day Plan)", the blurb as the answer, two generic FAQs, guides
`beginner-full-body-workout` and `picking-your-starting-weight`).

Entry type, verbatim:

```ts
export type RoutineFaq = { q: string; a: string };

export type RoutineCopy = {
  /** Search-facing headline modifier, e.g. "(6-Day Plan)". */
  titleSuffix: string;
  /** Two or three sentences, plain, at the very top of the page. */
  answer: string;
  faqs: RoutineFaq[];
  /** Guide slugs worth reading alongside this program. */
  guides: string[];
};
```

Bodyweight Only entry, verbatim:

```ts
  "bodyweight-workout-plan": {
    titleSuffix: "(No Equipment)",
    answer:
      "A bodyweight routine needs no equipment at all: three full body sessions a week. Day 1 uses the easiest version of every movement so the session is finishable on day one, and harder versions come in as you get stronger.",
    faqs: [
      {
        q: "Can you build muscle with bodyweight exercises?",
        a: "Yes, especially early on. Progress comes from harder versions and more reps rather than more weight.",
      },
      {
        q: "Do I need any equipment?",
        a: "No. A floor and something to hold onto for rows is enough. A pull-up bar helps once push-ups get easy.",
      },
      {
        q: "How do I make bodyweight exercises harder?",
        a: "Change leverage before adding reps: raise your feet, slow the lowering phase, or move to a one-leg version.",
      },
    ],
    guides: ["beginner-full-body-workout", "squat-without-a-rack"],
  },
```

The "Do I need any equipment?" answer conflicts with the program's Chin-Up,
Dips and Hanging Leg Raise (Finding 1). The Calisthenics entry
(`calisthenics-full-body`) points beginners to Bodyweight Only as "the easier
starting plan" that "needs no equipment".

---

## 6. Bodyweight progression

Branch `bodyweight-progression` exists locally and on origin and is merged
into `main`: commit `2d0e64c` "Bodyweight progression ladder; Previous column
shows BW", merged in `61cda5d` on 6 Oct 2026.

Gate: progression is Pro. `useProgressionGate` (`apps/mobile/src/lib/pro.ts`)
shows it only in a dev build with the dev toggle on, or with a tester grant.
Free users see none of it.

Code: `packages/shared/src/progression.ts`.

### Which exercises count as bodyweight

`loadRuleFor` tests `equipment = 'body only'`, whatever `weight_type` says, so
all 251 rows get the bodyweight ladder (rule `sets`). Order of checks:

1. Timed exercises (`TIMED_EXERCISES` in `set-weight.ts`, currently only Wall
   Sit) get no guidance.
2. Body only: `{ kind: "sets", firstLoad: 5 lb or 2.5 kg }`.
3. Not body only but `weight_type = 'bodyweight'`: `{ kind: "bodyweight",
   step: 5 lb or 2.5 kg }`.

A timed rep target (`30s`, `45s`) also gets no suggestion and no sheet, so the
Plank rows get nothing.

### The ladder (`sets` rule, no load ever logged)

Rep target parsing: `8-10` is a range; `10-12 each` is the range 10-12; `20`
is a fixed target, a range of 20 to 20; no target uses 8-12.

From the last session's working sets:

1. Any working set below the top of the range: every working set aims for one
   more rep than last time, capped at the top. Reason "beat last time's reps".
2. Every working set at the top, fewer than 5 sets: add one set, all at the
   top. Reason "add a set at 12".
3. Every working set at the top, 5 sets: add 5 lb (2.5 kg) in +LBS, reps drop
   to the bottom of the range. Reason "add 5 lbs".

There is no miss streak, deload or layoff step specific to the ladder beyond
the shared layoff rule (more than 28 days off holds everything, "same as last
time, N weeks off").

### When it suggests a harder variation

Never, for body-only exercises. "Top of range. Try a harder variation" and the
"Harder variation" chip belong to the `reps` rule, which covers `other`,
`medicine ball` and `exercise ball` (`bands` gets "Try a harder band"). A
body-only exercise at the top goes to more sets, then to added load.

### How +LBS interacts

Once any completed set in the exercise's history has a non-zero
`weight_value` (added load, or negative for assist), `hasLoggedLoad` switches
the rule to `bodyweight` with step 5 lb (2.5 kg), and it runs normal double
progression on the extra load:

- Reps go up to the top of the range at the same load.
- At the top: added load goes up by the step ("up 5 from last time"), assist
  comes down by the step ("5 less assist than last time"), and bodyweight
  alone (empty box, load 0) goes to +5.
- Three sessions in a row short of the bottom at one load deload to 90% then
  snap to the step.
- Partial sessions (unticked rows) hold.

Display: the weight box reads "BW", and the Previous column and suggestions
print "BW × 12", "BW +10 × 12", "BW −15" (`formatBodyweight` in
`bodyweight-label.ts`). Logging any load moves the exercise off the ladder for
good, since the test reads the whole history.

---

## 7. Onboarding equipment

Options, from `EQUIPMENT_ACCESS` and `EQUIPMENT_ACCESS_LABELS` in
`packages/shared/src/templates.ts`, stored in `user_profiles.equipment_access`
and matched against `templates.equipment`:

| value | label | heading wording (`matchHeading`) |
|---|---|---|
| gym | Gym | a full gym |
| dumbbells | Dumbbells | dumbbells |
| bodyweight | Bodyweight | no equipment |
| bands | Bands | bands |

The same tiles appear in onboarding page 3 (`apps/mobile/src/app/onboarding.tsx`,
`EquipmentTiles`), Home's preference tiles
(`components/home/pref-tiles.tsx`) and Settings.

`bodyweight` leads to Bodyweight Only. On page 4 `rankPrograms` sorts every
program by level gap, then equipment miss, then days gap, then
`program_order`. Beginner plus Bodyweight puts Bodyweight Only first (the only
beginner bodyweight program); with a 3-day target it is also an exact days
match. Intermediate plus Bodyweight puts Calisthenics Full Body first: once a
level is answered `hide_from_onboarding` is ignored, so its `true` flag only
keeps it out of the no-level default list and See all. Advanced plus
Bodyweight has no exact match; the heading falls back to "Nothing matches
exactly. For advanced lifters, any equipment."

Home's starter list (`starterPrograms` in `apps/mobile/src/data/home.ts`) uses
`matchPrograms`, exact on both level and equipment with a same-level fallback,
so it gives the same answer for beginner and intermediate bodyweight.
