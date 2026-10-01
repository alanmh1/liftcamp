import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "Is progressive overload necessary?",
    a: "Yes, if you want to keep getting stronger or building muscle. Doing the same weight and reps for months maintains what you have. It's still good exercise, and it won't produce further change.",
  },
  {
    q: "Is progressive overload bad?",
    a: "No. It goes wrong when people add weight faster than their form can handle. Add weight only when every rep at the current weight looks clean, and keep the jumps small.",
  },
  {
    q: "Should you progressively overload every week?",
    a: "In your first months, try to add a rep or some weight every session. Later, progress may come weekly, then every few weeks. Slower progress after the beginner stage is normal.",
  },
  {
    q: "How do you do progressive overload for abs?",
    a: "Add reps first. Once you can do 15 to 20, make the exercise harder by holding a weight during crunches, using a cable crunch, or moving from knee raises to leg raises. For planks, add time in 5 to 10 second steps.",
  },
  {
    q: "How fast should you add weight?",
    a: "As fast as your rep range allows. Add weight when every set reaches the top of the range, and no sooner. For a beginner that may be every one to three sessions on big lifts and less often on small ones.",
  },
  {
    q: "How long until progress slows down?",
    a: "For most beginners, session-to-session progress lasts somewhere in the first four to six months. After that, expect to add weight less often.",
  },
  {
    q: "Can you do progressive overload with the same weight?",
    a: "Yes. Add reps, add a set, slow the lowering, or shorten your rest. All four make the same weight harder than it was last session.",
  },
];

export const meta: Guide["meta"] = {
  slug: "progressive-overload",
  title: "Progressive overload for beginners: how to do it",
  dek: "What progressive overload is, why it works, and the reps-then-weight method for barbells, machines, dumbbells and bodyweight.",
  description:
    "Progressive overload means doing a little more each session. Add reps first, then weight. A beginner's guide with dumbbell, pushup and at-home examples.",
  category: "Programming",
  published: "2026-10-01",
  updated: "2026-10-01",
  readMinutes: 9,
  toc: [
    { id: "what-is", label: "What is progressive overload?" },
    { id: "why", label: "Why progressive overload is important" },
    { id: "how", label: "How to do progressive overload properly" },
    { id: "without-weight", label: "Without increasing weight" },
    { id: "dumbbells", label: "With dumbbells, including at home" },
    { id: "calisthenics", label: "With pushups and calisthenics" },
    { id: "miss", label: "What to do when you miss" },
    { id: "strength-or-muscle", label: "Strength or muscle growth?" },
    { id: "by-lift", label: "By muscle or lift" },
    { id: "women", label: "Progressive overload for women" },
    { id: "vs", label: "Progressive overload vs other terms" },
    { id: "plan", label: "A simple workout plan" },
    { id: "track", label: "How to track it" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
  hero: { alt: "Clay illustration of four hex dumbbells in a row, each larger than the last" },
};

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-[17px] font-semibold tracking-tight lg:text-[18px]">{children}</h3>
  );
}

function GuideLink({ slug, children }: { slug: string; children: string }) {
  return (
    <Link
      to="/guides/$slug"
      params={{ slug }}
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

const UL = "mt-4 list-disc space-y-2 pl-5 text-foreground/80";
const OL = "mt-4 list-decimal space-y-2 pl-5 text-foreground/80";
const TH = "border-b border-border px-3 py-2 text-left font-semibold";
const TD = "border-b border-border px-3 py-2 text-foreground/80";

const EXAMPLE: [string, string, string, string, string, string][] = [
  ["1", "95 lbs", "10", "10", "9", "Same weight, add reps"],
  ["2", "95 lbs", "11", "10", "10", "Same weight, add reps"],
  ["3", "95 lbs", "12", "11", "11", "Same weight, add reps"],
  ["4", "95 lbs", "12", "12", "12", "Add 5 lbs next session"],
];

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          Progressive overload means gradually asking your muscles to do more than they did last
          time. In strength training, that usually means adding a rep or a little weight to an
          exercise from one session to the next.
        </P>
        <P>
          If you can't add anything today, repeat last session's numbers and try again next time.
          Add weight once every set reaches the top of your rep range.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="what-is" title="What is progressive overload?">
          <P>
            Progressive overload is the practice of making your training slightly harder over
            time. You lift a weight for a number of reps, and next session you try for one more
            rep or a little more weight.
          </P>
          <P>
            That's the whole definition. It applies the same way whether you're lifting weights
            in a gym, using dumbbells at home, or doing pushups on your bedroom floor.
          </P>
        </Section>

        <Section id="why" title="Why progressive overload is important">
          <P>
            Your body adapts to the work you give it. Lift 50 lbs for 8 reps every week and your
            muscles get good at exactly that, then stop changing.
          </P>
          <P>
            To keep getting stronger, the work has to grow. This is the principle behind every
            strength program, from a first-month beginner routine to what competitive lifters
            follow.
          </P>
          <P>
            Beginners have an advantage here. In your first six months, you can often add
            something every single session.
          </P>
        </Section>

        <Section id="how" title="How to do progressive overload properly">
          <P>
            Add reps first, then add weight. This method is called double progression, because
            you progress two things in turn. Reps go up first, then the load.
          </P>
          <ol className={OL}>
            <li>Pick a rep range. 8 to 12 works for most exercises.</li>
            <li>
              Keep the weight the same and add a rep each session, until every set reaches the top
              of the range.
            </li>
            <li>Add weight and start again at the bottom of the range.</li>
          </ol>
          <P>Typical jumps when you add weight:</P>
          <ul className={UL}>
            <li>
              5 lbs on most barbell lifts, such as the{" "}
              <ExerciseLink slug="barbell-bench-press">bench press</ExerciseLink> and{" "}
              <ExerciseLink slug="barbell-shoulder-press">overhead press</ExerciseLink>
            </li>
            <li>
              10 lbs on the <ExerciseLink slug="barbell-squat">squat</ExerciseLink> and{" "}
              <ExerciseLink slug="barbell-deadlift">deadlift</ExerciseLink>
            </li>
            <li>The next dumbbell size up</li>
            <li>One plate on a machine's weight stack</li>
          </ul>

          <H3>A worked example</H3>
          <P>Bench press, 3 sets, rep range of 8 to 12.</P>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[15px] tabular-nums lg:text-base">
              <thead>
                <tr>
                  <th className={TH}>Session</th>
                  <th className={TH}>Weight</th>
                  <th className={TH}>Set 1</th>
                  <th className={TH}>Set 2</th>
                  <th className={TH}>Set 3</th>
                  <th className={TH}>What to do next</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i} className={TD}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Session 5 starts at 100 lbs, and the reps will drop back toward 8. That's expected.
            You build them up again.
          </P>
          <P>
            This works on barbells and machines alike. Every rep should look like the ones before
            it. If your form changes to squeeze out one more, that rep doesn't count.
          </P>
          <P>
            Not sure what weight to begin with? Read{" "}
            <GuideLink slug="picking-your-starting-weight">
              how to pick your starting weight
            </GuideLink>{" "}
            first.
          </P>
        </Section>

        <Section id="without-weight" title="Progressive overload without increasing weight">
          <P>
            You can progress five ways without touching the weight. Do more reps, do more sets,
            lower the weight more slowly, use a fuller range of motion, or rest less.
          </P>
          <P>
            Beginners should start with reps. It's the easiest to measure and the hardest to fool
            yourself on.
          </P>
          <P>Once reps are at the top of your range and you can't add weight, try these in order:</P>
          <ul className={UL}>
            <li>Add a set. Go from 3 sets to 4.</li>
            <li>Lower the weight more slowly. Take 3 seconds on the way down.</li>
            <li>
              Use a fuller range. Squat a little deeper, or lower the dumbbells a little further,
              as long as it's comfortable.
            </li>
            <li>Rest less. Cut rest from 2 minutes to 90 seconds and match the same reps.</li>
          </ul>
          <P>Change one thing at a time so you can tell what's working.</P>
        </Section>

        <Section
          id="dumbbells"
          title="How to do progressive overload with dumbbells, including at home"
        >
          <P>
            With dumbbells, get every set to the top of your rep range before you move up.
            Dumbbells usually go up in 5 lb steps, and going from 15 lbs to 20 lbs per hand is a
            33 percent jump.
          </P>
          <P>
            If the next size feels too heavy, widen your rep range. Work up to 15 reps with the
            lighter pair, then move up and expect to start around 8.
          </P>
          <P>
            At home with only one or two pairs, use the methods from the section above. Add reps,
            add a set, and slow the lowering. You can also switch to single-arm or single-leg
            versions of an exercise, which makes the same dumbbell harder. A{" "}
            <ExerciseLink slug="split-squat-with-dumbbells">split squat</ExerciseLink> with 20
            lbs is far tougher than a two-legged squat with the same weight.
          </P>
        </Section>

        <Section
          id="calisthenics"
          title="How to do progressive overload with pushups and calisthenics"
        >
          <P>
            With bodyweight exercises, add reps until you reach a target, then move to a harder
            variation.
          </P>
          <P>A pushup progression looks like this:</P>
          <ol className={OL}>
            <li>Wall pushups</li>
            <li>Incline pushups, hands on a bench or sturdy chair</li>
            <li>Knee pushups</li>
            <li>Full pushups</li>
            <li>Feet-elevated pushups</li>
          </ol>
          <P>
            When you can do 3 sets of 12 at one step, move to the next and start again at whatever
            reps you can manage.
          </P>
          <P>
            The same approach works for other calisthenics. A{" "}
            <ExerciseLink slug="bodyweight-squat">bodyweight squat</ExerciseLink> leads to a split
            squat. Hanging from a bar leads to assisted chin-ups, then a full{" "}
            <ExerciseLink slug="chin-up">chin-up</ExerciseLink>.
          </P>
        </Section>

        <InlineCta
          title="See last session's numbers while you lift"
          body="LiftCamp is a free workout tracker. It shows what you did last time next to each set as you log, so you know the number to beat."
        />

        <Section id="miss" title="What to do when you miss">
          <P>
            If you don't beat last session's numbers, stay at the same weight and try again next
            time. One off day means very little. Sleep, food and stress all affect how a session
            goes.
          </P>
          <P>
            If you miss on the same lift three sessions in a row, drop the weight by about 10
            percent and build back up.
          </P>
        </Section>

        <Callout tone="warning" title="If something hurts">
          Stop the exercise and see a qualified professional. Pain is a different problem from a
          missed rep, and adding weight won't fix it.
        </Callout>

        <Section id="strength-or-muscle" title="Is progressive overload for strength or muscle growth?">
          <P>
            Both. Progressive overload drives strength and muscle growth, and your rep range
            decides which one it favours.
          </P>
          <P>
            Lower reps with heavier weight, around 3 to 6, lean toward strength. Ranges of 8 to 12
            lean toward muscle growth, which you'll also see called hypertrophy.
          </P>
          <P>
            For beginners the difference is small. In your first six months you'll gain strength
            and size on almost any sensible range, as long as the numbers keep going up.
          </P>
        </Section>

        <Section id="by-lift" title="Progressive overload by muscle or lift">
          <H3>Squats</H3>
          <P>
            Add reps until every set hits the top of your range, then add 10 lbs. When 10 lb jumps
            stop working, switch to 5. The{" "}
            <ExerciseLink slug="barbell-squat">barbell squat</ExerciseLink> page covers form.
          </P>
          <H3>Glutes</H3>
          <P>
            Hip thrusts and the{" "}
            <ExerciseLink slug="romanian-deadlift">Romanian deadlift</ExerciseLink> respond well
            to double progression. Glutes are strong, so expect to add weight often in the first
            months.
          </P>
          <H3>Biceps</H3>
          <P>
            Small muscles need small jumps. On the{" "}
            <ExerciseLink slug="dumbbell-bicep-curl">dumbbell curl</ExerciseLink>, use a wider
            range such as 10 to 15 before moving up a dumbbell size.
          </P>
          <H3>Abs</H3>
          <P>
            Treat them like any other muscle. Add reps to 15 or 20, then add load with a{" "}
            <ExerciseLink slug="cable-crunch">cable crunch</ExerciseLink>. For a{" "}
            <ExerciseLink slug="plank">plank</ExerciseLink>, add time in 5 to 10 second steps.
          </P>
        </Section>

        <Section id="women" title="Progressive overload for women">
          <P>
            The principle and the method are the same for women as for men. Pick a rep range, add
            reps, then add weight.
          </P>
          <P>
            One practical point. A 5 lb jump on a light upper-body lift is a big percentage of the
            weight. If that jump feels too large, add reps for longer before moving up, or use 2.5
            lb plates if your gym has them.
          </P>
        </Section>

        <Section id="vs" title="Progressive overload vs other training terms">
          <P>
            Progressive overload is the rule for getting stronger over weeks. Most of the terms
            below describe tools used inside a single workout.
          </P>
          <H3>Progressive overload vs training to failure</H3>
          <P>
            Training to failure means doing reps until you can't complete another one. You can
            progress without ever failing a rep. Beginners should stop each set with 1 to 2 reps
            left, which keeps form steady and makes the next session easier to recover for.
          </P>
          <H3>Progressive overload vs double progression</H3>
          <P>
            Double progression is one way to apply progressive overload. You add reps within a
            range, then add weight. It's the method this guide teaches.
          </P>
          <H3>Progressive overload vs time under tension</H3>
          <P>
            Time under tension is how long a muscle works during a set. Slowing each rep
            increases it. It's one of the things you can progress when you can't add weight.
          </P>
          <H3>Progressive overload vs volume</H3>
          <P>
            Volume is sets times reps times weight. Raising any of the three raises volume, so
            adding volume is a form of progressive overload.
          </P>
          <H3>Progressive overload vs hypertrophy</H3>
          <P>
            Hypertrophy means muscle growth. It's a result. Progressive overload is the method
            that produces it.
          </P>
          <H3>Progressive overload vs drop sets</H3>
          <P>
            A drop set is a technique for one set. You finish your reps, reduce the weight
            straight away, and keep going. It makes a single set harder. Progressive overload is
            about beating your numbers across weeks.
          </P>
          <H3>Progressive overload vs pyramid and reverse pyramid sets</H3>
          <P>
            Pyramid sets start light and get heavier with each set. Reverse pyramid sets start
            heavy and get lighter. Both are ways to arrange the sets in one workout, and you can
            apply progressive overload to either by beating last session's numbers.
          </P>
        </Section>

        <Section id="plan" title="A simple progressive overload workout plan">
          <P>
            Train three days a week with a rest day between sessions. Do the same exercises each
            week so you have numbers to beat.
          </P>
          <P>
            Pick one of the routines below, follow it for at least eight weeks, and apply the
            reps-then-weight method to every exercise. The{" "}
            <GuideLink slug="beginner-full-body-workout">beginner full-body workout guide</GuideLink>{" "}
            explains the first one in detail.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="3-day full body routine"
          body="Three days a week with barbells and machines."
        />
        <RoutineLink
          slug="dumbbell-full-body"
          label="Dumbbell full body routine"
          body="For home or a small gym, with dumbbells and a bench."
        />
        <RoutineLink
          slug="calisthenics-full-body"
          label="Calisthenics full body routine"
          body="Bodyweight only, with a pull-up bar and somewhere to do dips."
        />

        <Section id="track" title="How to track progressive overload">
          <P>Write down every set. Without last session's numbers, you're guessing at today's.</P>
          <P>Record three things for each exercise:</P>
          <ul className={UL}>
            <li>Weight</li>
            <li>Reps per set</li>
            <li>Number of sets</li>
          </ul>
          <P>
            Before each exercise, look at what you did last time. If you got 10, 10 and 9 at 95
            lbs, today's goal is 10, 10 and 10, or better.
          </P>
          <P>
            A notebook works. So does a progressive overload tracker like LiftCamp, which is free
            and shows your previous session's numbers next to each set as you log.
          </P>
        </Section>

        <Section id="faq" title="Progressive overload FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
