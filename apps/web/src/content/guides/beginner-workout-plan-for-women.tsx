import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { RoutineDayCard, type DayCardItem } from "@/components/guides/RoutineDayCard";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "How many days a week should a beginner woman lift?",
    a: "Three is the sweet spot. It trains every muscle often enough to make steady progress and leaves a rest day between sessions. Two days a week still works if that's what fits.",
  },
  {
    q: "Should women train differently from men?",
    a: "Not really. Muscles respond to the same training whoever they belong to. This plan is the same one that works for any beginner, with a little more glute work because most women ask for it.",
  },
  {
    q: "Should I do cardio as well?",
    a: "If you enjoy it, yes. Walking, cycling or a class on your rest days is good for your heart and won't slow your progress in the weight room. Lifting comes first if you only have time for one.",
  },
  {
    q: "Will this plan make me bulky?",
    a: "No. Muscle comes on slowly, and a look most people would call bulky takes years of training and eating for that goal. In your first months you'll mostly get stronger.",
  },
  {
    q: "Why machines instead of free weights?",
    a: "Machines guide the movement, so you can focus on learning how each exercise should feel and pushing hard safely. Free weights come in once you have a few months of training behind you.",
  },
];

const DAY_1: DayCardItem[] = [
  { slug: "leg-press", name: "Leg Press", sets: 3, reps: "8-10" },
  { slug: "leverage-chest-press", name: "Chest Press Machine", sets: 3, reps: "8-10" },
  { slug: "wide-grip-lat-pulldown", name: "Lat Pulldown", sets: 3, reps: "8-10" },
  { slug: "seated-hamstring-curl", name: "Seated Hamstring Curl", sets: 3, reps: "10-12" },
  { slug: "ab-crunch-machine", name: "Ab Crunch Machine", sets: 3, reps: "12-15" },
];

const DAY_2: DayCardItem[] = [
  { slug: "hack-squat", name: "Hack Squat", sets: 3, reps: "8-10" },
  { slug: "seated-machine-row", name: "Seated Row Machine", sets: 3, reps: "8-10" },
  { slug: "leverage-shoulder-press", name: "Shoulder Press Machine", sets: 3, reps: "8-10" },
  { slug: "leg-extensions", name: "Leg Extension", sets: 3, reps: "10-12" },
  { slug: "standing-calf-raises", name: "Standing Calf Raise", sets: 3, reps: "12-15" },
];

const DAY_3: DayCardItem[] = [
  { slug: "hip-thrust-machine", name: "Hip Thrust Machine", sets: 3, reps: "8-10" },
  { slug: "leverage-incline-chest-press", name: "Incline Chest Press Machine", sets: 3, reps: "8-10" },
  { slug: "leverage-high-row", name: "High Row Machine", sets: 3, reps: "8-10" },
  { slug: "lying-hamstring-curl", name: "Lying Hamstring Curl", sets: 3, reps: "10-12" },
  { slug: "thigh-abductor", name: "Abductor Machine", sets: 3, reps: "10-12" },
];

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

export const meta: Guide["meta"] = {
  slug: "beginner-workout-plan-for-women",
  title: "A beginner workout plan for women",
  seoTitle: "Beginner Workout Plan for Women (3 Days)",
  dek: "Three gym sessions a week on machines, with the exact exercises, sets and reps for your first month and what to do after.",
  description:
    "A 3-day beginner gym workout plan for women. Every exercise with sets and reps, how to pick your weights, and how to progress through your first month.",
  category: "Getting started",
  published: "2026-11-02",
  updated: "2026-11-02",
  readMinutes: 7,
  toc: [
    { id: "the-plan", label: "The plan at a glance" },
    { id: "day-1", label: "Day 1" },
    { id: "day-2", label: "Day 2" },
    { id: "day-3", label: "Day 3" },
    { id: "first-month", label: "Your first month" },
    { id: "weights", label: "Picking your weights" },
    { id: "after", label: "After the first month" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
  dayCardSlugs: [...DAY_1, ...DAY_2, ...DAY_3].map((it) => it.slug),
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Lift three days a week on machines.</strong> Each session trains your whole
          body with five exercises of 3 sets each, and takes about 45 minutes.
        </P>
        <P>
          Spend the first two weeks learning the machines and finding your weights. From week three,
          add a little weight whenever a set gets easy.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="the-plan" title="The plan at a glance">
          <P>
            Train on three days with a rest day between, such as Monday, Wednesday and Friday. The
            three sessions are different, so across a week you hit your legs, glutes, back, chest,
            shoulders and core from a few angles.
          </P>
          <P>
            Every exercise here is on a machine. Machines guide the path of the weight, so you can
            focus on how the movement should feel and push hard without needing a spotter. It's the
            same plan as LiftCamp's Machines Only routine, so you can follow it set by set in the
            app.
          </P>
        </Section>

        <Section id="day-1" title="Day 1">
          <RoutineDayCard title="Day 1" items={DAY_1} />
        </Section>

        <Section id="day-2" title="Day 2">
          <RoutineDayCard title="Day 2" items={DAY_2} />
        </Section>

        <Section id="day-3" title="Day 3">
          <RoutineDayCard title="Day 3" items={DAY_3} />
          <P>
            Rest about 2 minutes after the first three exercises of each day and about a minute
            after the last two.
          </P>
        </Section>

        <Callout title="If a machine is taken">
          Every exercise page has a few swaps that train the same muscles. Tap the exercise above
          and use the first one that's free. The{" "}
          <GuideLink slug="what-to-do-when-the-machine-is-taken">machine is taken</GuideLink> guide
          covers the most common ones.
        </Callout>

        <Section id="first-month" title="Your first month">
          <P>
            <strong>Weeks 1 and 2.</strong> Learn the machines. Set the seat and pads before your
            first set, and start light enough that every rep feels smooth. Write down the weight
            and reps for each exercise, because those numbers are your starting point.
          </P>
          <P>
            <strong>Weeks 3 and 4.</strong> Start adding weight. When you hit the top of the rep
            range on all 3 sets, move the pin down one plate next time. On most machines that's 5
            to 10 lb. Some weeks you'll go up on most exercises, and some weeks on only a couple.
            Both are progress.
          </P>
          <P>
            Expect to feel sore a day or two after your first few sessions. It fades within a
            couple of weeks as your body gets used to the work. The{" "}
            <GuideLink slug="why-am-i-so-sore-after-lifting">soreness guide</GuideLink> explains
            what's normal.
          </P>
        </Section>

        <Section id="weights" title="Picking your weights">
          <P>
            The right weight is one where the last two reps of a set are hard but your form still
            looks the same as the first rep. If you could easily do five more, it's too light. If
            the last reps turn into a struggle or your body starts to twist, it's too heavy.
          </P>
          <P>
            Machines vary a lot between gyms, so a number on one leg press means little on another.
            The{" "}
            <GuideLink slug="picking-your-starting-weight">starting weight guide</GuideLink> has a
            simple way to find yours on the first day.
          </P>
        </Section>

        <InlineCta
          title="Let the app remember your weights"
          body="LiftCamp fills in what you lifted last time on every set, so you never have to guess where to start."
        />

        <Section id="after" title="After the first month">
          <P>
            Keep running the same three days for another month or two. The plan keeps working as
            long as your weights keep creeping up.
          </P>
          <P>
            When the machines feel familiar, move to a plan with free weights. If you want more
            glute and leg work, Glute Focus trains your lower body twice a week. If you want an
            all-round plan, the 3-day full body routine builds around squats, presses and rows. And
            if you're worried about getting bigger,{" "}
            <GuideLink slug="will-lifting-make-me-bulky">here's why lifting won't make you bulky</GuideLink>.
          </P>
        </Section>

        <RoutineLink
          slug="machines-only-workout"
          label="Start the Machines Only routine"
          body="The same three sessions as this guide, set by set, with your weights saved for next time."
        />

        <RoutineLink
          slug="glute-workout-plan"
          label="Next step, Glute Focus"
          body="Two lower body days and one upper day, built on hip thrusts, Romanian deadlifts and split squats."
        />

        <RoutineLink
          slug="dumbbell-only-workout"
          label="Training at home? Dumbbell Only"
          body="Three full body sessions with a pair of dumbbells and a bench."
        />

        <Section id="faq" title="Beginner workout plan FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
