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

export type RoutineLink = { label: string; href: string };

/** One H2 block of a guide-length routine page, in render order: body
 *  paragraphs, then the table, then the after paragraphs, then the links. */
export type RoutineSection = {
  /** The H2's anchor. "schedule" is where the day cards go. */
  id: string;
  heading: string;
  body: string[];
  table?: { columns: string[]; rows: string[][] };
  after?: string[];
  links?: RoutineLink[];
};

export type RoutineCopy = {
  /** Search-facing headline modifier, e.g. "(6-Day Plan)". */
  titleSuffix: string;
  /** Two or three sentences, plain, at the very top of the page. */
  answer: string;
  faqs: RoutineFaq[];
  /** Guide-length pages only. Copy from docs/routine-guides.json, verbatim;
   *  routine-copy.test.ts compares the two. */
  sections?: RoutineSection[];
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
      "An upper lower split divides training into upper body days and lower body days, four sessions a week. Each half of the body is trained twice, which leaves more room per session than full body without needing six gym days.",
    faqs: [
      {
        q: "How many days a week is an upper lower split?",
        a: "Four, two upper days and two lower days, usually Monday, Tuesday, Thursday and Friday. It also works on three days if you alternate the sessions.",
      },
      {
        q: "Is upper lower better than full body?",
        a: "It's a step up, and it isn't the right choice for everyone. Switch when three full body days a week are a habit and your sessions are running long.",
      },
      {
        q: "Is an upper lower split good for building muscle?",
        a: "Yes. Training each muscle twice a week with 3 sets per exercise is enough for steady muscle growth, and the four day schedule leaves plenty of room to recover.",
      },
      {
        q: "What goes in an upper day?",
        a: "A chest press, a row, a shoulder press and a pulldown, then biceps and triceps. That covers pushing and pulling in both directions.",
      },
      {
        q: "Can I do an upper lower split 5 days a week?",
        a: "Yes, by running the sessions in order and letting the week roll over. Upper, Lower, Upper, Lower, Upper one week, then start with Lower the next.",
      },
    ],
    sections: [
      {
        id: "who-its-for",
        heading: "Who the upper lower split is for",
        body: [
          "It's a good next step once three full body days a week have become a habit and those sessions are starting to run long. Four days a week is a common schedule, and twice a week per muscle is enough for steady progress.",
          "If you're brand new, start with full body. LiftCamp also has a beginner version of this split with simpler exercises.",
        ],
        links: [
          {
            label: "Full Body 3-Day",
            href: "/routines/full-body-3-day",
          },
          {
            label: "Upper / Lower for Beginners",
            href: "/routines/upper-lower-beginner",
          },
        ],
      },
      {
        id: "schedule",
        heading: "Weekly schedule",
        body: [
          "Most people train Monday, Tuesday, Thursday and Friday, which puts a rest day in the middle of the week and two at the end.",
        ],
        table: {
          columns: ["Day", "Session"],
          rows: [
            ["Monday", "Upper"],
            ["Tuesday", "Lower"],
            ["Wednesday", "Rest"],
            ["Thursday", "Upper"],
            ["Friday", "Lower"],
            ["Saturday", "Rest"],
            ["Sunday", "Rest"],
          ],
        },
        after: [
          "On three days a week, alternate the sessions, Upper, Lower, Upper one week and Lower, Upper, Lower the next.",
        ],
      },
      {
        id: "sets-and-reps",
        heading: "Sets, reps and rest",
        body: [
          "Every exercise is 3 sets. The bench press, rows, shoulder press, pulldowns, squats, Romanian deadlifts and leg press are 8 to 10 reps, and curls, pushdowns and leg curls are 10 to 12. Calf raises go up to 15 and the plank is a 30 second hold.",
          "Each session is 18 sets. Rest 2 to 3 minutes after the big lifts and 60 to 90 seconds after the smaller ones, which puts most sessions at 60 to 70 minutes.",
        ],
      },
      {
        id: "progression",
        heading: "How to progress",
        body: [
          "Use double progression. Pick a weight you can lift for the bottom of the rep range on every set. When you hit the top of the range on all 3 sets, add weight next session, 5 lb on upper body lifts and 10 lb on squats, Romanian deadlifts and the leg press.",
          "You'll do each session twice a week. If the second session of the week feels heavier than the first, keep the same weight for both and add weight only after both sessions hit the top of the range.",
        ],
      },
      {
        id: "adjusting",
        heading: "Variations",
        body: [
          "If you train at home or the barbells are always taken, the dumbbell version keeps the same structure. Once four days feels easy and you want more volume, push pull legs on six days is a common next step.",
        ],
        links: [
          {
            label: "Dumbbell Upper / Lower",
            href: "/routines/dumbbell-upper-lower",
          },
          {
            label: "Push / Pull / Legs 6-Day",
            href: "/routines/push-pull-legs-6-day",
          },
        ],
      },
    ],
    guides: ["beginner-full-body-workout", "picking-your-starting-weight"],
  },
  "push-pull-legs": {
    titleSuffix: "(PPL Split)",
    answer:
      "Push pull legs splits training into pressing muscles, pulling muscles and lower body. The three sessions run in rotation, so the same routine works on three days a week or six. You just run the cycle more often.",
    faqs: [
      {
        q: "How many days a week is push pull legs?",
        a: "Anywhere from three to six. On three days you run the cycle once a week, and on six you run it twice.",
      },
      {
        q: "Is push pull legs good for beginners?",
        a: "It works, but on three days a week each muscle is only trained once. A full body routine hits everything three times a week and is usually the better start for your first few months.",
      },
      {
        q: "What muscles does each day train?",
        a: "Push days train your chest, shoulders and triceps. Pull days train your back, rear shoulders and biceps. Leg days train your quads, hamstrings, glutes and calves.",
      },
      {
        q: "Is a 6 day push pull legs too much?",
        a: "Not if you can recover and get to the gym six days in a row. Each session is short, about 15 sets. If you're sore going into every session or your lifts keep dropping, go back to three or four days.",
      },
      {
        q: "Where do deadlifts go in push pull legs?",
        a: "On the pull day or the leg day. This routine puts the Romanian deadlift on leg day, so pull day can focus on rows and pulldowns.",
      },
    ],
    sections: [
      {
        id: "who-its-for",
        heading: "Who push pull legs is for",
        body: [
          "It suits lifters who have a few months of training behind them and want a routine that can grow with their schedule. Three days a week is a good place to start, and you can move to six without learning a new routine.",
          "If you're brand new, a full body routine trains every muscle three times a week, which builds strength faster in the first few months. LiftCamp's beginner version of push pull legs uses lighter, simpler exercises if you want this structure from day one.",
        ],
        links: [
          {
            label: "Full Body 3-Day",
            href: "/routines/full-body-3-day",
          },
          {
            label: "Push / Pull / Legs for Beginners",
            href: "/routines/push-pull-legs-beginner",
          },
        ],
      },
      {
        id: "schedule",
        heading: "Weekly schedule",
        body: [
          "On three days, run the cycle once with a rest day between sessions. On six days, run it twice and rest on the seventh.",
        ],
        table: {
          columns: ["Day", "3 days a week", "6 days a week"],
          rows: [
            ["Monday", "Push", "Push"],
            ["Tuesday", "Rest", "Pull"],
            ["Wednesday", "Pull", "Legs"],
            ["Thursday", "Rest", "Push"],
            ["Friday", "Legs", "Pull"],
            ["Saturday", "Rest", "Legs"],
            ["Sunday", "Rest", "Rest"],
          ],
        },
        after: [
          "Four or five days works too. Keep running Push, Pull, Legs in order on whatever days you train, and let the cycle roll across weeks.",
        ],
      },
      {
        id: "sets-and-reps",
        heading: "Sets, reps and rest",
        body: [
          "Every exercise is 3 sets. The bench press, military press, rows, pulldowns and squats are 8 to 10 reps, and the smaller exercises like lateral raises, curls and pushdowns are 10 to 12. Calf raises go up to 15.",
          "Each session is 15 sets. Rest 2 to 3 minutes after the big lifts and 60 to 90 seconds after the smaller ones, which puts most sessions at 50 to 60 minutes.",
        ],
      },
      {
        id: "progression",
        heading: "How to progress",
        body: [
          "Use double progression. Pick a weight you can lift for the bottom of the rep range on every set. When you hit the top of the range on all 3 sets, add weight next session, 5 lb on upper body lifts and 10 lb on squats and Romanian deadlifts.",
          "On three days a week, each lift comes around once a week, so progress is steady and slower. Moving to six days doubles how often you practice each lift, and that's usually when progress picks up.",
        ],
      },
      {
        id: "adjusting",
        heading: "Variations",
        body: [
          "The same structure works with whatever equipment you have. LiftCamp has a dumbbell-only version, a six day version with different exercises on the second round, and a hybrid that mixes upper and lower days with push pull legs.",
        ],
        links: [
          {
            label: "Push / Pull / Legs 6-Day",
            href: "/routines/push-pull-legs-6-day",
          },
          {
            label: "Dumbbell Push / Pull / Legs",
            href: "/routines/dumbbell-push-pull-legs",
          },
          {
            label: "Upper / Lower + Push / Pull / Legs",
            href: "/routines/upper-lower-push-pull-legs",
          },
        ],
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
      "The Arnold split pairs chest with back, shoulders with arms, then trains legs on their own. The three sessions run twice a week, so every muscle is trained twice across six days. It's a high volume bodybuilding plan for lifters who already train most days of the week.",
    faqs: [
      {
        q: "How many days a week is the Arnold split?",
        a: "Six. Chest and back, shoulders and arms, legs, then the same three again, with one rest day.",
      },
      {
        q: "Is the Arnold split good for beginners?",
        a: "Not usually. The volume is high and the schedule leaves little room for missed days. Start with three full body days a week and come back to it after six months or so.",
      },
      {
        q: "Why train chest and back together?",
        a: "Pressing and rowing work opposite sides of your upper body, so one recovers while the other works. You can pair them back to back to shorten the session.",
      },
      {
        q: "Is the Arnold split better than push pull legs?",
        a: "Neither is better for everyone. The Arnold split gives your arms and shoulders a day of their own, while push pull legs runs on anywhere from three to six days, so it fits more schedules.",
      },
      {
        q: "How long is an Arnold split workout?",
        a: "About 60 to 75 minutes. The shoulders and arms day is the longest because it has the most exercises.",
      },
    ],
    sections: [
      {
        id: "who-its-for",
        heading: "Who the Arnold split is for",
        body: [
          "It suits lifters with at least six months of steady training who want more volume for their chest, back and arms, and who can reliably get to the gym six days a week.",
          "If you're newer than that, a three day full body routine will build more strength in the same time. If six days isn't realistic, push pull legs covers the same muscles on three days a week.",
        ],
        links: [
          {
            label: "Full Body 3-Day",
            href: "/routines/full-body-3-day",
          },
          {
            label: "Push / Pull / Legs",
            href: "/routines/push-pull-legs",
          },
        ],
      },
      {
        id: "schedule",
        heading: "Weekly schedule",
        body: [
          "Run the three days in order, twice, then rest. Most people take Sunday off.",
        ],
        table: {
          columns: ["Day", "Session"],
          rows: [
            ["Monday", "Chest and back"],
            ["Tuesday", "Shoulders and arms"],
            ["Wednesday", "Legs"],
            ["Thursday", "Chest and back"],
            ["Friday", "Shoulders and arms"],
            ["Saturday", "Legs"],
            ["Sunday", "Rest"],
          ],
        },
        after: [
          "If you miss a day, pick up where you left off. Restarting the week every time you miss one means legs get skipped.",
        ],
      },
      {
        id: "sets-and-reps",
        heading: "Sets, reps and rest",
        body: [
          "Every exercise is 3 sets. The presses, rows, pulldowns and squats are 8 to 10 reps, and the smaller exercises like flyes, raises and curls are 10 to 12. Calf raises go up to 15.",
          "Rest 2 to 3 minutes after the big lifts and 60 to 90 seconds after the smaller ones. Sessions run about 60 to 75 minutes, with shoulders and arms the longest at 21 sets.",
        ],
      },
      {
        id: "progression",
        heading: "How to progress",
        body: [
          "Use double progression. Pick a weight you can lift for the bottom of the rep range on every set. When you hit the top of the range on all 3 sets, add weight next session, 5 lb on upper body lifts and 10 lb on squats and the leg press.",
          "With each muscle trained twice a week, expect to add weight every week or two on the big lifts and less often on arms and shoulders. If a lift stalls for three sessions in a row, drop the weight by about 10% and build back up.",
        ],
      },
      {
        id: "adjusting",
        heading: "Making it fit your week",
        body: [
          "On five days, run the six sessions straight through and let the week roll over. You'll train each muscle a little under twice a week, which still works.",
          "On four days or fewer, the split stops making sense, because some muscles only get trained once a week. Switch to an upper and lower split or push pull legs instead.",
        ],
        links: [
          {
            label: "Upper / Lower",
            href: "/routines/upper-lower-split",
          },
          {
            label: "Push / Pull / Legs 6-Day",
            href: "/routines/push-pull-legs-6-day",
          },
        ],
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
  "two-day-bodyweight-full-body": {
    titleSuffix: "(No Equipment, 2 Days)",
    answer:
      "Two full body sessions a week with nothing but a floor and a sturdy table for rows. Each day has a push, a row, a squat pattern, a hip hinge and core work, so two sessions still cover everything twice.",
    faqs: [
      {
        q: "Is two days a week enough to make progress?",
        a: "Yes for a beginner. Two full body sessions a week build strength and muscle for the first few months. Add a third day once two feel easy and you want more.",
      },
      {
        q: "What do I use for the rows?",
        a: "A sturdy dining table, a low railing or a bar at a playground. Lie underneath, grip the edge and pull your chest to it. Bend your knees to make it easier.",
      },
      {
        q: "How do I make it harder without weights?",
        a: "Move to the harder version first, then add reps. Knee push-ups become full push-ups, two-leg bridges become single-leg, and rows get harder with straighter legs.",
      },
    ],
    guides: ["beginner-full-body-workout", "squat-without-a-rack"],
  },
  "bodyweight-upper-lower": {
    titleSuffix: "(Pull-Up Bar, 4 Days)",
    answer:
      "Four days a week, alternating upper and lower, using your bodyweight and a pull-up bar. Upper days use chin-ups, pull-ups, dips and rows alongside push-up variations. Lower days need only the floor.",
    faqs: [
      {
        q: "What equipment do I need?",
        a: "A pull-up bar and somewhere to do dips, like parallel bars or two sturdy chairs. A doorway bar covers the pulling. Lower days need nothing.",
      },
      {
        q: "I can't do a chin-up yet. Can I still run this?",
        a: "Yes. Swap chin-ups and pull-ups for inverted rows or band-assisted pull-ups until you can do five clean reps, then switch back.",
      },
      {
        q: "Why four days instead of three?",
        a: "Splitting upper and lower lets each session go deeper on fewer movements while still training everything twice a week. If four days is too many, the three-day Bodyweight Only routine covers the same ground.",
      },
    ],
    guides: ["beginner-full-body-workout", "squat-without-a-rack"],
  },
  "bodyweight-push-pull-legs": {
    titleSuffix: "(Calisthenics, 3 Days)",
    answer:
      "A push, pull and legs split built entirely on bodyweight movements. You need a pull-up bar and a dip station or parallel bars. Pull day is built around pull-ups and chin-ups, so it suits lifters who can already do five.",
    faqs: [
      {
        q: "Who is this for?",
        a: "Lifters past the first few months who want a bodyweight split rather than full body days. If you are new, start with Bodyweight Only, then Calisthenics Full Body.",
      },
      {
        q: "What equipment do I need?",
        a: "A pull-up bar for pull day and a dip station or parallel bars for push day. Legs day needs only the floor.",
      },
      {
        q: "How do I keep progressing once reps are high?",
        a: "Add a set first, then add load. A backpack with books or a weight belt turns pull-ups and dips into weighted versions, and LiftCamp tracks the added weight on top of bodyweight.",
      },
    ],
    guides: ["beginner-full-body-workout"],
  },
  "travel-bodyweight-full-body": {
    titleSuffix: "(Hotel Room)",
    answer:
      "Three short full body sessions built for hotel rooms and small spaces. A chair and a sturdy table are the only equipment.",
    faqs: [
      {
        q: "What do I use the chair for?",
        a: "Incline push-ups, bench dips, step-ups and single-leg box squats. Any solid chair or the edge of a bed frame works. Use the desk or table for rows.",
      },
      {
        q: "Can I run this at home, not just travelling?",
        a: "Yes. It is a complete beginner routine. It is shorter than Bodyweight Only, so switch to that when you have more time.",
      },
      {
        q: "How do I keep it short?",
        a: "Rest 60 seconds between sets and move straight to the next exercise. Five exercises at three sets each is a short session at that pace.",
      },
    ],
    guides: ["beginner-full-body-workout", "squat-without-a-rack"],
  },
};

/** Programs whose page carries guide sections. */
export function routineGuideSlugs(): string[] {
  return Object.keys(COPY).filter((slug) => COPY[slug]!.sections?.length);
}

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
