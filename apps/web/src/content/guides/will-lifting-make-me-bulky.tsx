import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "Will lifting heavy weights make women bulky?",
    a: "Almost never. Heavy, low-rep sets mostly build strength. Visible size takes years of high-volume training and eating more than you burn, on purpose.",
  },
  {
    q: "Why do I look bigger after starting to lift?",
    a: "Usually water and food. Worked muscles hold extra water for a week or two, and lifting can make you hungrier. Both settle, and the muscle you built stays.",
  },
  {
    q: "How long until I see results from lifting?",
    a: "Strength goes up within a few weeks. Changes in shape usually show after two or three months of steady training.",
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
  slug: "will-lifting-make-me-bulky",
  title: "Will lifting weights make me bulky?",
  dek: "Almost certainly not. Muscle comes on slowly, about a pound a month at best for a beginner, and you decide when to stop.",
  description:
    "Why lifting weights won't make you bulky: how fast muscle actually grows, where the bulky look comes from, why the scale can rise early, and how to start.",
  category: "Getting started",
  published: "2026-10-16",
  updated: "2026-10-16",
  readMinutes: 5,
  toc: [
    { id: "how-fast", label: "How fast muscle actually grows" },
    { id: "bulky-look", label: "Where the bulky look comes from" },
    { id: "scale", label: "Why the scale might go up early" },
    { id: "what-it-does", label: "What lifting does do" },
    { id: "start", label: "How to start" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
  hero: {
    alt: "Clay figure of a woman smiling at her flexed arm while holding a small dumbbell",
    fill: true,
  },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Almost certainly not.</strong> Muscle comes on slowly, especially for women, and a
          look most people would call bulky takes years of training and eating for that goal.
        </P>
        <P>
          In your first year, lifting will mostly make you stronger, change your shape a little,
          and make everyday things like carrying groceries feel easier.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="how-fast" title="How fast muscle actually grows">
          <P>
            A common coaching estimate is that a woman in her first year of lifting can add
            somewhere around half a pound to a pound of muscle a month. That's if training, sleep
            and food all go well. Men starting out gain faster, mostly because they have far more
            testosterone.
          </P>
          <P>
            A pound of muscle also takes up less room than a pound of fat, because muscle is
            denser. So a year of steady lifting might add 6 to 12 pounds of muscle spread across
            your whole body. On most people, that reads as fit.
          </P>
        </Section>

        <Section id="bulky-look" title="Where the bulky look comes from">
          <P>
            The very muscular women you see on Instagram and on bodybuilding stages got there on
            purpose. That usually means years of high-volume training, eating more food than they
            burn for long stretches, and a carefully timed cut before photos. In competitive
            bodybuilding, some also use drugs.
          </P>
          <P>None of that happens by accident from three gym sessions a week.</P>
          <P>
            When someone new to lifting feels bigger, the cause is usually eating more than before,
            sometimes because lifting makes you hungrier. The muscle you built is still there under
            it. If that bothers you, look at food first and keep lifting.
          </P>
        </Section>

        <Section id="scale" title="Why the scale might go up early">
          <P>
            In the first couple of weeks, your weight can rise by a pound or two. Sore, worked
            muscles hold extra water while they recover, and they store more carbohydrate, which
            also brings water with it.
          </P>
          <P>
            This settles down. Judge your first month by how your clothes fit and whether your
            lifts are going up, and leave the scale alone for a few weeks.
          </P>
        </Section>

        <Section id="what-it-does" title="What lifting does do">
          <P>
            You get stronger fast. Most beginners can add weight to their lifts every week or two
            for months, and that change shows up long before any change in size. Lifting also helps
            keep bone density up, which matters more every decade.
          </P>
        </Section>

        <InlineCta
          title="Watch your strength go up instead"
          body="Log your sets in LiftCamp and each exercise shows your history and records, so you can see the numbers climb while the mirror catches up."
        />

        <Section id="start" title="How to start">
          <P>
            Pick a full-body routine built mostly on compound lifts. Start light enough that every
            rep looks clean, using the{" "}
            <GuideLink slug="picking-your-starting-weight">starting weight guide</GuideLink>, and
            add weight a little at a time with{" "}
            <GuideLink slug="progressive-overload">progressive overload</GuideLink>.
          </P>
          <P>
            You stay in control the whole way. If you ever like your shape where it is, you can
            hold your weights steady and keep training to maintain it.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="Start with the 3-day full body routine"
          body="Two alternating workouts built on the main lifts, with a rest day between each session."
        />

        <RoutineLink
          slug="dumbbell-only-workout"
          label="Or the Dumbbell Only routine"
          body="The same idea with two dumbbells and a bench, for home or a busy gym."
        />

        <Section id="faq" title="Lifting and bulk FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
