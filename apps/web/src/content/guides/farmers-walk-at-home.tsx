import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "farmers-walk-at-home",
  title: "How to do farmers walks at home",
  dek: "Two heavy things, one in each hand, walk until your grip is about to go. Dumbbells work, and so do water jugs, buckets and a loaded suitcase.",
  description:
    "Farmers walks at home without a trap bar or farmers handles: what to carry, how heavy, how far, what to do in a small space, and how to progress it.",
  category: "Programming",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 5,
  toc: [
    { id: "what-it-does", label: "What it actually trains" },
    { id: "what-to-carry", label: "What to carry" },
    { id: "how-heavy", label: "How heavy" },
    { id: "how-far", label: "How far, and for how long" },
    { id: "small-space", label: "If you only have one room" },
    { id: "form", label: "How to carry it" },
    { id: "progress", label: "Making it harder over time" },
  ],
  hero: { alt: "Clay illustration of two gallon water jugs" },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Pick up something heavy in each hand and walk.</strong> Two dumbbells are the
          obvious choice. Two water jugs, two buckets with sand in them, or a suitcase in each hand
          all work the same way.
        </P>
        <P>
          Aim for 30 to 40 seconds of walking per set, 3 or 4 sets. Stop when your grip is about to
          fail, not after it has.
        </P>
        <P>
          If you run out of floor, walk back and forth, or stand still and hold. A stationary hold
          trains the same thing.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="what-it-does" title="What it actually trains">
          <P>
            The <ExerciseLink slug="farmers-walk">farmers walk</ExerciseLink> is the simplest
            exercise in the gym and one of the few that trains several things at once without any
            technique to learn.
          </P>
          <P>
            Your grip gives out first, which is the point. Grip strength is the limiting factor in
            rows, pull ups and deadlifts for a lot of beginners, and carrying heavy things is the
            fastest way to fix it.
          </P>
          <P>
            Your traps and upper back hold your shoulders in place against the pull. Your abs and
            obliques stop you tipping sideways. Your legs move you. It ends up being one of the more
            tiring things you can do in 40 seconds.
          </P>
          <P>
            It also carries over to real life more directly than almost anything else. Groceries,
            luggage, a toddler in a car seat.
          </P>
        </Section>

        <Section id="what-to-carry" title="What to carry">
          <P>
            <strong>Dumbbells or kettlebells</strong> if you have them. Easiest to hold, easy to
            progress, easy to put down.
          </P>
          <P>
            <strong>Water jugs.</strong> A 5 gallon jug is about 42 lb full. The handle is thin,
            which makes it harder on the grip than the same weight in a dumbbell, and you can pour
            some out to adjust.
          </P>
          <P>
            <strong>Buckets with sand or gravel.</strong> Cheap and adjustable. A 5 gallon bucket
            filled with sand lands around 60 to 70 lb, so start with it half full.
          </P>
          <P>
            <strong>A loaded suitcase or a backpack in each hand.</strong> Whatever you own that has
            a handle and can take weight. Books work.
          </P>
          <P>
            <strong>A sandbag or a heavy shopping bag.</strong> Awkward loads shift as you move,
            which makes your core work harder for the same weight.
          </P>
          <Callout tone="warning" title="Check the handle">
            Whatever you carry, load it and lift it 6 inches off the floor before you walk anywhere.
            Bucket handles and cheap luggage handles do fail, and a 60 lb bucket landing on a bare
            foot is a genuinely bad afternoon.
          </Callout>
        </Section>

        <Section id="how-heavy" title="How heavy">
          <P>
            Heavy enough that your grip is fading by 30 seconds. If you can walk for 2 minutes, it
            is too light and you are doing cardio.
          </P>
          <P>
            A rough starting point: something around a quarter of your bodyweight in each hand. If
            you weigh 160 lb, try 40 lb per side. Adjust from there on the first set rather than
            planning it out.
          </P>
          <P>
            Getting to half your bodyweight per hand is a reasonable medium term goal, and at that
            point most people find their grip has stopped being the weak link in everything else
            they do.
          </P>
        </Section>

        <Section id="how-far" title="How far, and for how long">
          <P>
            Time is easier to manage at home than distance. Set a 30 second timer and walk until it
            goes.
          </P>
          <P>
            Three or four sets, with 90 seconds to 2 minutes of rest between them. Your grip needs
            longer to recover than you expect, and a second set with a half recovered grip is a
            wasted set.
          </P>
          <P>
            Twice a week is plenty. Put it at the end of a session, because doing it first will
            leave your grip too fried for rows and pulldowns.
          </P>
        </Section>

        <InlineCta
          title="Log carries as weight and time"
          body="Record the weight per hand and the seconds walked. Two months of that shows a clear line, which is hard to see from memory with an exercise that has no reps."
        />

        <Section id="small-space" title="If you only have one room">
          <P>
            You do not need a long hallway. Three options, all of which work.
          </P>
          <P>
            <strong>Shuttle walks.</strong> Pick two points 15 or 20 feet apart and go back and
            forth until the timer goes. The turns add a bit of difficulty, since changing direction
            under load asks more of your core.
          </P>
          <P>
            <strong>Static holds.</strong> Stand still and hold. Your grip, traps and core all still
            get the work. Only your legs miss out, and they were the least important part here.
          </P>
          <P>
            <strong>Suitcase carry.</strong> Weight in one hand only. Your obliques on the opposite
            side have to fight the lean, so it is harder on the core at half the total load. Useful
            when you only own one heavy object.
          </P>
        </Section>

        <Section id="form" title="How to carry it">
          <P>
            Stand tall. The instinct under load is to hunch, and hunching is what makes your neck
            sore the next day.
          </P>
          <P>
            Pull your shoulders back and down slightly, like you are trying to tuck your shoulder
            blades into your back pockets. Chest up, eyes forward rather than at your feet.
          </P>
          <P>
            Take shorter steps than you normally would. Long strides make you sway side to side, and
            the sway is what tips over a heavy carry.
          </P>
          <P>
            Breathe. It sounds obvious, but people hold their breath for the entire walk and wonder
            why 30 seconds felt like a minute.
          </P>
          <P>
            To finish, put the weights down under control by bending your knees and hips, not by
            bending your back and dropping them.
          </P>
        </Section>

        <Section id="progress" title="Making it harder over time">
          <P>In order of what to change first:</P>
          <P>
            <strong>Add time.</strong> Go from 30 seconds to 45 at the same weight. Easiest change
            and it needs no new equipment.
          </P>
          <P>
            <strong>Add weight.</strong> Once you can do 45 seconds comfortably, go heavier and drop
            back to 30.
          </P>
          <P>
            <strong>Make the handle thicker.</strong> Wrap a towel around the handle. This makes the
            same weight dramatically harder to hold and is the cheapest way to progress once you run
            out of heavy objects.
          </P>
          <P>
            <strong>Stop using straps if you started with them.</strong> Straps let you carry more,
            but they take your grip out of the exercise, which was the main reason to do it.
          </P>
        </Section>
      </Prose>
    </>
  );
}
