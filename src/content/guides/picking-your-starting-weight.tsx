import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "picking-your-starting-weight",
  title: "How to pick your starting weight",
  dek: "The short version, then the details, for every kind of equipment in the gym.",
  description:
    "How much weight to start with on barbells, machines, dumbbells and bodyweight exercises, and how to tell when you picked right.",
  category: "Getting started",
  published: "2026-08-16",
  updated: "2026-08-16",
  readMinutes: 5,
  toc: [
    { id: "too-heavy", label: "Why most people start too heavy" },
    { id: "barbell", label: "Barbell lifts: start with the empty bar" },
    { id: "machines", label: "Machines: count reps, not plates" },
    { id: "dumbbells", label: "Dumbbells: two different answers" },
    { id: "bodyweight", label: "Bodyweight: pick reps instead" },
    { id: "check", label: "How to know you got it right" },
    { id: "next", label: "What to do next week" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          Start lighter than feels reasonable. For barbell lifts, start with the empty bar,
          which is 45 lb on most racks. For machines, ignore the number on the stack and pick
          a weight you can move for 10 reps with the last two feeling hard. For dumbbell work
          on small muscles like lateral raises, start at 5 or 10 lb.
        </P>
        <P>
          You'll know the weight was right if you finish the set thinking you could have done
          two more reps. That's the target, every set, for your first month.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="too-heavy" title="Why most people start too heavy">
          <P>
            Almost everyone starts too heavy. It's the single most common mistake in a first
            month of training, and it costs more than it looks like it should.
          </P>
          <P>
            A weight you can barely move teaches you the wrong movement. You learn to heave,
            round your back, and bounce out of the bottom, and those habits are harder to remove
            later than they are to avoid now. A weight you can control teaches you the actual
            lift.
          </P>
          <P>
            There's also a maths problem. If you start at your absolute limit, you have nowhere
            to go next week. If you start 30 lb below it, you get six weeks of adding weight
            before you have to work for it. Six weeks of easy progress is worth more to a
            beginner than one impressive first session.
          </P>
        </Section>

        <Section id="barbell" title="Barbell lifts: start with the empty bar">
          <P>
            Every barbell lift starts the same way: put the bar on the rack with nothing on it,
            and do 5 reps.
          </P>
          <P>
            The standard Olympic bar is 45 lb, or 20 kg. That is not a warm-up weight for
            someone new. Plenty of people find an empty bar overhead press genuinely hard on day
            one, and that's a normal place to be.
          </P>
          <P>
            Do 2 sets of 5. If both sets feel steady and you can pause at the bottom without
            shaking, add 10 lb and try again. Keep going until a set of 5 starts to feel like
            work. That's your starting weight.
          </P>
          <P>
            Two exceptions. On the <ExerciseLink slug="barbell-deadlift">barbell
            deadlift</ExerciseLink>, load 45 lb plates even if that's more weight than you want,
            because they set the bar at the correct height off the floor. If 135 lb is too much,
            put the bar on blocks instead of using smaller plates. And on the <ExerciseLink
            slug="romanian-deadlift">Romanian deadlift</ExerciseLink>, start lighter than your
            other lifts: it trains your hamstrings, not your whole body, and 95 lb done properly
            is enough to leave you sore for two days.
          </P>
        </Section>

        <Callout tone="warning" title="One thing worth stopping a set over">
          Every other form problem can be fixed by going lighter next time. A lower
          back that rounds under a loaded barbell is the exception. Put the weight
          down and start again with less.
        </Callout>


        <Section id="machines" title="Machines: count reps, not plates">
          <P>
            Machine stacks are not comparable between machines, or between gyms. A "60" on one{" "}
            <ExerciseLink slug="leg-press">leg press</ExerciseLink> is nothing like a "60" on
            another. So stop reading the number and count reps instead.
          </P>
          <P>
            Pick something that looks light. Do 8 reps. If it was easy, go up one plate and
            repeat. When 8 reps gets you to the point where two more would be a struggle, that's
            your weight.
          </P>
          <P>
            Write the number down anyway, because it'll be consistent on that specific machine,
            and that's what you need for next week.
          </P>
          <P>
            Cables behave the same way. On a <ExerciseLink slug="triceps-pushdown">triceps
            pushdown</ExerciseLink> or a <ExerciseLink slug="one-arm-dumbbell-row">dumbbell
            row</ExerciseLink>, the stack number will transfer between sessions at your gym and
            mean nothing anywhere else.
          </P>
        </Section>

        <Section id="dumbbells" title="Dumbbells: two different answers">
          <P>
            Dumbbells split into two groups, and the right starting weight is very different for
            each.
          </P>
          <P>
            For pressing and rowing, where several large muscles work together, most people
            start somewhere around 20 to 30 lb per hand. A <ExerciseLink
            slug="dumbbell-bench-press">dumbbell bench press</ExerciseLink> at 20 lb per side is
            a reasonable first attempt, and a <ExerciseLink slug="one-arm-dumbbell-row">dumbbell
            row</ExerciseLink> at 25 or 30 lb usually is too.
          </P>
          <P>
            For anything that isolates one small muscle, start much lighter than you think. A{" "}
            <ExerciseLink slug="side-lateral-raise">side lateral raise</ExerciseLink> with 5 or
            10 lb dumbbells is correct, and that is not a typo. It's a small muscle working
            through a long lever, so the usable weight is small and it goes up slowly. Same for{" "}
            <ExerciseLink slug="barbell-curl">barbell curl</ExerciseLink> work: a weight you can
            lift for 10 controlled reps builds more arm than a weight you have to swing for 5.
          </P>
        </Section>

        <Section id="bodyweight" title="Bodyweight: pick reps instead">
          <P>
            Some exercises don't have a weight to pick, so the question becomes how many reps.
          </P>
          <P>
            For <ExerciseLink slug="plank">plank</ExerciseLink>, aim for 20 to 30 seconds on
            your first attempt, in three sets. Not the two minutes you've seen posted. Three
            sets of 20 clean seconds beats one shaky minute.
          </P>
          <P>
            For <ExerciseLink slug="pullups">pull-ups</ExerciseLink>, most beginners can't do
            one, and that's the normal starting point. If you can do zero to two, use the
            assisted machine or do negatives: jump to the top, then lower yourself as slowly as
            you can. Three sets of three negatives, twice a week, and most people get a full rep
            inside two months. Meanwhile, build the strength on the <ExerciseLink
            slug="wide-grip-lat-pulldown">lat pulldown</ExerciseLink>, where you can pick any
            weight you like.
          </P>
        </Section>

        <InlineCta title="Track it and next week picks itself" body="LiftCamp is free and remembers the weight and reps you used, so you never have to guess a starting weight twice." />

        <Section id="check" title="How to know you got it right">
          <P>
            After every set, ask one question: could I have done two more reps?
          </P>
          <P>
            Two more reps in the tank is the target. Three or four means go heavier next set.
            Zero means the weight is too heavy, and you should drop it now rather than finish
            the session having practised bad reps.
          </P>
          <P>
            This works because it doesn't depend on knowing your one-rep max, doing any
            arithmetic, or being honest about your ego in a way most people aren't yet. It's a
            feel you develop over about three sessions.
          </P>
        </Section>

        <Section id="next" title="What to do next week">
          <P>
            Once you have a starting weight, the plan is simple and boring: add a little, often.
          </P>
          <P>
            Add 5 lb per session on upper body lifts like the <ExerciseLink
            slug="barbell-bench-press">bench press</ExerciseLink> and the <ExerciseLink
            slug="barbell-shoulder-press">overhead press</ExerciseLink>. Add 10 lb per session
            on lower body lifts like the <ExerciseLink slug="barbell-squat">barbell
            squat</ExerciseLink> and the <ExerciseLink slug="barbell-deadlift">barbell
            deadlift</ExerciseLink>. Lower body lifts use more muscle and tolerate bigger jumps.
          </P>
          <P>
            When you miss reps two sessions in a row at the same weight, drop back 10 percent
            and build up again. That isn't failure, it's how the whole thing works, and it will
            happen to you within a few months no matter how carefully you start.
          </P>
        </Section>

        <Callout title="If you are coming back after a long break">
          Treat yourself as a beginner for the first three weeks even if you used to
          lift heavier. Muscle comes back faster than tendons do, which is how most
          comeback injuries happen.
        </Callout>
      </Prose>
    </>
  );
}
