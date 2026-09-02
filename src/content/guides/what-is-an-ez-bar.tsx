import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "what-is-an-ez-bar",
  title: "What is an EZ bar, and when should you use one?",
  dek: "The short bar with the zigzag in the middle. The bends let your wrists turn slightly inward, which takes the strain off them during curls and triceps work.",
  description:
    "What an EZ bar is, how much it weighs, which exercises it is for, where to grip it, and when a straight bar or dumbbells are the better choice.",
  category: "Getting started",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 5,
  toc: [
    { id: "what", label: "What it is" },
    { id: "why", label: "Why the bends are there" },
    { id: "weight", label: "How much it weighs" },
    { id: "grip", label: "Where to grip it" },
    { id: "exercises", label: "What to use it for" },
    { id: "versus", label: "EZ bar, straight bar or dumbbells" },
    { id: "fixed", label: "Fixed weight EZ bars" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>An EZ bar is a short barbell with two bends in the middle.</strong> The bends let
          you hold it with your palms angled slightly toward each other instead of facing straight
          up.
        </P>
        <P>
          Use it for curls and triceps extensions, especially if a straight bar makes your wrists or
          elbows ache.
        </P>
        <P>
          Most weigh 15 to 25 lb, but there is no standard, so check yours before you log a number.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="what" title="What it is">
          <P>
            Walk past the barbell rack and there is usually one bar that is shorter than the rest
            with a wavy section in the middle. That is the EZ bar. You will also see it called an EZ
            curl bar, a curl bar, or a cambered bar, and they all mean the same thing.
          </P>
          <P>
            It takes standard plates on the ends like any other barbell, and it is normally 4 to 5
            feet long rather than the 7 feet of an Olympic bar. Some gyms keep a rack of fixed
            weight ones instead, where the plates are welded on.
          </P>
        </Section>

        <Section id="why" title="Why the bends are there">
          <P>
            Hold a straight bar for a curl and your palms face directly up, which means your forearm
            bones are fully rotated. Hold that position under load for 10 reps and a lot of people
            feel it in the wrist or the inside of the elbow.
          </P>
          <P>
            The bends let each hand sit at maybe 20 to 30 degrees of rotation instead of 90. Your
            wrist stays in a more neutral position and the strain drops.
          </P>
          <P>
            If curls have never bothered your wrists, you are not missing anything by using a
            straight bar. The EZ bar solves a specific problem rather than being an upgrade.
          </P>
        </Section>

        <Section id="weight" title="How much it weighs">
          <P>
            There is no standard, which surprises people. Common EZ bars land between 15 and 25 lb.
            Heavier ones exist, and some cheap ones are closer to 10.
          </P>
          <P>
            The Olympic style ones with rotating sleeves and 2 inch ends are usually at the top of
            that range. The thinner standard ones with 1 inch ends are usually at the bottom.
          </P>
          <P>
            Weigh it if you can, or ask at the desk. If neither is possible, assume 20 lb and use
            that number every session from then on.
          </P>
          <Callout tone="note" title="Consistency beats accuracy">
            Being 5 lb wrong forever costs you nothing, because every session is wrong by the same 5
            lb and your progress still shows correctly. Changing your assumption halfway through is
            what ruins a training log.
          </Callout>
        </Section>

        <Section id="grip" title="Where to grip it">
          <P>
            The zigzag gives you two or three natural hand positions, and they are not
            interchangeable.
          </P>
          <P>
            <strong>The outer bends, closer to the plates.</strong> Wider grip, more rotation in the
            hands, closest to a straight bar. Hits the inner part of the biceps a little more.
          </P>
          <P>
            <strong>The inner bends, closer to the middle.</strong> Narrower grip with your palms
            angled in further. This is the more comfortable one for most people and the one to start
            with.
          </P>
          <P>
            Try both for a set each and use whichever your wrists prefer. Then stick with it, so
            your weights stay comparable week to week.
          </P>
        </Section>

        <InlineCta
          title="Two bars, two histories"
          body="LiftCamp keeps the EZ bar curl and the straight bar curl as separate exercises, so switching bars does not look like you got weaker."
        />

        <Section id="exercises" title="What to use it for">
          <P>
            <strong>
              <ExerciseLink slug="ez-bar-curl">EZ bar curl</ExerciseLink>
            </strong>
            . The main one. Same movement as a{" "}
            <ExerciseLink slug="barbell-curl">barbell curl</ExerciseLink>, easier on the wrists.
            Keep your elbows near your sides and do not swing your back to get the last rep up.
          </P>
          <P>
            <strong>Lying triceps extension</strong>, also called a skullcrusher. Lie on a bench,
            bar over your chest, bend at the elbows to bring it toward your forehead, then extend.
            The angled grip helps a lot here because the straight bar version is notorious for
            elbow ache.
          </P>
          <P>
            <strong>Close grip press</strong>. Hands on the inner bends, press like a bench press
            with your elbows tucked. Mostly triceps.
          </P>
          <P>
            <strong>Preacher curl</strong>, if your gym has the bench for it. The EZ bar is the
            standard choice for that machine and the pad removes any chance of swinging.
          </P>
        </Section>

        <Section id="versus" title="EZ bar, straight bar or dumbbells">
          <P>
            <strong>Straight bar</strong> lets you load the most weight and keeps both hands doing
            exactly the same thing. Use it if it does not hurt.
          </P>
          <P>
            <strong>EZ bar</strong> is the same exercise with a friendlier wrist position. Slightly
            less weight, considerably less complaining from your joints.
          </P>
          <P>
            <strong>
              <ExerciseLink slug="dumbbell-bicep-curl">Dumbbells</ExerciseLink>
            </strong>{" "}
            let each arm move independently and let you rotate your wrist through the rep. Best if
            one arm is noticeably stronger than the other, or if both bars bother you.
          </P>
          <P>
            None of these is meaningfully better for building biceps. Pick the one you can do
            comfortably for the next 6 months and add weight to it.
          </P>
        </Section>

        <Section id="fixed" title="Fixed weight EZ bars">
          <P>
            Many gyms have a rack of pre loaded EZ bars, usually running from about 20 lb up to 60
            or 70 lb in 10 lb steps.
          </P>
          <P>
            The number painted on the bar is the total, so there is nothing to work out. That is the
            one case where the bar weight question does not apply.
          </P>
          <P>
            The gap between them is the annoying part. Going from 30 to 40 lb is a 33% jump, which
            is a lot for a curl. If you are stuck between two, use the lighter one and add reps until
            the heavier one is manageable.
          </P>
        </Section>
      </Prose>
    </>
  );
}
