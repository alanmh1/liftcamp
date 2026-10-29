import { Link } from "@tanstack/react-router";
import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { InlineCta } from "@/components/guides/InlineCta";
import { RoutineLink } from "@/components/guides/RoutineLink";
import { Faq } from "@/components/guides/Faq";
import type { Guide } from "./types";

const FAQ = [
  {
    q: "How long does DOMS last?",
    a: "Usually 2 to 4 days. It tends to peak 24 to 72 hours after the workout, then fades.",
  },
  {
    q: "Can I work out while I'm sore?",
    a: "Yes, if it's mild. If a muscle is very sore, go lighter that day or train a different muscle.",
  },
  {
    q: "Why am I more sore on day 2 than day 1?",
    a: "That's the delayed part of delayed onset muscle soreness. The inflammation builds for a day or two before it settles.",
  },
  {
    q: "Does no soreness mean I didn't work hard enough?",
    a: "No. Your muscles adapt to a routine within a few weeks, so soreness drops even while you keep getting stronger. Track your weights and reps to see progress.",
  },
  {
    q: "Will I be this sore every time?",
    a: "No. Your first week or two is the worst. After that, the same workouts barely make you sore.",
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
  slug: "why-am-i-so-sore-after-lifting",
  title: "Why am I so sore after lifting?",
  dek: "It's called DOMS. It peaks a day or two after a workout, and it's worst in your first couple of weeks.",
  description:
    "Sore 1 to 3 days after a workout is DOMS. What causes it, why it's worst in your first weeks of lifting, and when soreness means something else.",
  category: "Getting started",
  published: "2026-10-29",
  updated: "2026-10-29",
  readMinutes: 5,
  toc: [
    { id: "what-it-is", label: "What DOMS is" },
    { id: "causes", label: "What causes it" },
    { id: "new-lifters", label: "Why it's worst when you're new" },
    { id: "what-to-do", label: "What to do about it" },
    { id: "get-it-checked", label: "Normal soreness or something else" },
    { id: "faq", label: "FAQ" },
  ],
  faq: FAQ,
  hero: {
    alt: "Clay figure of a woman in a gray sweatshirt wincing as she steps carefully down a short flight of stairs",
  },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Soreness a day or two after a workout is called DOMS</strong>, delayed onset
          muscle soreness. It comes from small amounts of damage in your muscle fibers, mostly from
          the lowering half of each rep, and the inflammation that follows while they repair.
        </P>
        <P>
          It usually peaks 24 to 72 hours after the workout and fades within a few days. It's
          worst in your first couple of weeks, because your muscles haven't done that work before.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="what-it-is" title="What DOMS is">
          <P>
            DOMS is the stiff, tender ache you feel in a muscle a day or two after training it.
            Your quads complain on the stairs. Your chest hurts when you reach for the seatbelt.
          </P>
          <P>
            The delay is the giveaway. You usually feel fine walking out of the gym. Soreness
            starts around 12 to 24 hours later, peaks between 24 and 72 hours, then fades over the
            next few days. If day 2 feels worse than day 1, that's normal.
          </P>
          <P>
            It feels like a dull ache spread across the whole muscle, on both sides of your body.
            It's worst when you first start moving and eases once you're warmed up.
          </P>
        </Section>

        <Section id="causes" title="What causes it">
          <P>
            DOMS comes from small amounts of damage inside muscle fibers when they do work they
            aren't used to. Over the next day or two, your body sends an inflammatory response to
            clean up and repair it. That inflammation makes nerve endings in the muscle more
            sensitive, and that's the ache.
          </P>
          <P>
            The lowering half of a rep does most of the damage. That's the part where the muscle
            lengthens while it's working, like lowering into a squat or letting a dumbbell down in
            a curl. Exercises with a long, loaded lowering phase, such as Romanian deadlifts,
            lunges and split squats, tend to leave people the most sore. Walking downhill does it
            too, which is why a hike can wreck your quads for days.
          </P>
          <P>
            Lactic acid isn't the cause. Your body clears lactate within about an hour of
            stopping, long before soreness starts. In one well-known study, people who ran
            downhill had the lowest lactate levels and the worst soreness afterward.
          </P>
          <P>The damage is minor and repairs on its own. It isn't a strain or a tear.</P>
        </Section>

        <Section id="new-lifters" title="Why it's worst when you're new">
          <P>
            The first time a muscle does a new kind of work, it gets the most damage and the most
            soreness. In your first week, every muscle you train is new to the job, so you feel all
            of them at once.
          </P>
          <P>
            Then your body adapts, fast. Researchers call it the repeated bout effect. One session
            of an exercise protects that muscle from most of the damage the next time you do it,
            and the protection lasts several weeks. It only applies to the muscles you trained.
          </P>
          <P>
            So your first one or two weeks are the sorest you'll be on a routine. By week 3 or 4,
            the same workouts usually leave you only a little stiff, even as the weights go up.
            Take a few weeks off and some of that protection fades, so start lighter when you come
            back. A brand new exercise can still make you sore months in.
          </P>
          <P>
            Soreness also isn't a sign of a good workout. Experienced lifters build muscle with
            very little of it, and research finds no strong link between how sore you get and how
            much muscle you build.
          </P>
        </Section>

        <InlineCta
          title="Week 1 is the hardest part"
          body="Log your sets in LiftCamp and you'll see the weights climb while the soreness fades. Most people who quit do it in the first sore week."
        />

        <Section id="what-to-do" title="What to do about it">
          <P>
            Time fixes DOMS. Nothing makes it disappear overnight, but a few things make the next
            few days easier.
          </P>
          <P>
            <strong>Keep moving.</strong> A walk, an easy bike ride or a light session eases the
            stiffness while you're doing it.
          </P>
          <P>
            <strong>Start lighter in week 1.</strong> Pick weights where you could do 2 or 3 more
            reps at the end of each set, using the{" "}
            <GuideLink slug="picking-your-starting-weight">starting weight guide</GuideLink>.
            You'll still get sore, just less.
          </P>
          <P>
            <strong>Train again on schedule.</strong> Mild soreness is fine to train through. If a
            muscle is very sore, go lighter or train a different muscle that day. The{" "}
            <GuideLink slug="how-many-days-a-week-to-lift">days per week guide</GuideLink> has
            schedules that leave room to recover.
          </P>
          <P>
            <strong>Sleep and eat normally.</strong> Repair happens on its own, and it goes better
            when you aren't short on either.
          </P>
          <P>
            Stretching feels nice, but a large review found it doesn't reduce soreness before or
            after exercise. Massage and foam rolling can give a little short-term relief.
          </P>
        </Section>

        <Section id="get-it-checked" title="Normal soreness or something else">
          <P>
            DOMS is a dull ache across the whole muscle, on both sides, in the muscles you
            trained. It eases as you warm up and is gone in 2 to 4 days.
          </P>
          <P>
            Get it looked at if the pain is sharp and in one spot, sits in a joint instead of a
            muscle, gets worse when you move, comes with swelling or bruising, or is still there
            after a week. Very dark, cola-colored urine with severe muscle pain after a hard
            workout needs a doctor the same day.
          </P>
        </Section>

        <RoutineLink
          slug="full-body-3-day"
          label="Start with the 3-day full body routine"
          body="Two alternating workouts with a rest day between each session, so sore muscles get time to recover."
        />

        <Section id="faq" title="Soreness FAQ">
          <Faq items={FAQ} />
        </Section>
      </Prose>
    </>
  );
}
