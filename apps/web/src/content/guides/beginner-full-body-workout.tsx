import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { RoutineDayCard, type DayCardItem } from "@/components/guides/RoutineDayCard";
import { InlineCta } from "@/components/guides/InlineCta";
import { BuilderLink } from "@/components/guides/BuilderLink";
import { RoutineLink } from "@/components/guides/RoutineLink";
import type { Guide } from "./types";

/** The two days of the Full Body 3x/week routine (full-body-3-day), exercise
 *  for exercise and set for set. If the routine changes, change these too. */
const WORKOUT_A: DayCardItem[] = [
  { slug: "barbell-squat", name: "Barbell Squat", sets: 3, reps: "8-10" },
  { slug: "barbell-bench-press", name: "Barbell Bench Press", sets: 3, reps: "8-10" },
  { slug: "bent-over-barbell-row", name: "Bent Over Barbell Row", sets: 3, reps: "8-10" },
  { slug: "standing-military-press", name: "Standing Military Press", sets: 3, reps: "8-10" },
  { slug: "romanian-deadlift", name: "Romanian Deadlift", sets: 3, reps: "8-10" },
];

const WORKOUT_B: DayCardItem[] = [
  { slug: "barbell-deadlift", name: "Barbell Deadlift", sets: 3, reps: "8-10" },
  { slug: "incline-dumbbell-press", name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
  { slug: "wide-grip-lat-pulldown", name: "Wide-Grip Lat Pulldown", sets: 3, reps: "8-10" },
  { slug: "bulgarian-split-squat", name: "Bulgarian Split Squat", sets: 3, reps: "8-10" },
  { slug: "barbell-curl", name: "Barbell Curl", sets: 3, reps: "10-12" },
];

function AlternativesLink({ slug, children }: { slug: string; children: string }) {
  return (
    <Link
      to="/exercises/$slug/alternatives"
      params={{ slug }}
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

export const meta: Guide["meta"] = {
  slug: "beginner-full-body-workout",
  title: "A beginner full-body workout, three days a week",
  dek: "Two workouts, alternated. Five exercises each, under an hour, and a plan for adding weight.",
  description:
    "A simple three-day full-body routine for your first months of lifting, with the exercises, sets and reps, how to add weight, and swaps for a busy gym.",
  category: "Programming",
  published: "2026-08-16",
  updated: "2026-11-03",
  readMinutes: 6,
  toc: [
    { id: "why", label: "Why full body" },
    { id: "the-workout", label: "The workout" },
    { id: "progression", label: "Adding weight" },
    { id: "swaps", label: "If the equipment is taken" },
    { id: "extras", label: "What to add once this feels easy" },
    { id: "missed", label: "If you miss a session" },
    { id: "when-to-change", label: "When to stop running this" },
  ],
  hero: { alt: "Clay illustration of a power rack, a lat pulldown machine and a chest press machine" },
  dayCardSlugs: [...WORKOUT_A, ...WORKOUT_B].map((it) => it.slug),
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          Two workouts, A and B, alternating three days a week with a rest day between each.
          Workout A is squat, bench press, barbell row, overhead press and Romanian deadlift.
          Workout B is deadlift, incline dumbbell press, lat pulldown, Bulgarian split squat and
          barbell curl. Three sets of each, and each session takes under an hour.
        </P>
        <P>
          Run A, B, A one week and B, A, B the next. Add a little weight whenever you hit the top
          of the rep range, which most people can keep doing for several months.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="why" title="Why full body">
          <P>
            A split divides your body across different days, such as chest on Monday, back on
            Wednesday and legs on Friday. It's how most gym content is written. It suits someone
            who has been lifting for a year or two.
          </P>
          <P>
            The reason is frequency. Early progress comes from practising the movement. Here,
            every main lift comes around every two or three days, so you practise each one six or
            seven times a month. A once-a-week split gives you four. The lifts are new to you, so
            repetition is worth more than volume right now.
          </P>
          <P>
            Full body is also more forgiving of a missed session. Skip a day on a split and a
            whole muscle group waits a week. Skip a day here and you shift the rotation by one.
          </P>
        </Section>

        <Section id="the-workout" title="The workout">
          <P>
            These are the two days of LiftCamp's Full Body 3x/week routine, exactly as the app
            runs them. Tap any exercise for form notes and swaps.
          </P>
          <RoutineDayCard title="Workout A" items={WORKOUT_A} />
          <RoutineDayCard title="Workout B" items={WORKOUT_B} />
          <P>
            Three sets of everything, and stop each set with a rep or two left in you. The main
            lifts are 8 to 10 reps, and the barbell curl is 10 to 12.
          </P>
          <P>
            Rest two to three minutes between sets on the squat, deadlifts and presses, and 60 to
            90 seconds on everything else. Beginners consistently rest too little, then wonder why
            set three is so much worse than set one. If you're still breathing hard, wait.
          </P>
          <P>
            If a session is running past an hour, look at the gaps between exercises. That's
            usually where the time goes.
          </P>
        </Section>

        <Callout tone="warning" title="Start lighter than this looks">
          Three sets of eight to ten says nothing about the weight, and the weight is where
          beginners go wrong. Start with a weight you could lift 15 times, then work up over your
          first two or three sessions until the last rep of each set feels hard.
        </Callout>

        <Section id="progression" title="Adding weight">
          <P>
            Use double progression. Pick a weight you can lift for 8 reps on every set. When you
            hit 10 reps on all 3 sets, add weight next session and start again from 8.
          </P>
          <P>
            Add 10 lb to the lower body lifts, which here means the{" "}
            <ExerciseLink slug="barbell-squat">squat</ExerciseLink>,{" "}
            <ExerciseLink slug="barbell-deadlift">deadlift</ExerciseLink>,{" "}
            <ExerciseLink slug="romanian-deadlift">Romanian deadlift</ExerciseLink> and{" "}
            <ExerciseLink slug="bulgarian-split-squat">Bulgarian split squat</ExerciseLink>. Add 5 lb to
            everything else. Lower body lifts use more muscle and handle bigger jumps.
          </P>
          <P>
            Expect to add weight every week or two on most lifts for the first few months. When
            you can't reach 8 reps at a weight two sessions running, drop back 10 percent and
            climb again. Most people first need to do that somewhere between month two and month
            four, and it's normal.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="Follow the 3-day full body routine"
          body="The same two workouts as this guide, set by set, with your weights saved for next time."
        />

        <BuilderLink body="This plan is a good place to start, but if your gym is missing a machine or you want a different split, build the version you will actually do." />

        <InlineCta />

        <Section id="swaps" title="If the equipment is taken">
          <P>
            Every exercise here has swaps, so a busy gym never costs you a session.
          </P>
          <P>
            If the rack is taken, the <ExerciseLink slug="barbell-squat">barbell squat</ExerciseLink>{" "}
            becomes the <ExerciseLink slug="leg-press">leg press</ExerciseLink> or the{" "}
            <ExerciseLink slug="goblet-squat">goblet squat</ExerciseLink>. The{" "}
            <ExerciseLink slug="barbell-bench-press">bench press</ExerciseLink> becomes the{" "}
            <ExerciseLink slug="dumbbell-bench-press">dumbbell bench press</ExerciseLink> or the{" "}
            <ExerciseLink slug="machine-bench-press">machine chest press</ExerciseLink>. The{" "}
            <ExerciseLink slug="bent-over-barbell-row">barbell row</ExerciseLink> becomes the{" "}
            <ExerciseLink slug="seated-cable-rows">seated cable row</ExerciseLink>, and the{" "}
            <ExerciseLink slug="standing-military-press">overhead press</ExerciseLink> becomes the{" "}
            <ExerciseLink slug="dumbbell-shoulder-press">dumbbell shoulder press</ExerciseLink>.
          </P>
          <P>
            On Workout B, the <ExerciseLink slug="barbell-deadlift">deadlift</ExerciseLink> becomes
            the <ExerciseLink slug="trap-bar-deadlift">trap bar deadlift</ExerciseLink>, and the{" "}
            <ExerciseLink slug="wide-grip-lat-pulldown">lat pulldown</ExerciseLink> becomes the{" "}
            <ExerciseLink slug="assisted-pull-up-machine">assisted pull-up</ExerciseLink>. The{" "}
            <ExerciseLink slug="bulgarian-split-squat">Bulgarian split squat</ExerciseLink> becomes
            a <ExerciseLink slug="split-squat-with-dumbbells">split squat with dumbbells</ExerciseLink>,
            and any curl works in place of the barbell curl.
          </P>
          <P>
            For more options, see the{" "}
            <AlternativesLink slug="barbell-squat">squat alternatives</AlternativesLink>,{" "}
            <AlternativesLink slug="barbell-bench-press">bench press alternatives</AlternativesLink>,{" "}
            <AlternativesLink slug="barbell-deadlift">deadlift alternatives</AlternativesLink> and{" "}
            <AlternativesLink slug="wide-grip-lat-pulldown">lat pulldown alternatives</AlternativesLink>.
            Take the first swap that's free and keep the session moving.
          </P>
        </Section>

        <Section id="extras" title="What to add once this feels easy">
          <P>
            After about a month, most people want a little more arm or shoulder work. That's fine,
            and it goes at the end of the session, never at the start.
          </P>
          <P>
            Add one exercise to Workout A, three sets of 10 to 15. A{" "}
            <ExerciseLink slug="triceps-pushdown">triceps pushdown</ExerciseLink> balances the curl
            on Workout B. If your shoulders are the thing you care about, a{" "}
            <ExerciseLink slug="side-lateral-raise">side lateral raise</ExerciseLink> works instead.
          </P>
          <P>
            Resist adding another big lift. The five in each session already cover everything,
            and the most common way a beginner routine dies is by growing into a 90-minute session
            nobody wants to show up for.
          </P>
        </Section>

        <Section id="missed" title="If you miss a session">
          <P>
            Miss one session and shift the rotation. If you were due A and skipped it, do A next
            time. Don't try to make it up by doubling.
          </P>
          <P>
            Miss a full week and repeat the last weight you completed instead of continuing to
            climb. Miss a month and drop back about 20 percent and rebuild. You'll be back to
            where you were inside three weeks, which is much faster than the first climb took.
          </P>
          <P>
            A missed session costs you almost nothing, as long as you come back for the next one.
          </P>
        </Section>

        <Section id="when-to-change" title="When to stop running this">
          <P>
            Run this until adding weight stops working for a month or so, then change.
          </P>
          <P>
            For most people that's somewhere between four and eight months in. At that point an
            upper/lower split or a push/pull/legs rotation starts to make sense, because you can
            now handle enough weight that the full body sessions get genuinely hard to recover
            from.
          </P>
          <P>
            Until then, switching routines is the most popular way to make no progress. The one
            you're running is almost always better than the one you're about to read about.
          </P>
        </Section>
      </Prose>
    </>
  );
}
