import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { ExerciseList } from "@/components/guides/ExerciseRow";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "How long does it take to do your first pull-up?",
    a: "Most beginners who practice twice a week get their first full rep in two to three months. Starting heavier or with less upper body strength can take longer, and that's normal.",
  },
  {
    q: "Are chin-ups easier than pull-ups?",
    a: "Yes, for most people. Palms facing you brings your biceps in to help, so most people get their first chin-up a few weeks before their first pull-up.",
  },
  {
    q: "Do negative pull-ups work?",
    a: "Yes. You're stronger lowering a weight than lifting it, so you can practice the full range of motion before you can pull yourself up. Three slow negatives at the end of a session, twice a week, is enough.",
  },
  {
    q: "Is the lat pulldown enough to get a pull-up?",
    a: "It builds the muscles, but it doesn't teach you to move your own bodyweight. Pair it with assisted pull-ups or negatives so the strength carries over to the bar.",
  },
  {
    q: "How often should I practice pull-ups?",
    a: "Two or three times a week, with a rest day between. Your back and arms need about two days to recover from hard pulling work.",
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
  slug: "pull-up-progression",
  title: "Pull-up progression for beginners",
  seoTitle: "Pull-Up Progression for Beginners",
  dek: "Four stages from zero pull-ups to your first full rep, with the exercises for each one and when to move on.",
  description:
    "A pull-up progression for beginners in four stages. Build pulling strength, do assisted reps, add negatives and chin-ups, then get your first full pull-up.",
  category: "Technique",
  published: "2026-11-02",
  updated: "2026-11-02",
  readMinutes: 6,
  toc: [
    { id: "why-hard", label: "Why pull-ups are hard at first" },
    { id: "stage-1", label: "Stage 1. Build pulling strength" },
    { id: "stage-2", label: "Stage 2. Assisted pull-ups" },
    { id: "stage-3", label: "Stage 3. Negatives and chin-ups" },
    { id: "stage-4", label: "Stage 4. Your first pull-up" },
    { id: "week", label: "A sample week" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Build up in four stages.</strong> Start with lat pulldowns, inverted rows and
          scapular pull-ups. Move to assisted pull-ups, then add slow negatives and chin-ups, and
          finish with single full pull-ups.
        </P>
        <P>
          Practice twice a week and move to the next stage when you hit the target for the one
          you're on. Most beginners get their first rep in two to three months.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="why-hard" title="Why pull-ups are hard at first">
          <P>
            A pull-up asks you to lift your whole bodyweight with your back and arms. Most exercises
            let you start with a light weight and build up. On a pull-up, the lightest weight is
            you.
          </P>
          <P>
            So the progression works by taking some of your bodyweight away, then giving it back a
            little at a time. Being unable to do one yet is the normal starting point for most
            adults, and it says nothing about how strong you'll get.
          </P>
        </Section>

        <Section id="stage-1" title="Stage 1. Build pulling strength">
          <P>
            Spend your first few weeks building the muscles with exercises where you can set the
            load. Do all three, twice a week.
          </P>
          <ExerciseList
            items={[
              {
                slug: "wide-grip-lat-pulldown",
                name: "Lat Pulldown",
                note: "3 sets of 8 to 10. The same pull as a pull-up with a weight you choose.",
              },
              {
                slug: "inverted-row",
                name: "Inverted Row",
                note: "3 sets of 8 to 10 under a bar at hip height. Lower the bar to make it harder.",
              },
              {
                slug: "scapular-pull-up",
                name: "Scapular Pull-Up",
                note: "3 sets of 8 from a hang. Teaches the first inch of every pull-up.",
              },
            ]}
          />
          <P>
            If hanging from the bar is hard on your grip, add a dead hang at the end. Hang with your
            arms straight for as long as you can, three times. Working up to 30 seconds makes every
            later stage easier.
          </P>
          <P>
            <strong>Move on when</strong> you can do 3 sets of 12 scapular pull-ups and your lat
            pulldown weight is close to two-thirds of your bodyweight.
          </P>
        </Section>

        <Section id="stage-2" title="Stage 2. Assisted pull-ups">
          <P>
            Now do the real movement with help. The{" "}
            <ExerciseLink slug="assisted-pull-up-machine">assisted pull-up machine</ExerciseLink>{" "}
            works backwards, so a higher number on the stack means more help. Start with roughly
            half your bodyweight and lower it one plate at a time once you can do 3 sets of 10.
          </P>
          <P>
            No machine? A{" "}
            <ExerciseLink slug="band-assisted-pull-up">band-assisted pull-up</ExerciseLink> does the
            same job. Start with the thickest band, and move to a thinner one when 3 sets of 8 look
            clean.
          </P>
          <Callout title="Pick the help you can control">
            Choosing too little assistance and thrashing through each rep builds bad habits. A rep
            you control with more help is worth more than a messy one with less.
          </Callout>
          <P>
            <strong>Move on when</strong> you can do 3 sets of 8 with about a quarter of your
            bodyweight as assistance, or with your second-thinnest band.
          </P>
        </Section>

        <Section id="stage-3" title="Stage 3. Negatives and chin-ups">
          <P>
            Negatives train the lowering half of the pull-up, which you're strong enough for before
            you can pull yourself up. Step onto a box or jump so your chin starts over the bar, then
            lower yourself as slowly as you can, aiming for 5 seconds. Do 3 sets of 3 at the end of
            your session.
          </P>
          <P>
            Start trying{" "}
            <ExerciseLink slug="chin-up">chin-ups</ExerciseLink> here too, with your palms facing
            you. Your biceps help more, so most people get a chin-up a few weeks before a pull-up.
            Keep doing your assisted pull-ups alongside.
          </P>
          <P>
            <strong>Move on when</strong> you can lower yourself in a full 5 seconds on every
            negative, or you can do your first chin-up.
          </P>
        </Section>

        <Section id="stage-4" title="Stage 4. Your first pull-up">
          <P>
            Test a full{" "}
            <ExerciseLink slug="pullups">pull-up</ExerciseLink> at the start of a session, when
            you're fresh. Hang from straight arms, pull until your chin clears the bar, and lower
            under control.
          </P>
          <P>
            Once you have one, build to several with short sets. Do 5 sets of 1 or 2 with plenty
            of rest, then slowly add reps. When you can do sets of 5, add reps before you think
            about adding weight.
          </P>
        </Section>

        <InlineCta
          title="See every assisted rep add up"
          body="Log your assisted pull-ups in LiftCamp and the exercise screen charts your sets over time, so you can watch the assistance drop week by week."
        />

        <Section id="week" title="A sample week">
          <P>
            Pull-ups fit into whatever routine you already follow. Put two pulling sessions in your
            week with at least a day between them, for example Monday and Thursday.
          </P>
          <P>
            In each one, do the pull-up stage you're on first, while you're fresh, then the rest of
            your workout. Finish with negatives once you reach stage 3. If you're not following a
            routine yet, the{" "}
            <GuideLink slug="beginner-full-body-workout">beginner full body workout</GuideLink>{" "}
            covers the rest of your body.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="Pair it with the 3-day full body routine"
          body="Three sessions a week built on the main lifts, with room for pull-up practice at the start of two of them."
        />

        <Section id="faq" title="Pull-up progression FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
