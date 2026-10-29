import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "leg-press-setup",
  title: "How to set up the leg press: seat, feet and depth",
  seoTitle: "Leg press setup: seat, feet and depth",
  dek: "Set the seat so your knees reach about 90 degrees without your lower back lifting, put your feet mid platform at shoulder width, and stop before your hips curl under.",
  description:
    "Leg press setup for beginners. How to set the seat, where to put your feet, how deep to go, and what the sled weighs before you add plates.",
  category: "Technique",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 6,
  toc: [
    { id: "seat", label: "Set the seat first" },
    { id: "feet", label: "Where to put your feet" },
    { id: "height", label: "High or low on the platform" },
    { id: "depth", label: "How deep to go" },
    { id: "lockout", label: "The top of the rep" },
    { id: "weight", label: "What the sled weighs" },
    { id: "starting", label: "Starting weight and progression" },
    { id: "safety", label: "The safety catches" },
  ],
  hero: { alt: "Clay illustration of a leg press machine" },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>
            Set the seat so your knees bend to about 90 degrees at the bottom while your lower back
            stays flat against the pad.
          </strong>{" "}
          Seat position matters more than anything else on this machine and most people never touch
          it.
        </P>
        <P>
          Feet about shoulder width, middle of the platform, toes turned out very slightly. Push
          through your whole foot, not your toes.
        </P>
        <P>
          Stop lowering the moment your hips start to curl up off the seat, and add weight when you
          can do 3 sets of 12 with 2 reps left in you.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="seat" title="Set the seat first">
          <P>
            Almost every <ExerciseLink slug="leg-press">leg press</ExerciseLink> has an adjustable
            backrest or seat carriage. There is usually a lever or a pin on the side. People sit
            down in whatever position the last person left and never think about it again.
          </P>
          <P>
            Sit in, put your feet on the platform and lower the sled slowly with no weight or very
            light weight. Watch two things. Do your knees get to roughly a right angle? And does
            your lower back stay pressed against the pad the whole way?
          </P>
          <P>
            If your back lifts before the knees get there, the seat is too close. Move it back a
            notch. If your knees jam into your chest well before you have any range left, the seat
            is too far back and you are cutting yourself short.
          </P>
          <P>
            Do this once, note which notch, and you can set it in 5 seconds every session
            afterward.
          </P>
        </Section>

        <Section id="feet" title="Where to put your feet">
          <P>
            Shoulder width apart is the default and it is right for almost everyone starting out.
            Turn your toes out maybe 10 to 15 degrees, roughly the angle your feet sit at when you
            stand up naturally.
          </P>
          <P>
            Your knees should track over your feet as you lower. If they cave inward on the way up,
            think about pushing them out toward your little toes. Saying it out loud for the first
            few reps helps more than it sounds like it would.
          </P>
          <P>
            A wider stance brings your inner thigh into it more. A narrow stance shifts work toward
            the outside of your quads. Both are fine, and neither is worth chasing until the
            standard version feels solid.
          </P>
        </Section>

        <Section id="height" title="High or low on the platform">
          <P>This is the adjustment that changes the most, and it is worth understanding.</P>
          <P>
            <strong>Feet high on the platform</strong> puts more work through your glutes and
            hamstrings, and it lets your hips travel through a bigger range. It also tends to be
            kinder to the knees.
          </P>
          <P>
            <strong>Feet low on the platform</strong> shifts the work onto your quads and puts your
            knees through more bend. Some people love it and some people find their knees complain
            within a set.
          </P>
          <P>
            Start in the middle. If your knees are the thing that bothers you, move your feet up.
            If you want more quad and your knees are fine, move them down a little and see how the
            next session feels.
          </P>
          <Callout tone="note" title="Keep your heels down">
            Wherever you place your feet, your heels should stay in contact with the platform for
            the whole rep. If they lift as you lower, you have gone too deep or your feet are too
            low.
          </Callout>
        </Section>

        <Section id="depth" title="How deep to go">
          <P>
            The limit is not your knees, it is your pelvis. As the sled comes down, there is a point
            where your hips start to curl upward off the seat and your lower back rounds. That is
            where the set of this rep ends.
          </P>
          <P>
            Going past it is where leg press back injuries come from. Your spine is bent and loaded
            at the same time, with a few hundred pounds on top.
          </P>
          <P>
            Have a look at your hips on the first light set, or film one set from the side on your
            phone. Find the depth where the curl starts, come up an inch, and make that your bottom
            position.
          </P>
          <P>
            For most people that is around 90 degrees of knee bend. Some go deeper comfortably, some
            less. Yours is yours.
          </P>
        </Section>

        <InlineCta
          title="Write down the setup, not just the number"
          body="Seat notch 3, feet mid platform. Put it in the exercise notes in LiftCamp once and every future session starts from the position that worked."
        />

        <Section id="lockout" title="The top of the rep">
          <P>
            Do not snap your knees straight at the top. Push until your legs are almost straight,
            leave a small bend, and start the next rep.
          </P>
          <P>
            Locking out hard under heavy load puts the force through the joint rather than the
            muscle, and on a machine that can hold 500 lb that is a poor trade for a moment of rest.
          </P>
          <P>Keeping a slight bend also means your quads stay under tension the whole set.</P>
        </Section>

        <Section id="weight" title="What the sled weighs">
          <P>
            Before you add a single plate, the sled has its own weight. Depending on the machine
            that can be anywhere from about 25 lb to well over 100.
          </P>
          <P>
            Manufacturers rarely print it. So the number on the side of your leg press is not
            comparable to anyone else's, or to your own at a different gym.
          </P>
          <P>
            The practical answer: log the plates you loaded and nothing else. That number progresses
            correctly over time at your gym, which is the only thing it needs to do. Just do not
            treat it as a strength score to compare with a friend.
          </P>
          <P>
            The leg press is also the exercise where people quote the most inflated numbers, partly
            for this reason. Ignore all of it.
          </P>
        </Section>

        <Section id="starting" title="Starting weight and progression">
          <P>
            Start with one 45 lb plate per side for 2 sets of 10. If that moves easily, add another
            plate per side and try again. The first session is for finding your depth and your seat
            position, not for testing yourself.
          </P>
          <P>
            The leg press progresses fast early on, faster than most exercises, because there is
            little skill to it and nothing to balance. Adding 10 to 20 lb a week for the first
            couple of months is normal.
          </P>
          <P>
            Add weight when you finish 3 sets of 12 with about 2 reps left and your depth on the last
            set matches your depth on the first.
          </P>
        </Section>

        <Section id="safety" title="The safety catches">
          <P>
            Every leg press has handles or levers beside the seat that rotate stops into place. You
            unrack by pushing the sled up and rotating them out of the way, and you rack by rotating
            them back before you let the weight down.
          </P>
          <P>
            Learn where they are on the machine at your gym before your first heavy set, not during
            it. If you get stuck at the bottom of a rep with no stops engaged, your options are bad.
          </P>
          <P>
            If you are unsure, ask someone at the desk to show you once. It takes a minute and it is
            a normal thing to ask.
          </P>
        </Section>
      </Prose>
    </>
  );
}
