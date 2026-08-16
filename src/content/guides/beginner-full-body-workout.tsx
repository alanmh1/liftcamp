import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { ExerciseList } from "@/components/guides/ExerciseRow";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "beginner-full-body-workout",
  title: "A beginner full-body workout, three days a week",
  dek: "Two workouts, alternated. Four exercises each, about 45 minutes, and a plan for adding weight.",
  description:
    "A simple three-day full-body routine for your first months of lifting: the exercises, the sets and reps, how to add weight, and what to swap when the gym is busy.",
  category: "Programming",
  published: "2026-08-16",
  updated: "2026-08-16",
  readMinutes: 6,
  toc: [
    { id: "why", label: "Why full body, not a split" },
    { id: "the-workout", label: "The workout" },
    { id: "progression", label: "Adding weight" },
    { id: "swaps", label: "If the equipment is taken" },
    { id: "extras", label: "What to add once this feels easy" },
    { id: "missed", label: "If you miss a session" },
    { id: "when-to-change", label: "When to stop running this" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          Two workouts, A and B, alternating three days a week with a rest day between each.
          Workout A is squat, bench press, dumbbell row, plank. Workout B is Romanian
          deadlift, overhead press, lat pulldown, plank. Three sets of each, four exercises,
          about 45 minutes.
        </P>
        <P>
          Run A, B, A one week and B, A, B the next. Add a little weight every session until
          you can't, which for most people is two to four months away.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="why" title="Why full body, not a split">
          <P>
            A split divides your body across different days: chest on Monday, back on Wednesday,
            legs on Friday. It's how most gym content is written. It suits someone who has been
            lifting for a year or two.
          </P>
          <P>
            The reason is frequency. Early progress comes from practising the movement.
            Squatting three times a week gives you 12 squat sessions a month to get better at
            squatting. A leg day gives you four. The lifts are new to you, so repetition is
            worth more than volume right now.
          </P>
          <P>
            Full body is also more forgiving of a missed session. Skip a day on a split and a
            whole muscle group waits a week. Skip a day here and you shift the rotation by one.
          </P>
        </Section>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Workout A</h3>
          <ExerciseList
            items={[
              { slug: "barbell-squat", name: "Barbell Squat", note: "3 sets of 5" },
              { slug: "barbell-bench-press", name: "Barbell Bench Press", note: "3 sets of 5" },
              { slug: "one-arm-dumbbell-row", name: "One-Arm Dumbbell Row", note: "3 sets of 8 per arm" },
              { slug: "plank", name: "Plank", note: "3 sets of 30 seconds" },
            ]}
          />
          <h3 className="mt-8 text-sm font-semibold">Workout B</h3>
          <ExerciseList
            items={[
              { slug: "romanian-deadlift", name: "Romanian Deadlift", note: "3 sets of 8" },
              { slug: "barbell-shoulder-press", name: "Barbell Shoulder Press", note: "3 sets of 5" },
              { slug: "wide-grip-lat-pulldown", name: "Wide-Grip Lat Pulldown", note: "3 sets of 10" },
              { slug: "plank", name: "Plank", note: "3 sets of 30 seconds" },
            ]}
          />
        </div>

        <Callout tone="warning" title="Start lighter than this looks">
          Three sets of five says nothing about the weight, and the weight is where
          beginners go wrong. Start every barbell lift here with the empty bar and
          work up over a session or two.
        </Callout>


        <Section id="the-workout" title="The workout">
          <P>
            Three sets of everything, and stop each set with two reps left in you.
          </P>
          <P>
            Five reps for the <ExerciseLink slug="barbell-squat">barbell squat</ExerciseLink>,{" "}
            <ExerciseLink slug="barbell-bench-press">bench press</ExerciseLink> and{" "}
            <ExerciseLink slug="barbell-shoulder-press">overhead press</ExerciseLink>. Eight to
            ten for the <ExerciseLink slug="romanian-deadlift">Romanian deadlift</ExerciseLink>,{" "}
            <ExerciseLink slug="one-arm-dumbbell-row">dumbbell row</ExerciseLink> and{" "}
            <ExerciseLink slug="wide-grip-lat-pulldown">lat pulldown</ExerciseLink>. Thirty
            seconds for the <ExerciseLink slug="plank">plank</ExerciseLink>.
          </P>
          <P>
            Rest two to three minutes between sets on the heavy lifts and about 90 seconds on
            everything else. Beginners consistently rest too little, then wonder why set three
            is so much worse than set one. If you're still breathing hard, wait.
          </P>
          <P>
            The whole session should take 45 to 55 minutes. If it's taking 90, you're resting
            too long between exercises, not between sets.
          </P>
        </Section>

        <Section id="progression" title="Adding weight">
          <P>
            Add weight every session you complete all three sets.
          </P>
          <P>
            Add 10 lb to lower body lifts, which here means the <ExerciseLink
            slug="barbell-squat">barbell squat</ExerciseLink> and the <ExerciseLink
            slug="romanian-deadlift">Romanian deadlift</ExerciseLink>. Add 5 lb to upper body
            lifts: <ExerciseLink slug="barbell-bench-press">bench press</ExerciseLink>,{" "}
            <ExerciseLink slug="barbell-shoulder-press">overhead press</ExerciseLink>, and the
            rows and pulldowns. Lower body uses more muscle and tolerates bigger jumps.
          </P>
          <P>
            That's roughly 30 lb a month on the squat. That rate lasts a few months and then
            slows. When you miss reps at the same weight two sessions running, drop back 10
            percent and climb again. The first time that happens is usually somewhere between
            month two and month four, and it means you ran the programme long enough to reach
            its end.
          </P>
        </Section>

        <Section id="swaps" title="If the equipment is taken">
          <P>
            Every exercise here has swaps, so a busy gym never costs you a session.
          </P>
          <P>
            If the rack is taken, the <ExerciseLink slug="barbell-squat">barbell
            squat</ExerciseLink> becomes the <ExerciseLink slug="leg-press">leg
            press</ExerciseLink> or the <ExerciseLink slug="hack-squat">hack
            squat</ExerciseLink>. The <ExerciseLink slug="barbell-bench-press">bench
            press</ExerciseLink> becomes the <ExerciseLink slug="dumbbell-bench-press">dumbbell
            bench press</ExerciseLink> or the <ExerciseLink slug="machine-bench-press">machine
            chest press</ExerciseLink>. The <ExerciseLink slug="barbell-shoulder-press">overhead
            press</ExerciseLink> becomes the <ExerciseLink
            slug="dumbbell-shoulder-press">dumbbell shoulder press</ExerciseLink>. The{" "}
            <ExerciseLink slug="romanian-deadlift">Romanian deadlift</ExerciseLink> becomes the{" "}
            <ExerciseLink slug="stiff-legged-dumbbell-deadlift">stiff-legged dumbbell
            deadlift</ExerciseLink>. The <ExerciseLink slug="wide-grip-lat-pulldown">lat
            pulldown</ExerciseLink> becomes <ExerciseLink slug="pullups">pull-ups</ExerciseLink>
            or <ExerciseLink slug="chin-up">chin-up</ExerciseLink> if you can do them.
          </P>
          <P>
            Swapping costs you almost nothing. Six minutes standing next to an occupied rack
            usually costs you the session.
          </P>
        </Section>

        <Section id="extras" title="What to add once this feels easy">
          <P>
            After about a month, most people want to add arm work. That's fine, and it goes at
            the end, never at the start.
          </P>
          <P>
            Add two exercises, one per workout, three sets of 10 to 15. A <ExerciseLink
            slug="barbell-curl">barbell curl</ExerciseLink> on workout A and a <ExerciseLink
            slug="triceps-pushdown">triceps pushdown</ExerciseLink> on workout B covers it. If
            your shoulders are the thing you care about, a <ExerciseLink
            slug="side-lateral-raise">side lateral raise</ExerciseLink> works instead.
          </P>
          <P>
            Resist adding a fifth compound lift. The four in each session already cover
            everything, and the most common way a beginner programme dies is by growing into a
            90-minute session nobody wants to show up for.
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
            Nothing here breaks from a missed session. People quit over one, which is the actual
            risk.
          </P>
        </Section>

        <Section id="when-to-change" title="When to stop running this">
          <P>
            Run this until adding weight stops working for a month or so, then change.
          </P>
          <P>
            For most people that's somewhere between four and eight months in. At that point an
            upper/lower split or a push/pull/legs rotation starts to make sense, because you can
            now handle enough weight that squatting three times a week is genuinely hard to
            recover from.
          </P>
          <P>
            Until then, changing programmes is the most popular way to make no progress. The one
            you're running is almost always better than the one you're about to read about.
          </P>
        </Section>
      </Prose>
    </>
  );
}
