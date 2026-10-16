import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "Is lifting twice a week enough?",
    a: "Yes. Two full-body sessions a week trains every major muscle twice, which is the minimum in the American College of Sports Medicine's 2026 guidelines. Beginners make steady progress on it.",
  },
  {
    q: "Is it bad to lift every day as a beginner?",
    a: "It isn't dangerous, but it rarely helps. Your muscles get stronger between sessions, and lifting every day leaves less time to recover. Most beginners get more from three good sessions than from six tired ones.",
  },
  {
    q: "Should my lifting days be in a row?",
    a: "No. Leave at least one rest day between full-body sessions. Monday and Thursday, or Monday, Wednesday and Friday, both work.",
  },
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
  slug: "how-many-days-a-week-to-lift",
  title: "How many days a week do you need to lift?",
  dek: "Two is enough to start. Three is better if you can keep it up. Pick the number you will still be doing in March.",
  description:
    "How many days a week a beginner should lift: what the 2026 ACSM guidelines say, how two, three and four day plans compare, and how to pick a number you will stick with.",
  category: "Programming",
  published: "2026-10-16",
  updated: "2026-10-16",
  readMinutes: 5,
  toc: [
    { id: "research", label: "What the research says" },
    { id: "two-days", label: "Two days a week" },
    { id: "three-days", label: "Three days a week" },
    { id: "four-days", label: "Four days or more" },
    { id: "picking", label: "How to pick your number" },
    { id: "working", label: "How to know it's working" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
  hero: {
    alt: "Clay figure holding a dumbbell and pointing at a month calendar with two days checked off each week",
    fill: true,
  },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Two days a week is enough for a beginner to get stronger.</strong> That's the
          floor in the{" "}
          <a
            href="https://acsm.org/resistance-training-guidelines-update-2026/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            American College of Sports Medicine's 2026 guidelines
          </a>
          : train every major muscle group at least twice a week.
        </P>
        <P>
          Three days usually works a little better. Past that, extra days cost more time than they
          give back in your first few months. The number that matters most is the one you can
          repeat every week.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="research" title="What the research says">
          <P>
            In March 2026{" "}
            <a
              href="https://acsm.org/resistance-training-guidelines-update-2026/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              the ACSM published its first big update to its lifting guidelines
            </a>{" "}
            since 2009. It pulled together 137 systematic reviews covering more than 30,000 people.
          </P>
          <P>
            The headline finding is simple. The biggest gain comes from going from no lifting to
            some lifting. Fine-tuning how often you train matters a lot less than showing up.
          </P>
          <P>
            For month one, that means a two-day plan you finish will get you further than a
            five-day plan you quit in week 3.
          </P>
        </Section>

        <Section id="two-days" title="Two days a week">
          <P>
            With two days, each workout has to cover your whole body. Five or six exercises a
            session does it: a squat, a press, a pull and a hinge on one day, then a deadlift, an
            overhead press, a row and the leg press on the other.
          </P>
          <P>
            Space the two days apart. Monday and Thursday, or Tuesday and Saturday, both work.
          </P>
        </Section>

        <RoutineLink
          slug="two-day-full-body"
          label="Follow the Two Day Full Body routine"
          body="Both workouts in order, with sets and reps. Training at home with dumbbells? Use Two Day Dumbbell Full Body instead."
        />

        <Section id="three-days" title="Three days a week">
          <P>
            Three days is the standard beginner setup. You alternate two workouts, A and B, on
            something like Monday, Wednesday and Friday. Every muscle gets trained three times a
            week, and you get a rest day between each session.
          </P>
          <P>
            The <GuideLink slug="beginner-full-body-workout">beginner full-body guide</GuideLink>{" "}
            walks through a three-day week in more detail.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="Follow the 3-day full body routine"
          body="Workouts A and B as a page you can open at the gym."
        />

        <Section id="four-days" title="Four days or more">
          <P>
            A fourth day makes sense once your full-body workouts start running past an hour. That
            usually happens a few months in, when you are doing more sets and resting longer
            between heavy ones. At that point an upper/lower split spreads the same work over four
            shorter sessions.
          </P>
          <P>Before then, a fourth day mostly adds soreness and one more thing to skip.</P>
        </Section>

        <Section id="picking" title="How to pick your number">
          <P>
            Look at the last month of your calendar and count the weeks you could have trained
            three times without moving anything. If the answer is most of them, pick three. If
            it's about half, pick two.
          </P>
          <P>
            When in doubt, go lower. Adding a day after a month of hitting your target feels good.
            Dropping a day after a month of missing feels like failing, and that's usually when
            people stop.
          </P>
          <Callout title="Rest days are part of the plan">
            Your muscles get stronger between sessions, not during them. A day off between
            full-body workouts is when the progress happens.
          </Callout>
        </Section>

        <InlineCta
          title="Set a weekly target you can keep"
          body="In LiftCamp, the number you pick is your weekly target. Every week you hit it adds to your week streak, so two days you hit every week beats four you hit half the time."
          label="Get LiftCamp free"
        />

        <Section id="working" title="How to know it's working">
          <P>
            You should be adding a little weight or a rep or two on most lifts every week or so.
            The <GuideLink slug="progressive-overload">progressive overload guide</GuideLink> covers
            how.
          </P>
          <P>
            If you have hit your target four weeks running and your sessions feel easy to fit in,
            that's the time to add a day.
          </P>
        </Section>

        <Section id="faq" title="Days per week FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
