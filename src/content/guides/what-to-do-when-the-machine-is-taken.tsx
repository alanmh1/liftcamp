import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "what-to-do-when-the-machine-is-taken",
  title: "What to do when the machine you want is taken",
  dek: "Swap by movement pattern, not by muscle name. Here is the swap for every lift you are likely to be waiting for.",
  description:
    "How to substitute an exercise when the rack, bench or machine you planned to use is occupied, and how to ask to work in without it being awkward.",
  category: "Getting started",
  published: "2026-08-16",
  updated: "2026-08-16",
  readMinutes: 5,
  toc: [
    { id: "dont-wait", label: "Why waiting costs more than swapping" },
    { id: "the-rule", label: "Match the pattern, not the machine" },
    { id: "squat", label: "Squat swaps" },
    { id: "hinge", label: "Hinge swaps" },
    { id: "push", label: "Press swaps" },
    { id: "pull", label: "Pull swaps" },
    { id: "no-swap", label: "What does not swap cleanly" },
    { id: "working-in", label: "How to ask to work in" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          Swap to a different exercise that trains the same movement pattern, not the same
          muscle name. A squat swaps for another squat. A press swaps for another press.
        </P>
        <P>
          Waiting is almost always the worse choice. Six minutes standing next to an occupied
          rack costs you more than the difference between a barbell squat and a leg press,
          which is close to nothing when you're new.
        </P>
        <P>
          Every exercise page in the library lists two or three swaps at the bottom, each one
          picked by hand.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="dont-wait" title="Why waiting costs more than swapping">
          <P>
            The instinct is to wait, because the exercise you planned feels like the one that
            counts. At beginner weights it carries no special value.
          </P>
          <P>
            The difference between two exercises in the same pattern is smaller than the
            week-to-week variation in how strong you feel. A <ExerciseLink slug="leg-press">leg
            press</ExerciseLink> and a <ExerciseLink slug="barbell-squat">barbell
            squat</ExerciseLink> both make your legs stronger. Six months from now, when you're
            squatting something that took six months to build, the difference starts to matter.
            Right now it doesn't.
          </P>
          <P>
            What does matter is finishing the session. A workout that runs 80 minutes because of
            two long waits is a workout you're less likely to repeat next week, and repetition
            is what builds strength this early.
          </P>
        </Section>

        <Section id="the-rule" title="Match the pattern, not the machine">
          <P>
            There are five patterns, and any exercise in a pattern substitutes for any other.
          </P>
          <P>
            Squat: knees and hips bend together, quads do most of the work. Hinge: knees stay
            mostly straight, hips travel back, hamstrings and glutes do the work. Push: you move
            a weight away from your torso. Pull: you move a weight toward it. Carry or brace:
            you hold position while something tries to move you.
          </P>
          <P>
            Match the pattern and you keep the session intact. Matching the muscle name is how
            people end up replacing a squat with a leg extension, which trains one of the four
            muscles the squat trained.
          </P>
        </Section>

        <Callout title="The swaps are already on every exercise page">
          Open any exercise in the library and scroll to the beginner block. The
          bottom of it lists two or three swaps for that specific lift, each one
          written by hand.
        </Callout>


        <Section id="squat" title="Squat swaps">
          <P>
            If the rack is taken, the easiest swap is the <ExerciseLink slug="leg-press">leg
            press</ExerciseLink>, then the <ExerciseLink slug="hack-squat">hack
            squat</ExerciseLink>. Both are machines, so there's nothing to unrack and nothing to
            balance.
          </P>
          <P>
            If both are also busy, a <ExerciseLink slug="goblet-squat">goblet
            squat</ExerciseLink> needs one dumbbell and a patch of floor. A <ExerciseLink
            slug="dumbbell-squat">dumbbell squat</ExerciseLink> works the same way. If
            everything with a weight on it is occupied, a <ExerciseLink
            slug="bodyweight-squat">bodyweight squat</ExerciseLink> for sets of 15 to 20 is a
            genuine training stimulus at beginner strength levels.
          </P>
        </Section>

        <Section id="hinge" title="Hinge swaps">
          <P>
            The <ExerciseLink slug="barbell-deadlift">barbell deadlift</ExerciseLink> platform
            is usually the longest wait in the gym, because people set up slowly and rest for a
            long time.
          </P>
          <P>
            The <ExerciseLink slug="trap-bar-deadlift">trap bar deadlift</ExerciseLink> is the
            friendliest swap and is easier on your lower back while you're learning. The{" "}
            <ExerciseLink slug="leverage-deadlift">machine deadlift</ExerciseLink> gives you the
            same pattern on a machine. If you're after hamstrings specifically rather than a
            heavy pull, the <ExerciseLink slug="romanian-deadlift">Romanian
            deadlift</ExerciseLink> and the <ExerciseLink
            slug="stiff-legged-dumbbell-deadlift">stiff-legged dumbbell deadlift</ExerciseLink>
            both work with much less equipment.
          </P>
        </Section>

        <Section id="push" title="Press swaps">
          <P>
            Flat bench is the most contested station in most gyms, especially between 6 and 8 in
            the evening.
          </P>
          <P>
            The <ExerciseLink slug="dumbbell-bench-press">dumbbell bench press</ExerciseLink> is
            the better first version anyway, since each arm has to do its own work. The{" "}
            <ExerciseLink slug="machine-bench-press">machine chest press</ExerciseLink> needs no
            setup and no spotter. The <ExerciseLink slug="smith-machine-bench-press">Smith
            machine bench</ExerciseLink> is fine too, and it's usually free when the flat
            benches are not.
          </P>
          <P>
            For overhead work, the <ExerciseLink slug="barbell-shoulder-press">overhead
            press</ExerciseLink> swaps to the <ExerciseLink
            slug="dumbbell-shoulder-press">dumbbell shoulder press</ExerciseLink> or the{" "}
            <ExerciseLink slug="leverage-shoulder-press">machine shoulder press</ExerciseLink>
            without losing anything that matters at this stage.
          </P>
        </Section>

        <Section id="pull" title="Pull swaps">
          <P>
            Pulling has the most options, so it's the pattern least worth waiting for.
          </P>
          <P>
            Vertical pulls: <ExerciseLink slug="pullups">pull-ups</ExerciseLink>, <ExerciseLink
            slug="chin-up">chin-up</ExerciseLink>, <ExerciseLink
            slug="wide-grip-lat-pulldown">lat pulldown</ExerciseLink>, <ExerciseLink
            slug="close-grip-front-lat-pulldown">close-grip pulldown</ExerciseLink>,{" "}
            <ExerciseLink slug="one-arm-lat-pulldown">one-arm pulldown</ExerciseLink>. Any of
            them for any other.
          </P>
          <P>
            Horizontal pulls: <ExerciseLink slug="one-arm-dumbbell-row">one-arm dumbbell
            row</ExerciseLink>, <ExerciseLink slug="bent-over-barbell-row">bent over barbell
            row</ExerciseLink>, <ExerciseLink slug="seated-cable-rows">seated cable
            row</ExerciseLink>, <ExerciseLink slug="leverage-high-row">machine
            row</ExerciseLink>. The cable row is the easiest to learn because the machine holds
            you in position, and the one-arm dumbbell version is the one that fixes a strong
            side and a weak side.
          </P>
        </Section>

        <InlineCta title="Log the swap so you remember it" body="LiftCamp keeps the swapped exercise in your history with its own weights, so the next busy day you already know what worked." />

        <Section id="no-swap" title="What does not swap cleanly">
          <P>
            Two things don't swap cleanly.
          </P>
          <P>
            The first is anything you're doing for a specific reason a coach or physio gave you.
            If you're doing an exercise to work around an injury, sub it for something else and
            you're back to guessing.
          </P>
          <P>
            The second is the last set of a lift you're about to hit a new weight on. If you've
            been climbing for six weeks and today is the day, wait the six minutes. That's the
            one time the specific exercise really is the point.
          </P>
        </Section>

        <Section id="working-in" title="How to ask to work in">
          <P>
            You can also just ask, and most people say yes.
          </P>
          <P>
            The phrase is "mind if I work in?" That means alternating sets with them: they do a
            set, you do a set, and you both rest while the other works. It's normal, it's
            expected, and nobody who lifts regularly finds it rude.
          </P>
          <P>
            Two rules make it painless. Change the weight back to theirs when you're done, and
            don't ask someone who is visibly mid-set or wearing a lifting belt three plates in.
            The second one isn't a rule of etiquette so much as a read on whether they have the
            attention to spare.
          </P>
          <P>
            If asking feels impossible right now, that's fine too. Swap and move on. It gets
            easier around month three, and the swap costs you nothing in the meantime.
          </P>
        </Section>
      </Prose>
    </>
  );
}
