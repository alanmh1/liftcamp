// The six /exercises/<base>/alternatives pages. Copy from
// docs/exercise-alternatives.json, used verbatim: edit the JSON first, then
// bring this file in line (exercise-alternatives.test.ts compares the two).
//
// Every base and swap slug must exist in the catalog and have a
// beginner_notes row. alternativesProblems() is the rule; the unit test runs
// it on fixtures, and scripts/check-exercise-alternatives.ts runs it against
// the live catalog.

export type AlternativeItem = {
  /** exercises.slug of the swap. */
  slug: string;
  /** One line under the card title. */
  why: string;
};

export type AlternativeGroup = { heading: string; items: readonly AlternativeItem[] };

export type AlternativesFaq = { q: string; a: string };

export type AlternativesPage = {
  /** exercises.slug of the lift being replaced. The page lives at
   *  /exercises/<base>/alternatives. */
  base: string;
  /** The query the page targets. Not rendered. */
  keyword: string;
  /** Title tag before the " | LiftCamp" suffix. */
  title: string;
  description: string;
  h1: string;
  lead: string;
  groups: readonly AlternativeGroup[];
  how_to_pick: string;
  faq: readonly AlternativesFaq[];
};

export const ALTERNATIVES_PAGES: readonly AlternativesPage[] = [
  {
    base: "leg-press",
    keyword: "leg press alternative",
    title: "Leg Press Alternatives for the Gym and at Home",
    description:
      "The leg press is busy or your gym doesn't have one. These swaps train the same quads and glutes with a machine, dumbbells or just your bodyweight.",
    h1: "Leg press alternatives",
    lead: "The hack squat is the closest swap for the leg press, since it loads your quads heavily with your back supported and nothing to balance. If the machines are all taken, a goblet squat with one dumbbell trains the same muscles, and bodyweight squats work at home.",
    groups: [
      {
        heading: "On a machine",
        items: [
          {
            slug: "hack-squat",
            why: "Closest match. Your back is supported, the path is fixed and your quads do most of the work.",
          },
          {
            slug: "pendulum-squat",
            why: "Goes deeper than a leg press with your back on a pad, so your quads work through more range.",
          },
          {
            slug: "smith-machine-squat",
            why: "A fixed bar path takes the balance out of squatting. Put your feet slightly forward to keep the load on your legs.",
          },
          {
            slug: "leg-extensions",
            why: "Trains only your quads, so pair it with a hinge or glute exercise to cover what the leg press does.",
          },
        ],
      },
      {
        heading: "With dumbbells or a barbell",
        items: [
          {
            slug: "goblet-squat",
            why: "The easiest free-weight swap. One dumbbell held at your chest and no rack to set up.",
          },
          {
            slug: "bulgarian-split-squat",
            why: "Works one leg at a time with your back foot on a bench. Light dumbbells feel heavy here.",
          },
          {
            slug: "dumbbell-squat",
            why: "Dumbbells at your sides let you load more than a goblet squat once your grip can hold them.",
          },
          {
            slug: "barbell-squat",
            why: "The heaviest option once you're ready to learn it. Start with the empty bar.",
          },
          {
            slug: "dumbbell-step-ups",
            why: "Each leg lifts your whole body onto a box, much like pushing a platform away.",
          },
        ],
      },
      {
        heading: "At home",
        items: [
          {
            slug: "bodyweight-squat",
            why: "Three sets of 10 to 15 is a real starting point if you've never trained legs.",
          },
          {
            slug: "wall-sit",
            why: "Holds the bottom of the leg press position against a wall. No equipment at all.",
          },
          {
            slug: "squats-with-bands",
            why: "A band under your feet adds load that gets heavier as you stand, like the top of a leg press.",
          },
          {
            slug: "bodyweight-walking-lunge",
            why: "Trains each leg on its own and needs only a hallway.",
          },
        ],
      },
    ],
    how_to_pick:
      "Pick by what's free. If another machine is open, the hack squat or pendulum squat keeps the workout closest to what you planned. With only dumbbells, use the goblet squat or Bulgarian split squat. Keep the same sets and roughly the same reps, and choose a weight where the last two reps are hard.",
    faq: [
      {
        q: "What is the best alternative to the leg press?",
        a: "The hack squat is the closest, since both load your quads with your back supported. Without machines, the goblet squat is the easiest free-weight swap.",
      },
      {
        q: "Can I replace the leg press with squats?",
        a: "Yes. Squats train the same quads and glutes and also make your core and back work to hold the position. Expect to use much less weight than on the leg press.",
      },
    ],
  },
  {
    base: "barbell-hip-thrust",
    keyword: "hip thrust alternative",
    title: "Hip Thrust Alternatives for the Gym and at Home",
    description:
      "No bench free, no barbell, or the setup is a hassle. These hip thrust swaps train the same glutes with a machine, dumbbells or bodyweight.",
    h1: "Hip thrust alternatives",
    lead: "A barbell glute bridge is the closest hip thrust alternative, since it's the same movement with your back on the floor instead of a bench. If the barbell setup is what slows you down, the hip thrust machine is the easiest swap in the gym.",
    groups: [
      {
        heading: "On a machine",
        items: [
          {
            slug: "hip-thrust-machine",
            why: "Same movement with a belt instead of a barbell, so setup takes seconds.",
          },
          {
            slug: "smith-machine-hip-thrust",
            why: "The bar stays on a fixed track, which makes heavy sets easier to set up and rack.",
          },
        ],
      },
      {
        heading: "With dumbbells, a barbell or a kettlebell",
        items: [
          {
            slug: "barbell-glute-bridge",
            why: "Closest match. The same hip drive with your upper back on the floor, so no bench is needed.",
          },
          {
            slug: "dumbbell-hip-thrust",
            why: "One dumbbell across your hips works until about 60 lb, when it gets awkward to balance.",
          },
          {
            slug: "romanian-deadlift",
            why: "Trains your glutes and hamstrings through a hinge instead of a thrust. Worth having in your week anyway.",
          },
          {
            slug: "bulgarian-split-squat",
            why: "Loads one glute at a time, especially if you lean slightly forward.",
          },
          {
            slug: "kettlebell-swing",
            why: "The same hip snap done fast. Good glute work when you only have one kettlebell.",
          },
        ],
      },
      {
        heading: "At home",
        items: [
          {
            slug: "single-leg-glute-bridge",
            why: "Doubles the load on each side with no equipment.",
          },
          {
            slug: "butt-lift-bridge",
            why: "The two-leg glute bridge on the floor. Start here if hip thrusts are new to you.",
          },
          {
            slug: "glute-kickback",
            why: "Works one glute at a time on your hands and knees.",
          },
        ],
      },
    ],
    how_to_pick:
      "If the bench and bar setup is the problem, use the machine. If the barbells are all taken, a dumbbell hip thrust or barbell glute bridge keeps the same movement. Match your planned sets and reps, and pause for a second at the top of every rep either way.",
    faq: [
      {
        q: "Is a glute bridge as good as a hip thrust?",
        a: "It trains the same muscles through a shorter range of motion. Most people can load a glute bridge almost as heavily, which makes it a solid swap.",
      },
      {
        q: "What can I do instead of hip thrusts at home?",
        a: "Single-leg glute bridges are the best no-equipment option. Rest a dumbbell or a loaded backpack across your hips when they get easy.",
      },
    ],
  },
  {
    base: "barbell-deadlift",
    keyword: "deadlift alternative",
    title: "Deadlift Alternatives for Beginners, Gym and Home",
    description:
      "Not ready for barbell deadlifts, or the platform is taken. These swaps train the same hips, hamstrings and back with a trap bar, dumbbells or bands.",
    h1: "Deadlift alternatives",
    lead: "The trap bar deadlift is the closest deadlift alternative, and many beginners find it easier to learn because you stand inside the bar. If you'd rather not pull from the floor, the Romanian deadlift trains the same hinge starting from standing.",
    groups: [
      {
        heading: "With a barbell or trap bar",
        items: [
          {
            slug: "trap-bar-deadlift",
            why: "Closest match. You stand inside the bar with the handles at your sides, which keeps your back more upright.",
          },
          {
            slug: "romanian-deadlift",
            why: "Starts from standing and lowers to about mid-shin, so the focus is your hamstrings and glutes.",
          },
          {
            slug: "sumo-deadlift",
            why: "A wide stance with your hands inside your knees. Shorter range and more upright than a regular deadlift.",
          },
          {
            slug: "good-morning",
            why: "The bar sits on your back while you hinge. Start light, since it's harder than it looks.",
          },
        ],
      },
      {
        heading: "With dumbbells or a machine",
        items: [
          {
            slug: "dumbbell-romanian-deadlift",
            why: "The same hinge with a dumbbell in each hand. A good way to learn the movement.",
          },
          {
            slug: "stiff-legged-dumbbell-deadlift",
            why: "Your knees stay nearly straight, so your hamstrings work harder.",
          },
          {
            slug: "smith-machine-romanian-deadlift",
            why: "A fixed bar path lets you focus on the hinge without balancing a bar.",
          },
          {
            slug: "single-leg-dumbbell-romanian-deadlift",
            why: "Works one side at a time with half the weight.",
          },
          {
            slug: "hyperextensions-back-extensions",
            why: "Trains your lower back and glutes on a bench, with a plate held at your chest for more load.",
          },
        ],
      },
      {
        heading: "At home",
        items: [
          {
            slug: "kettlebell-swing",
            why: "One kettlebell trains the same hip drive in fast reps.",
          },
          {
            slug: "banded-romanian-deadlift",
            why: "A band under your feet gives you a hinge with no weights at all.",
          },
        ],
      },
    ],
    how_to_pick:
      "If the regular deadlift feels awkward, start with the trap bar. If your gym doesn't have one, the Romanian deadlift teaches the same hinge from the top down. At home, a kettlebell swing or banded Romanian deadlift keeps the movement in your week until you can load it.",
    faq: [
      {
        q: "What is the best deadlift alternative for beginners?",
        a: "The trap bar deadlift. You stand inside the bar, which keeps your back more upright and makes the lift easier to learn.",
      },
      {
        q: "Is the Romanian deadlift a good replacement for deadlifts?",
        a: "Yes for your hamstrings and glutes. It starts from standing instead of the floor, so it works your quads less than a regular deadlift.",
      },
    ],
  },
  {
    base: "wide-grip-lat-pulldown",
    keyword: "lat pulldown alternative",
    title: "Lat Pulldown Alternatives for the Gym and at Home",
    description:
      "Pulldown machine taken, or no cable at home. These swaps train the same lats with a pull-up bar, dumbbells, bands or a different machine.",
    h1: "Lat pulldown alternatives",
    lead: "The assisted pull-up machine is the closest lat pulldown alternative, since it's the same vertical pull with part of your bodyweight taken off. At home, a resistance band anchored over a door works the same way.",
    groups: [
      {
        heading: "On a machine or cable",
        items: [
          {
            slug: "assisted-pull-up-machine",
            why: "Closest match. Same pulling path, and the counterweight sets how much of your bodyweight you lift.",
          },
          {
            slug: "one-arm-lat-pulldown",
            why: "Works one side at a time on any cable station with a high pulley.",
          },
          {
            slug: "close-grip-front-lat-pulldown",
            why: "Same machine with a closer grip. Use it for variety or when your shoulders prefer it.",
          },
          {
            slug: "straight-arm-pulldown",
            why: "Trains your lats with your arms straight, standing at a cable. A good finisher.",
          },
          {
            slug: "leverage-high-row",
            why: "A plate-loaded machine that pulls down and back on a similar path.",
          },
          {
            slug: "kneeling-high-pulley-row",
            why: "Uses a rope on a high pulley when the pulldown seat is taken.",
          },
        ],
      },
      {
        heading: "With bodyweight",
        items: [
          {
            slug: "pullups",
            why: "The real thing. Most beginners need assistance at first.",
          },
          {
            slug: "chin-up",
            why: "Palms facing you. Most people get their first rep here before a pull-up.",
          },
          {
            slug: "band-assisted-pull-up",
            why: "A band takes 40 to 80 lb off at the bottom, where you need the help most.",
          },
          {
            slug: "inverted-row",
            why: "A horizontal pull under a bar or sturdy table. Easier than a pull-up.",
          },
        ],
      },
      {
        heading: "With dumbbells or bands",
        items: [
          {
            slug: "banded-lat-pulldown",
            why: "A band anchored high gives you a pulldown at home.",
          },
          {
            slug: "straight-arm-dumbbell-pullover",
            why: "Lying across a bench, one dumbbell stretches and works your lats.",
          },
          {
            slug: "one-arm-dumbbell-row",
            why: "Trains your lats with a row instead of a pull down, and every gym has the equipment.",
          },
        ],
      },
    ],
    how_to_pick:
      "In a gym, the assisted pull-up machine or a single-arm cable pulldown keeps the same vertical pull. If you're building toward pull-ups, band-assisted pull-ups and chin-ups get you there. At home, anchor a band over a door.",
    faq: [
      {
        q: "What can I do instead of lat pulldowns at home?",
        a: "A resistance band anchored over a door gives you the same pull. Inverted rows under a sturdy table and dumbbell rows train the same lats too.",
      },
      {
        q: "Are pull-ups better than lat pulldowns?",
        a: "They train the same muscles. Pulldowns let you set the weight, so they're easier to start with and progress in small steps. Most people use both.",
      },
    ],
  },
  {
    base: "barbell-squat",
    keyword: "squat alternative",
    title: "Squat Alternatives for Beginners, Gym and Home",
    description:
      "No rack free, not ready for the barbell, or training at home. These squat swaps train the same legs with a machine, dumbbells or bodyweight.",
    h1: "Squat alternatives",
    lead: "The goblet squat is the best squat alternative for most beginners, since it uses one dumbbell and most people squat deeper with it than with a barbell. In a busy gym, the leg press and hack squat train the same muscles with no rack needed.",
    groups: [
      {
        heading: "On a machine",
        items: [
          {
            slug: "leg-press",
            why: "Trains your quads and glutes heavily with nothing to balance.",
          },
          {
            slug: "hack-squat",
            why: "The machine closest to a squat, with your back on a pad.",
          },
          {
            slug: "smith-machine-squat",
            why: "A barbell on a fixed track. Check your Smith bar's weight, since it varies by machine.",
          },
          {
            slug: "pendulum-squat",
            why: "A machine built for deep squats with your back supported.",
          },
        ],
      },
      {
        heading: "With dumbbells or a barbell",
        items: [
          {
            slug: "goblet-squat",
            why: "The best place to start. One dumbbell at your chest helps you sit deeper.",
          },
          {
            slug: "dumbbell-squat",
            why: "Dumbbells at your sides take the load off your back.",
          },
          {
            slug: "front-barbell-squat",
            why: "The bar sits on the front of your shoulders, which keeps you upright.",
          },
          {
            slug: "box-squat",
            why: "Sitting back to a box shows you exactly how deep each rep goes.",
          },
          {
            slug: "bulgarian-split-squat",
            why: "One leg at a time with your back foot on a bench.",
          },
          {
            slug: "dumbbell-lunges",
            why: "Trains each leg on its own with light dumbbells.",
          },
        ],
      },
      {
        heading: "At home",
        items: [
          {
            slug: "bodyweight-squat",
            why: "Three sets of 10 to 15 is a real workout if you're new.",
          },
          {
            slug: "squats-with-bands",
            why: "A band under your feet adds load at the top, where a bodyweight squat feels easiest.",
          },
          {
            slug: "wall-sit",
            why: "Holds the bottom of a squat against a wall.",
          },
        ],
      },
    ],
    how_to_pick:
      "If you're new, start with the goblet squat and move to the barbell once the movement feels natural. If the racks are taken, the leg press or hack squat keeps the workout on track. Keep your planned sets and pick a weight that leaves one or two reps in reserve.",
    faq: [
      {
        q: "What is the best squat alternative for beginners?",
        a: "The goblet squat. One dumbbell held at your chest makes it easier to stay upright and sit deep, with no rack to set up.",
      },
      {
        q: "Is the leg press as good as squats?",
        a: "For building your legs, it's a solid replacement. Squats also train your core and balance, so keep some free-weight squatting in your week if you can.",
      },
    ],
  },
  {
    base: "barbell-bench-press",
    keyword: "bench press alternative",
    title: "Bench Press Alternatives for the Gym and at Home",
    description:
      "Benches taken, no spotter, or no barbell at home. These bench press swaps train the same chest, shoulders and triceps with dumbbells, machines or bodyweight.",
    h1: "Bench press alternatives",
    lead: "The dumbbell bench press is the closest bench press alternative, since it's the same movement with each arm working on its own. At home, push-ups train the same muscles with no equipment.",
    groups: [
      {
        heading: "On a machine",
        items: [
          {
            slug: "machine-bench-press",
            why: "The same pressing path with a pin, and no spotter needed.",
          },
          {
            slug: "smith-machine-bench-press",
            why: "A barbell on a fixed track. Set the safeties and you can push close to failure alone.",
          },
          {
            slug: "leverage-chest-press",
            why: "A plate-loaded press where each arm moves its own handle.",
          },
          {
            slug: "cable-chest-press",
            why: "Keeps tension on your chest from the start of the rep to the end.",
          },
        ],
      },
      {
        heading: "With dumbbells or a barbell",
        items: [
          {
            slug: "dumbbell-bench-press",
            why: "Closest match. Each arm works on its own, and you can set the dumbbells down safely if you fail a rep.",
          },
          {
            slug: "incline-dumbbell-press",
            why: "Shifts more of the work to your upper chest.",
          },
          {
            slug: "dumbbell-floor-press",
            why: "A shorter range on the floor when every bench is taken.",
          },
          {
            slug: "close-grip-barbell-bench-press",
            why: "Same bar, narrower grip and more triceps.",
          },
          {
            slug: "dips-chest-version",
            why: "Leaning forward on dip bars trains your chest with bodyweight.",
          },
        ],
      },
      {
        heading: "At home",
        items: [
          {
            slug: "pushups",
            why: "The same muscles with no equipment. Put your hands on a bench to make them easier.",
          },
          {
            slug: "bench-press-with-bands",
            why: "A band looped under a bench gives you a press at home.",
          },
        ],
      },
    ],
    how_to_pick:
      "Without a spotter, use dumbbells or a machine so you can push hard safely. If every bench is busy, the dumbbell floor press needs only floor space. At home, start with push-ups and add a band when they get easy.",
    faq: [
      {
        q: "Is the dumbbell bench press as good as the barbell bench press?",
        a: "Yes for building your chest. You'll lift a little less total weight with dumbbells, but each arm has to do its own work.",
      },
      {
        q: "How can I train my chest without a bench?",
        a: "Push-ups and the dumbbell floor press both work with no bench. In the gym, the chest press machine is another option.",
      },
    ],
  },
];

const BY_BASE = new Map(ALTERNATIVES_PAGES.map((p) => [p.base, p]));

/** The page for a base slug, or undefined when the slug has none. */
export function alternativesPageFor(base: string): AlternativesPage | undefined {
  return BY_BASE.get(base);
}

export function alternativesPath(base: string): string {
  return `/exercises/${base}/alternatives`;
}

/** Every swap slug on a page, in page order. */
export function swapSlugs(page: AlternativesPage): string[] {
  return page.groups.flatMap((g) => g.items.map((i) => i.slug));
}

/** Every exercise slug a page renders: its base, then its swaps. */
export function pageSlugs(page: AlternativesPage): string[] {
  return [page.base, ...swapSlugs(page)];
}

/** One line per base or swap slug that is missing from the catalog or has no
 *  beginner_notes row. Empty means every page is complete. `exercises` is
 *  the SEO feed's shape: starting_weight_md is null when there are no notes. */
export function alternativesProblems(
  exercises: readonly { slug: string; starting_weight_md: string | null }[],
  pages: readonly AlternativesPage[] = ALTERNATIVES_PAGES,
): string[] {
  const bySlug = new Map(exercises.map((e) => [e.slug, e]));
  const problems: string[] = [];
  for (const page of pages) {
    for (const slug of pageSlugs(page)) {
      const role = slug === page.base ? "base" : "swap";
      const row = bySlug.get(slug);
      if (!row) problems.push(`${page.base}: ${role} ${slug} is not in the catalog`);
      else if (row.starting_weight_md === null)
        problems.push(`${page.base}: ${role} ${slug} has no beginner_notes`);
    }
  }
  return problems;
}
