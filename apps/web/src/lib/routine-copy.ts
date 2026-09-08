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
    guides: ["beginner-full-body-workout", "picking-your-starting-weight"],
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
      "Push/pull/legs splits training into pressing muscles, pulling muscles and lower body. Three sessions run on rotation, so training three to six days a week uses the same plan — you just run through the cycle more often.",
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
        a: "Push days train chest, shoulders and triceps — everything that presses weight away. Pull days train back and biceps — everything that pulls weight toward you.",
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
      "A 5x5 routine is five sets of five reps on a small number of heavy compound lifts — squat, bench, row, overhead press and deadlift. Two alternating sessions run three days a week, and the goal is simply to add a little weight each time.",
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
        a: "Every session you complete all five sets of five. Small jumps — 2.5kg on lower body lifts, 1 to 2.5kg on upper body.",
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
        a: "Once the machines feel routine — usually a month or two. Add one barbell or dumbbell lift at a time rather than switching everything at once.",
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
      "The Arnold split pairs chest with back, shoulders with arms, then trains legs on their own — three sessions run twice a week. It is a high volume bodybuilding plan for people already training six days a week.",
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
};

const FALLBACK_GUIDES = ["beginner-full-body-workout", "picking-your-starting-weight"];

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
