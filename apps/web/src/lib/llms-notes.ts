// Hand-written one-line notes for /llms.txt, written 27 Oct 2026, keyed by
// slug. They read better than the sentence the data gives, so a slug listed
// here uses its note; any slug missing from a map (a new routine, a new
// beginner block, a new guide) still appears, with the line derived from data
// (src/lib/llms.ts). Delete an entry to fall back to the data. When the
// starting weight in a beginner block changes, update or delete its note here.

/** Routine slug to its line. Fallback: the first sentence of program_blurb. */
export const ROUTINE_NOTES: Readonly<Record<string, string>> = {
  "full-body-3-day":
    "The best first routine. Two alternating sessions, three days a week, every muscle trained three times a week.",
  "two-day-full-body": "Two gym sessions a week built around squat, bench, deadlift and press.",
  "upper-lower-beginner": "Four days a week from machines and dumbbells, no barbell work.",
  "push-pull-legs-beginner":
    "One push, one pull and one leg day a week, machines and dumbbells, about 40 minutes a session.",
  "machines-only-workout":
    "Three days a week on machines and cable stacks, the least technique to learn.",
  "5x5-strength":
    "Five sets of five on squat, bench, row, overhead press and deadlift, three days a week.",
  "glute-workout-plan": "Three days a week, two built around hip thrusts and hinges.",
  "dumbbell-only-workout": "Two dumbbells and a bench, three full body sessions a week.",
  "dumbbell-full-body": "Two alternating sessions, three days a week, six exercises each.",
  "two-day-dumbbell-full-body": "Two sessions a week at home with dumbbells and a bench.",
  "dumbbell-upper-lower": "Four days a week, six exercises a session, no rack or cables.",
  "dumbbell-push-pull-legs": "Three days a week, one pressing, one pulling, one lower body.",
  "dumbbell-push-pull-legs-6-day": "Push, pull and legs twice a week with dumbbells and a bench.",
  "bodyweight-workout-plan": "Three full body sessions a week, easiest versions first.",
  "two-day-bodyweight-full-body": "Two sessions a week with a floor and a sturdy table for rows.",
  "travel-bodyweight-full-body":
    "Three short sessions for hotel rooms, a chair and a table are the only equipment.",
  "bodyweight-upper-lower": "Four days a week with a pull-up bar.",
  "bodyweight-push-pull-legs": "Three days a week with a pull-up bar and dip station.",
  "calisthenics-full-body": "Pull-ups, chin-ups, dips and pike push-ups, three days a week.",
  "full-body-with-bands":
    "Seven exercises, three days a week, a press, a row, a squat and a hinge.",
  "bands-upper-lower": "Four days a week at home with bands and bodyweight.",
  "upper-lower-split": "Four days a week, each half of the body trained twice.",
  "push-pull-legs": "Three sessions on rotation, run three to six days a week.",
  "push-pull-legs-6-day":
    "The full push, pull, legs cycle twice a week with A and B versions of each day.",
  phul: "Power Hypertrophy Upper Lower. Two heavy days at 3 to 5 reps and two volume days at 8 to 12, four days a week.",
  "upper-lower-push-pull-legs":
    "Five day hybrid, heavy upper and lower days then push, pull and legs with more volume.",
  "torso-limbs":
    "Chest, back and shoulders on torso days, legs and arms on limb days, four days a week.",
  "volume-light-heavy": "The step after 5x5. Three barbell days, each with its own job.",
  "tiered-strength":
    "Four barbell days a week, each built from a heavy lift, a lighter lift and an accessory.",
  "bro-split": "One muscle group per day, high volume, each muscle once a week.",
  "arnold-split": "Chest with back, shoulders with arms, legs alone, run twice a week.",
};

/** Exercise slug to its starting-weight line. Fallback: the first sentence of
 *  beginner_notes.starting_weight_md. */
export const EXERCISE_NOTES: Readonly<Record<string, string>> = {
  "barbell-bench-press": "The empty bar, 45 lb, for 2 sets of 5.",
  "dumbbell-bench-press": "15 or 20 lb dumbbells for 2 sets of 8.",
  "incline-barbell-bench-press": "The empty bar, 45 lb, for 2 sets of 5.",
  "incline-dumbbell-press":
    "15 to 20 lb dumbbells for most untrained men, 8 to 12 lb for most untrained women, bench at 30 degrees.",
  "machine-bench-press":
    "30 to 40 lb on the stack, or the empty carriage plus one 10 lb plate if plate loaded.",
  "smith-machine-bench-press": "The bar plus one 10 lb plate per side.",
  "dumbbell-flyes": "About half of what you would press.",
  "cable-crossover": "10 to 15 lb per side.",
  butterfly: "20 to 30 lb on the stack.",
  "dips-chest-version": "Bodyweight, with as much assistance as you need.",
  "barbell-shoulder-press": "The empty bar for 2 sets of 5.",
  "standing-military-press": "The empty 45 lb bar.",
  "dumbbell-shoulder-press":
    "12 to 15 lb dumbbells for most untrained men, 5 to 8 lb for most untrained women.",
  "machine-shoulder-military-press": "20 to 30 lb on the stack, or the second plate down.",
  "side-lateral-raise": "Lighter than feels reasonable, 5 to 10 lb.",
  "machine-lateral-raise": "The lightest plate or two on the stack.",
  "face-pull": "20 to 30 lb with a rope at about eye height.",
  "cable-rear-delt-fly": "The lightest plate on each side, usually 10 to 15 lb.",
  "reverse-machine-flyes": "The lightest 2 plates on the stack, usually 15 to 25 lb.",
  "seated-bent-over-rear-delt-raise": "5 to 10 lb dumbbells.",
  "barbell-deadlift":
    "Load 45 lb plates even if that is more than you need, because they set the bar at the right height.",
  "bent-over-barbell-row": "The empty 45 lb bar.",
  "one-arm-dumbbell-row": "A 25 or 30 lb dumbbell for 3 sets of 10 per arm.",
  "seated-cable-rows": "60 to 80 lb for 3 sets of 10, then adjust.",
  "seated-machine-row": "30 to 40 lb.",
  "inverted-row": "Bodyweight, difficulty set by bar height.",
  "wide-grip-lat-pulldown": "A weight you can pull for 10 reps with the last two feeling hard.",
  "close-grip-front-lat-pulldown": "40 to 50 lb, or about a third of your bodyweight.",
  "one-arm-lat-pulldown": "20 to 30 lb, about a third of a two-arm pulldown.",
  "straight-arm-pulldown": "20 to 30 lb.",
  pullups:
    "Most beginners cannot do one yet; negatives and the assisted machine are the normal start.",
  "chin-up": "Bodyweight, underhand grip about shoulder-width.",
  "band-assisted-pull-up": "The thickest band available, usually green or black.",
  "hyperextensions-back-extensions": "Bodyweight, arms crossed over your chest.",
  "barbell-shrug": "The empty 45 lb bar, then a 25 lb plate per side.",
  "dumbbell-shrug": "20 to 25 lb in each hand.",
  "standing-dumbbell-upright-row": "10 to 15 lb dumbbells.",
  "barbell-curl": "The bar plus 5 lb per side.",
  "ez-bar-curl": "The empty EZ bar, 15 to 25 lb depending on the gym.",
  "preacher-curl": "The empty EZ bar.",
  "dumbbell-bicep-curl": "10 or 15 lb dumbbells for 2 sets of 10.",
  "hammer-curls": "15 lb dumbbells for men, 8 lb for women.",
  "alternate-hammer-curl": "10 to 15 lb dumbbells.",
  "cable-hammer-curls-rope-attachment": "20 to 30 lb on the low pulley.",
  "triceps-pushdown": "A weight you can push for 12 clean reps.",
  "triceps-pushdown-rope-attachment": "20 to 30 lb.",
  "reverse-grip-triceps-pushdown": "15 to 25 lb, lighter than a rope pushdown.",
  "close-grip-barbell-bench-press": "The empty bar, 45 lb, for 2 sets of 5.",
  "dips-triceps-version": "Bodyweight on parallel bars.",
  "parallel-bar-dip": "Bodyweight is the load.",
  "bench-dips": "Bodyweight with knees bent and feet flat.",
  "barbell-squat": "The empty bar.",
  "bodyweight-squat": "Nothing in your hands.",
  "goblet-squat": "A 20 or 25 lb dumbbell held against your chest.",
  "dumbbell-squat": "20 to 25 lb in each hand, or a single 25 lb dumbbell at your chest.",
  "hack-squat":
    "The empty sled, 60 to 100 lb depending on the machine, then a 25 lb plate per side.",
  "leg-press": "Machines vary, so ignore the number on the stack and count reps.",
  "leg-extensions": "30 to 40 lb.",
  "bulgarian-split-squat": "Bodyweight only for the first two weeks.",
  "split-squat-with-dumbbells": "Bodyweight for the first week, then 15 to 20 lb dumbbells.",
  "bodyweight-walking-lunge": "No weight for the first few sessions.",
  "romanian-deadlift": "Lighter than you expect.",
  "stiff-legged-dumbbell-deadlift": "20 to 25 lb dumbbells.",
  "sumo-deadlift": "95 lb, the bar plus a 25 lb plate per side.",
  "trap-bar-deadlift": "The empty trap bar.",
  "good-morning": "A 15 to 30 lb training bar, not the 45 lb barbell.",
  "seated-hamstring-curl": "30 to 40 lb.",
  "barbell-hip-thrust": "The empty 45 lb bar and a pad.",
  "barbell-glute-bridge": "The empty 45 lb bar.",
  "standing-calf-raises": "50 to 70 lb on the machine, about half your bodyweight.",
  "seated-calf-raise": "45 lb, one plate on the machine.",
  plank: "20 to 30 seconds on your first attempt.",
  "cable-crunch": "30 to 40 lb with a rope on the high pulley.",
  "hanging-leg-raise": "Bodyweight, knees tucked to start.",
  "flat-bench-lying-leg-raise": "No weight.",
  "russian-twist": "Bodyweight with hands clasped, feet on the floor.",
  "farmers-walk": "25 to 35 lb dumbbells in each hand for 40 yards.",
};

/** Guide slug to its line. Fallback: the guide's dek. */
export const GUIDE_NOTES: Readonly<Record<string, string>> = {
  "picking-your-starting-weight":
    "Empty bar on barbells, count reps on machines, 5 to 10 lb for small-muscle dumbbell work, and the two-reps-in-the-tank check.",
  "how-many-days-a-week-to-lift":
    "Two is enough to start, three is better if you can keep it up, with the 2026 ACSM guidelines.",
  "what-to-do-when-the-machine-is-taken": "Swap by movement pattern, and how to ask to work in.",
  "gym-etiquette-for-beginners": "The six things people care about, and what nobody notices.",
  "will-lifting-make-me-bulky":
    "Almost certainly not. Muscle comes on at about a pound a month at best.",
  "why-am-i-so-sore-after-lifting":
    "It's DOMS. Peaks 24 to 72 hours after a workout and is worst in your first two weeks.",
  "smith-machine-bar-weight": "Usually 15 to 25 lb, not 45. Find your gym's number once.",
  "what-is-an-ez-bar":
    "The bent bar for curls and triceps work, and when a straight bar or dumbbells are better.",
  "beginner-full-body-workout":
    "Two workouts alternated, four exercises each, about 45 minutes, with a plan for adding weight.",
  "progressive-overload":
    "Add reps first, then weight, for barbells, machines, dumbbells and bodyweight.",
  "squat-without-a-rack": "Goblet squats, split squats and the leg press, with starting weights.",
  "farmers-walk-at-home": "What to carry, how heavy, how far.",
  "bench-press-hurts-shoulders": "Incline dumbbells, palms in, stop above the depth that pinches.",
  "dumbbell-press-hurts-shoulders": "Bench angle, grip, depth, and how to get the weights up.",
  "leg-press-setup": "Seat, foot placement, depth, and what the sled weighs.",
};
