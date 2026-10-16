/**
 * Per-program copy for the public routine pages.
 *
 * Answer engines quote the first direct answer they find, and search results
 * reward a title that carries the term people actually type. Both of those are
 * editorial decisions, not data, so they live here rather than in the database:
 * one file to edit when a program's positioning changes, and a generic
 * fallback so a new program still ships with something sane.
 */

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

const COPY: Record<string, RoutineCopy> = {
  "full-body-3-day": {
    titleSuffix: "(3-Day Plan)",
    answer:
      "A full body routine trains every major muscle group in each session, three days a week with a rest day between. Two alternating sessions, A and B, keep the exercises varied without adding gym days. It is the best default for a true beginner because every muscle gets trained three times a week.",
    faqs: [
      {
        q: "How many days a week is a full body routine?",
        a: "Three, with a rest day between each. Monday, Wednesday and Friday is the usual layout. Two days a week still works if that is what your week allows.",
      },
      {
        q: "Is a full body workout good for beginners?",
        a: "Yes, it is the standard beginner recommendation. Each lift comes around three times a week, so technique improves quickly and you can add weight often.",
      },
      {
        q: "How long does each session take?",
        a: "About 45 to 60 minutes once you are moving between exercises without long breaks. The compound lifts need two to three minutes of rest; the smaller ones need about a minute.",
      },
      {
        q: "Why alternate an A and B day?",
        a: "It spreads the work across two squat and two press variations, so nothing gets hammered three times a week and you still cover the whole body every session.",
      },
    ],
    guides: ["progressive-overload", "beginner-full-body-workout", "picking-your-starting-weight"],
  },
  "upper-lower-split": {
    titleSuffix: "(4-Day Split)",
    answer:
      "An upper/lower split divides training into upper body and lower body days, run across four sessions a week. Each half of the body is trained twice, which gives more room per session than full body without needing six gym days.",
    faqs: [
      {
        q: "How many days a week is an upper/lower split?",
        a: "Four: two upper days and two lower days, usually Monday, Tuesday, Thursday, Friday. It also runs on three days by alternating.",
      },
      {
        q: "Is upper/lower better than full body?",
        a: "It is a step up, not an upgrade for everyone. Choose it when three full body days a week are a habit and sessions are running long.",
      },
      {
        q: "What goes in an upper day?",
        a: "A horizontal press, a vertical press, a row, a pulldown or pull-up, then arms and shoulders.",
      },
    ],
    guides: ["beginner-full-body-workout", "picking-your-starting-weight"],
  },
  "push-pull-legs": {
    titleSuffix: "(PPL Split)",
    answer:
      "Push/pull/legs splits training into pressing muscles, pulling muscles and lower body. Three sessions run on rotation, so training three to six days a week uses the same plan. You just run through the cycle more often.",
    faqs: [
      {
        q: "How many days a week is push pull legs?",
        a: "Anywhere from three to six. On three days you run the cycle once a week; on six you run it twice.",
      },
      {
        q: "Is PPL good for beginners?",
        a: "It works, but on three days a week each muscle is only trained once. A full body plan hits everything three times a week and is usually the better start.",
      },
      {
        q: "What exercises are in a pull day?",
        a: "A row, a pulldown or pull-up, a rear delt movement and biceps work. Deadlifts sit on either the pull day or the leg day.",
      },
      {
        q: "What is the difference between push and pull?",
        a: "Push days train chest, shoulders and triceps, everything that presses weight away. Pull days train back and biceps, everything that pulls weight toward you.",
      },
    ],
    guides: ["beginner-full-body-workout", "bench-press-hurts-shoulders"],
  },
  "push-pull-legs-6-day": {
    titleSuffix: "(6-Day Plan)",
    answer:
      "The six day push/pull/legs routine runs the full push, pull and legs cycle twice a week, so each muscle group is trained twice. The A and B versions of each day use different exercises, which keeps the volume high without repeating the same lifts back to back.",
    faqs: [
      {
        q: "How many days a week is 6 day PPL?",
        a: "Six, with one rest day. The usual layout is push, pull, legs, push, pull, legs, rest.",
      },
      {
        q: "Is a 6 day split too much?",
        a: "It is too much if you are new. Six sessions only pay off once three days a week is a settled habit and recovery, sleep and food are in order.",
      },
      {
        q: "Why do the A and B days use different exercises?",
        a: "So the second push day of the week is not a repeat of the first. Different press and row angles spread the work and keep joints happier.",
      },
    ],
    guides: ["beginner-full-body-workout", "bench-press-hurts-shoulders"],
  },
  "5x5-strength": {
    titleSuffix: "(Heavy Compound Plan)",
    answer:
      "A 5x5 routine is five sets of five reps on a small number of heavy compound lifts, squat, bench, row, overhead press and deadlift. Two alternating sessions run three days a week, and the goal is simply to add a little weight each time.",
    faqs: [
      {
        q: "What does 5x5 mean?",
        a: "Five sets of five repetitions on the same weight. Low reps and heavy loads, with two to five minutes of rest between sets.",
      },
      {
        q: "Is 5x5 good for beginners?",
        a: "Yes, if you are comfortable with barbell technique. There are few exercises to learn, and progress is measured in a single number: the weight on the bar.",
      },
      {
        q: "How often should I add weight?",
        a: "Every session you complete all five sets of five. Small jumps, 2.5kg on lower body lifts, 1 to 2.5kg on upper body.",
      },
    ],
    guides: ["picking-your-starting-weight", "squat-without-a-rack"],
  },
  "bro-split": {
    titleSuffix: "(One Muscle Per Day)",
    answer:
      "A bro split gives each muscle group its own day: chest, back, legs, then shoulders and arms. Volume per session is high and each muscle is trained once a week, which suits people who like long, focused gym days.",
    faqs: [
      {
        q: "How many days a week is a bro split?",
        a: "Four to five, one muscle group per session.",
      },
      {
        q: "Does a bro split work?",
        a: "Yes, people get bigger on it. Training each muscle twice a week tends to work slightly better for beginners, but a plan you enjoy and stick to beats one you skip.",
      },
      {
        q: "Who is a bro split for?",
        a: "Someone training four or more days a week who wants a lot of work on one area per session, usually with hypertrophy rather than strength as the goal.",
      },
    ],
    guides: ["gym-etiquette-for-beginners", "picking-your-starting-weight"],
  },
  "machines-only-workout": {
    titleSuffix: "(No Free Weights)",
    answer:
      "A machines only routine uses machines and cable stacks for every exercise, three days a week. The movement path is fixed, so there is far less technique to learn, which makes it a practical first month for anyone who does not yet feel at home in the free weight area.",
    faqs: [
      {
        q: "Can you build muscle with machines only?",
        a: "Yes. Muscles respond to effort and load, not to the shape of the equipment. Machines simply guide the path for you.",
      },
      {
        q: "Are machines good for beginners?",
        a: "They are a reasonable start. Less setup, less balance, and you can push close to failure safely without a spotter.",
      },
      {
        q: "When should I move to free weights?",
        a: "Once the machines feel routine, usually a month or two. Add one barbell or dumbbell lift at a time rather than switching everything at once.",
      },
    ],
    guides: ["what-to-do-when-the-machine-is-taken", "leg-press-setup"],
  },
  "dumbbell-only-workout": {
    titleSuffix: "(Home or Gym)",
    answer:
      "A dumbbell only routine needs two dumbbells and a bench, nothing else. Three full sessions a week cover the whole body, which makes it work at home and in a gym where every rack and machine is taken.",
    faqs: [
      {
        q: "Can you get a full workout with just dumbbells?",
        a: "Yes. Dumbbells cover pressing, rowing, squatting, hinging and every isolation exercise you need.",
      },
      {
        q: "What weight dumbbells do I need?",
        a: "A pair light enough for shoulder and arm work and a pair heavy enough for rows and squats. Adjustable dumbbells cover both.",
      },
      {
        q: "Can I do this at home?",
        a: "Yes. Everything here works with dumbbells and a bench, and most of it works with a sturdy chair or the floor instead.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "squat-without-a-rack"],
  },
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
  "glute-workout-plan": {
    titleSuffix: "(Hip Thrust Focus)",
    answer:
      "A glute focused routine trains three days a week, two of them built around the hips: hip thrusts twice, one hinge and one abduction movement, plus enough upper body work to stay balanced.",
    faqs: [
      {
        q: "How often should I train glutes?",
        a: "Two focused sessions a week is plenty. Glutes recover well, but they still need days off to grow.",
      },
      {
        q: "What are the best glute exercises?",
        a: "Hip thrusts, Romanian deadlifts, split squats and a cable or machine abduction movement cover the whole muscle.",
      },
      {
        q: "How long before I see results?",
        a: "Strength changes in a few weeks, visible change usually takes two to three months of consistent training.",
      },
    ],
    guides: ["picking-your-starting-weight", "squat-without-a-rack"],
  },
  "arnold-split": {
    titleSuffix: "(6-Day Bodybuilding Plan)",
    answer:
      "The Arnold split pairs chest with back, shoulders with arms, then trains legs on their own. Three sessions run twice a week. It is a high volume bodybuilding plan for people already training six days a week.",
    faqs: [
      {
        q: "How many days a week is the Arnold split?",
        a: "Six: chest and back, shoulders and arms, legs, then the same three again.",
      },
      {
        q: "Is the Arnold split good for beginners?",
        a: "No. The volume is high and the schedule is unforgiving. Start with three full body days a week.",
      },
      {
        q: "Why train chest and back together?",
        a: "Opposing muscles pair well: pressing and rowing in the same session keeps the shoulders balanced and lets you superset to save time.",
      },
    ],
    guides: ["gym-etiquette-for-beginners", "bench-press-hurts-shoulders"],
  },
  "upper-lower-beginner": {
    titleSuffix: "(4-Day Machine Plan)",
    answer:
      "An upper/lower split trains your whole upper body in one session and your whole lower body in the next, so every muscle gets worked twice a week. This version builds both sessions from machines and dumbbells you can learn in one visit. It is the step after a full body routine.",
    faqs: [
      {
        q: "How many days a week is upper/lower?",
        a: "Four, two upper days and two lower days with rest between. The same two sessions repeat, so you only have to learn six exercises for each.",
      },
      {
        q: "Is upper/lower good for beginners?",
        a: "Yes, and this version is built for it. If you have never trained before, a full body plan three days a week is still the simpler place to start.",
      },
      {
        q: "What goes in an upper body day?",
        a: "A chest press, a lat pulldown, a shoulder press and a row, then biceps and triceps at the end. Six exercises, about 45 minutes.",
      },
    ],
    guides: ["picking-your-starting-weight", "what-to-do-when-the-machine-is-taken"],
  },
  "push-pull-legs-beginner": {
    titleSuffix: "(3-Day PPL)",
    answer:
      "This beginner push/pull/legs plan runs one push day, one pull day and one leg day a week, built from machines and dumbbells with no barbell work. Five exercises a session, about 40 minutes. It is the split people ask for by name, sized for three gym days.",
    faqs: [
      {
        q: "Is PPL good for a beginner?",
        a: "It works, though each muscle only gets trained once a week on three days. A full body plan covers everything three times a week and builds technique faster.",
      },
      {
        q: "How long is each session?",
        a: "About 35 to 40 minutes. Five exercises, with two to three minutes of rest on the presses and about a minute on everything else.",
      },
      {
        q: "Can I run this more than 3 days?",
        a: "Yes, run the cycle twice for six days. Do that once you have finished three sessions a week for a month without missing any.",
      },
    ],
    guides: ["beginner-full-body-workout", "what-to-do-when-the-machine-is-taken"],
  },
  "dumbbell-upper-lower": {
    titleSuffix: "(4-Day Home Plan)",
    answer:
      "A dumbbell upper/lower split trains the upper body one session and the lower body the next, using a pair of dumbbells and a bench. Four days a week, six exercises a session, and no rack or cable stack anywhere in it. It is where to go after Dumbbell Only.",
    faqs: [
      {
        q: "Can you build muscle with dumbbells?",
        a: "Yes. Muscle responds to hard sets taken close to failure, and dumbbells get you there as well as a barbell does.",
      },
      {
        q: "What dumbbell weight do I need?",
        a: "A pair of adjustables reaching at least 50 lbs each covers a beginner's first year. Fixed pairs work if you own several weights.",
      },
      {
        q: "How do I train legs without a rack?",
        a: "Goblet squats, Bulgarian split squats, Romanian deadlifts and hip thrusts. Single leg work makes lighter dumbbells feel heavy.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "farmers-walk-at-home"],
  },
  "dumbbell-push-pull-legs": {
    titleSuffix: "(3-Day PPL at Home)",
    answer:
      "A dumbbell push/pull/legs plan splits the week into a pressing day, a pulling day and a lower body day, all done with dumbbells and a bench. It adds volume for home training, with the three sessions on rotation three or six days a week.",
    faqs: [
      {
        q: "Can you do PPL with dumbbells?",
        a: "Yes. Every press, row and squat pattern has a dumbbell version, and the split itself does not depend on the equipment.",
      },
      {
        q: "What is a dumbbell pull day?",
        a: "One arm rows, bent over rows, reverse flyes and two kinds of curls. A pull-up bar adds a vertical pull if you have one.",
      },
      {
        q: "Is this better than dumbbell full body?",
        a: "Only if you train three days a week consistently. On two days, a full body dumbbell plan covers more ground per session.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "squat-without-a-rack"],
  },
  "phul": {
    titleSuffix: "(Power Hypertrophy Plan)",
    answer:
      "PHUL stands for power hypertrophy upper lower. Two heavy days built around sets of 3 to 5 on the main lifts, and two volume days at 8 to 12 reps, four days a week. Upper and lower sessions alternate, so each muscle gets one heavy day and one volume day a week.",
    faqs: [
      {
        q: "What does PHUL stand for?",
        a: "Power hypertrophy upper lower. Two power days and two hypertrophy days, each split into an upper and a lower session.",
      },
      {
        q: "Is PHUL good for beginners?",
        a: "It is a step past beginner. Give it a few months of consistent lifting first, since the power days call for heavy sets with clean form.",
      },
      {
        q: "How heavy are the power days?",
        a: "Sets of 3 to 5 reps on the bench, row, squat and deadlift, heavy enough that the last rep is hard but still clean. Hypertrophy days sit at 8 to 12.",
      },
    ],
    guides: ["picking-your-starting-weight", "bench-press-hurts-shoulders"],
  },
  "full-body-with-bands": {
    titleSuffix: "(Resistance Band Plan)",
    answer:
      "A full body band routine trains every major muscle group in one session, done three days a week with a set of resistance bands. Seven exercises cover a press, a row, a squat and a hinge. You progress by moving to a heavier band.",
    faqs: [
      {
        q: "Can resistance bands build muscle?",
        a: "Yes, as long as you take sets close to failure. Bands get harder as they stretch, so the top of each rep is where most of the work happens.",
      },
      {
        q: "What bands do I need?",
        a: "A set of loop bands in three or four strengths, plus something overhead to anchor the pulldown to. A door anchor covers it.",
      },
      {
        q: "How do I add weight with bands?",
        a: "Move to a thicker band, add a second band, or stand further from the anchor so there is more tension at the start.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "squat-without-a-rack"],
  },
  "bands-upper-lower": {
    titleSuffix: "(4 Days at Home)",
    answer:
      "A band upper/lower split trains the upper body one day and the lower body the next, four days a week, using resistance bands and your bodyweight. Six exercises a session. Move to a heavier band when the top of the rep range feels easy.",
    faqs: [
      {
        q: "Is a band upper/lower split enough?",
        a: "For the first year or so, yes. Each muscle gets trained twice a week, and moving to a heavier band keeps the work getting harder.",
      },
      {
        q: "What do I need for this plan?",
        a: "A set of loop bands in several strengths and a door anchor for the pulldown. Pushups, split squats and planks use bodyweight.",
      },
      {
        q: "How is this different from full body bands?",
        a: "Full Body with Bands repeats one session three days a week. This plan splits the work across four days, so each session goes deeper on half the body.",
      },
    ],
    guides: ["squat-without-a-rack", "picking-your-starting-weight"],
  },
  "calisthenics-full-body": {
    titleSuffix: "(3-Day Bodyweight Plan)",
    answer:
      "A calisthenics full body plan trains every major muscle group three days a week with only your bodyweight. Pullups, chin-ups, dips and pike pushups do the heavy work. You need a pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs.",
    faqs: [
      {
        q: "Can calisthenics build muscle?",
        a: "Yes, if the sets are hard. Once you pass the top of a rep range, move to a harder version of the movement or lower it more slowly.",
      },
      {
        q: "What if I can't do a pullup yet?",
        a: "Start with inverted rows and slow negatives, jumping to the top and lowering for 3 to 5 seconds. Bodyweight Only is the easier starting plan.",
      },
      {
        q: "How is this different from Bodyweight Only?",
        a: "Bodyweight Only needs no equipment and starts with the easiest versions. This plan adds a pull-up bar and dips, so it suits someone past the basics.",
      },
    ],
    guides: ["progressive-overload", "beginner-full-body-workout", "squat-without-a-rack"],
  },
  "dumbbell-full-body": {
    titleSuffix: "(3-Day A/B Plan)",
    answer:
      "A dumbbell full body plan trains every major muscle group in each session, with two workouts alternated across three days a week. Six exercises a session, using a pair of dumbbells and a bench. It is heavier and longer than Dumbbell Only.",
    faqs: [
      {
        q: "Is full body better than a split?",
        a: "At three days a week, usually. Each muscle gets trained every session, which beats hitting it once a week on a split.",
      },
      {
        q: "How do I alternate A and B?",
        a: "Run A, B, A in week one and B, A, B in week two. Keep going in that order, whatever days you train.",
      },
      {
        q: "When should I move to this plan?",
        a: "After a few months of Dumbbell Only, once your sessions feel short and you are adding weight less often.",
      },
    ],
    guides: ["progressive-overload", "dumbbell-press-hurts-shoulders", "farmers-walk-at-home"],
  },
  "dumbbell-push-pull-legs-6-day": {
    titleSuffix: "(6-Day Home Plan)",
    answer:
      "This plan runs push, pull and legs twice a week using only dumbbells and a bench, so every muscle gets trained twice. Four to six exercises a session. The second time through each day uses a different set of exercises.",
    faqs: [
      {
        q: "Is 6 days a week too much?",
        a: "For most beginners, yes. Start with the 3 day Dumbbell PPL and move up once three sessions a week is a habit.",
      },
      {
        q: "Why do the A and B days differ?",
        a: "Different angles and rep ranges work the same muscles in new ways, and the week feels less repetitive. Push B starts with incline presses, for example.",
      },
      {
        q: "Can I run this with adjustable dumbbells?",
        a: "Yes. Adjustables reaching at least 50 lbs a hand cover most of it. Leg days outgrow them first, which is why split squats and step ups are in there.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "squat-without-a-rack"],
  },
  "tiered-strength": {
    titleSuffix: "(4-Day Barbell Plan)",
    answer:
      "Tiered Strength runs four barbell days a week, each built from three tiers. A heavy lift for 5 sets of 3, a lighter lift for 3 sets of 10, and an accessory for 3 sets of 15. On the heavy lift, push the last set for as many reps as you can.",
    faqs: [
      {
        q: "What are the three tiers?",
        a: "Tier 1 is a heavy main lift, tier 2 is a lighter main lift for more reps, and tier 3 is an accessory like a pulldown or row.",
      },
      {
        q: "What is an AMRAP set?",
        a: "As many reps as possible. On the last heavy set, keep going while form holds. The count tells you when to add weight.",
      },
      {
        q: "Is this plan good for beginners?",
        a: "It suits someone with a few months of barbell work. The heavy triples need a squat, bench, deadlift and press you already do well.",
      },
    ],
    guides: ["picking-your-starting-weight", "bench-press-hurts-shoulders"],
  },
  "torso-limbs": {
    titleSuffix: "(4-Day Split)",
    answer:
      "A torso/limbs split trains chest, back and shoulders on torso days, and legs and arms together on limb days, four days a week. Moving arms to leg day keeps the torso days short and heavy. Alternate the A and B versions each week.",
    faqs: [
      {
        q: "Why put arms on leg day?",
        a: "Arms already get work from presses and rows. Moving curls and extensions to leg day keeps torso sessions to five exercises.",
      },
      {
        q: "How is this different from upper/lower?",
        a: "Upper/lower puts arms with the upper body. Here they move to the lower day, so both sessions end up closer in length.",
      },
      {
        q: "Who is torso/limbs for?",
        a: "Lifters with a few months of training who want four days a week and prefer shorter upper body sessions built around heavy presses and rows.",
      },
    ],
    guides: ["bench-press-hurts-shoulders", "leg-press-setup"],
  },
  "two-day-dumbbell-full-body": {
    titleSuffix: "(Home Plan for Beginners)",
    answer:
      "A two day dumbbell full body plan covers every major muscle group in two workouts a week, using a pair of dumbbells and a bench. Five or six exercises a session. It is a good start at home if your schedule is tight.",
    faqs: [
      {
        q: "Is two days a week enough?",
        a: "For a beginner, yes. Two full body sessions train each muscle twice a week, which is enough to keep getting stronger for months.",
      },
      {
        q: "What dumbbells do I need?",
        a: "A pair of adjustables reaching at least 40 lbs each covers the first several months. Fixed pairs work if you own a few weights.",
      },
      {
        q: "When should I add a third day?",
        a: "Once two sessions a week feel easy to keep up. Dumbbell Only runs three days a week with the same equipment.",
      },
    ],
    guides: ["dumbbell-press-hurts-shoulders", "farmers-walk-at-home"],
  },
  "two-day-full-body": {
    titleSuffix: "(Beginner Gym Plan)",
    answer:
      "A two day full body plan trains every major muscle group in each of two gym sessions a week, built around the squat, bench, deadlift and press. Five or six exercises a session. It is for weeks when you can only get to the gym twice.",
    faqs: [
      {
        q: "Can you build muscle training twice a week?",
        a: "Yes. Two full body sessions work each muscle twice a week. Progress is slower than three days, but it keeps going as long as you add weight.",
      },
      {
        q: "Is this or Full Body 3x a week better?",
        a: "Three days builds strength faster. Pick this plan when two days is what you can keep up, since showing up every week matters more.",
      },
      {
        q: "What if the squat rack is taken?",
        a: "Swap to the leg press or goblet squats for that session and come back to the barbell next time.",
      },
    ],
    guides: ["what-to-do-when-the-machine-is-taken", "beginner-full-body-workout"],
  },
  "upper-lower-push-pull-legs": {
    titleSuffix: "(5-Day Hybrid Split)",
    answer:
      "This hybrid split runs five days a week, starting with a heavier upper day and lower day, then push, pull and legs with more volume. Every muscle gets trained twice a week, with heavy work early in the week and higher reps later.",
    faqs: [
      {
        q: "What is a ULPPL split?",
        a: "Upper, lower, push, pull, legs. Five sessions a week, where the first two lean heavy and the last three add volume.",
      },
      {
        q: "Is 5 days a week too much?",
        a: "It is a lot for a beginner. Start on Upper / Lower at four days, then add the fifth once that schedule sticks.",
      },
      {
        q: "Which rest days work best?",
        a: "Train upper and lower, rest a day, then run push, pull and legs and rest again. That fits five sessions into seven days.",
      },
    ],
    guides: ["bench-press-hurts-shoulders", "leg-press-setup"],
  },
  "volume-light-heavy": {
    titleSuffix: "(The Step After 5x5)",
    answer:
      "Volume, Light, Heavy is a three day barbell plan where each day has its own job. The first day is 5 sets of 5 at a moderate weight, the middle day is light, and the last day is one heavy set of 5 to beat last week.",
    faqs: [
      {
        q: "Is this the Texas Method?",
        a: "It follows the same volume, light and heavy structure. Squat and bench run through the week, with the deadlift, press and power clean spread across it.",
      },
      {
        q: "When should I switch from 5x5?",
        a: "When you stall at the same weight for a few sessions in a row, even after resting well and eating enough.",
      },
      {
        q: "Why is the middle day so light?",
        a: "It lets you recover from the volume day while still practicing the lifts, so you show up fresh for the heavy set of 5.",
      },
    ],
    guides: ["picking-your-starting-weight", "bench-press-hurts-shoulders"],
  },
};

const FALLBACK_GUIDES = ["beginner-full-body-workout", "picking-your-starting-weight"];

/** The authored answer paragraph, or null when the program has no copy. */
export function routineAnswer(slug: string): string | null {
  return COPY[slug]?.answer ?? null;
}

export function routineCopy(
  slug: string,
  program: string,
  dayCount: number,
  blurb: string | null,
): RoutineCopy {
  const found = COPY[slug];
  if (found) return found;
  const dayWord = `${dayCount} day${dayCount === 1 ? "" : "s"}`;
  return {
    titleSuffix: `(${dayCount}-Day Plan)`,
    answer:
      blurb ??
      `${program} is a free ${dayWord} workout routine with every exercise listed, in order, ready to follow in the gym.`,
    faqs: [
      {
        q: `How many days a week is ${program}?`,
        a: `${program} runs over ${dayWord}, and every session is listed on this page.`,
      },
      {
        q: `Is ${program} free?`,
        a: "Yes. The full routine is on this page, and a free LiftCamp account loads it into the app so your weights carry between sessions.",
      },
    ],
    guides: FALLBACK_GUIDES,
  };
}
