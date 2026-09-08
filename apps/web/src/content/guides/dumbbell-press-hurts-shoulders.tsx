import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "dumbbell-press-hurts-shoulders",
  title: "Dumbbell press hurts my shoulder. What now?",
  dek: "Drop the bench angle to 15 or 30 degrees, turn your palms in, and stop the weights level with your chest instead of below it.",
  description:
    "If the dumbbell bench press or incline dumbbell press hurts your shoulder, here is what to change: bench angle, grip, depth, how to get the weights up, and what to press instead.",
  category: "Technique",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 6,
  toc: [
    { id: "angle", label: "The bench angle" },
    { id: "grip", label: "Turn your palms in" },
    { id: "depth", label: "How far down to go" },
    { id: "getting-them-up", label: "Getting the weights into position" },
    { id: "machine", label: "When to use a machine instead" },
    { id: "week", label: "A week that works" },
    { id: "tracking", label: "Keeping track of it" },
    { id: "see-someone", label: "When to see someone" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Set the bench to 15 or 30 degrees, not 45.</strong> Most shoulder pain on the{" "}
          <ExerciseLink slug="incline-dumbbell-press">incline dumbbell press</ExerciseLink> comes
          from a steep bench, which pushes the work onto the front of the shoulder.
        </P>
        <P>
          Turn your palms toward each other rather than facing forward, and stop each rep with the
          weights level with your chest instead of dropping below it.
        </P>
        <P>
          If those three changes do not help within 2 sessions, press on a{" "}
          <ExerciseLink slug="leverage-chest-press">chest press machine</ExerciseLink> with a
          shortened range while you sort the shoulder out.
        </P>
        <P>
          If the pain has lasted more than 2 or 3 weeks, wakes you at night, or comes with weakness
          or numbness down the arm, see a physio before you keep pressing.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="angle" title="The bench angle">
          <P>
            Adjustable benches usually have 4 or 5 notches. People pick the middle one because it
            looks like the default, and the middle one is often close to 45 degrees.
          </P>
          <P>
            The steeper the bench, the more your upper arm has to travel up past your torso to
            reach the top of the rep. That position is where a lot of shoulders complain. At 45
            degrees you are most of the way to an overhead press, and if overhead pressing bothers
            you, incline will too.
          </P>
          <P>
            Go to the first or second notch instead. Somewhere between 15 and 30 degrees still
            works the upper chest and asks a lot less of the shoulder. Your numbers will be higher
            there as well, which is a hint about how much the steep angle was costing you.
          </P>
          <P>
            Flat is worth trying too. Some people find{" "}
            <ExerciseLink slug="dumbbell-bench-press">flat dumbbell press</ExerciseLink>{" "}
            comfortable and every incline irritating. There is no single angle that is correct for
            everyone, and the one that does not hurt is the one to train.
          </P>
        </Section>

        <Section id="grip" title="Turn your palms in">
          <P>
            Pressing with your palms facing straight forward rotates your upper arm bone outward
            and puts your elbows wide. Combine that with a deep rep and you are in the position
            most likely to pinch.
          </P>
          <P>
            Rotate the dumbbells maybe 30 to 45 degrees so your palms angle toward each other. Your
            elbows will naturally tuck closer to your ribs. For a lot of people this one change
            removes the pain by itself, and it costs nothing.
          </P>
          <P>
            You can go all the way to a full neutral grip, palms facing each other like a hammer
            curl. Some gyms have{" "}
            <ExerciseLink slug="dumbbell-bench-press-with-neutral-grip">
              neutral grip dumbbell press
            </ExerciseLink>{" "}
            listed as its own exercise for exactly this reason. It presses the same muscles.
          </P>
        </Section>

        <Section id="depth" title="How far down to go">
          <P>
            The advice to get a big stretch at the bottom is aimed at people whose shoulders feel
            fine. If yours does not, the bottom of the rep is usually where it starts.
          </P>
          <P>
            Stop when the dumbbells are roughly level with your chest. Not 6 inches below it. You
            lose a little range and you keep the ability to press twice a week for the next 6
            months, which is the trade worth making.
          </P>
          <P>
            One way to find your depth: lower slowly until you feel the first hint of the pinch,
            then come up 2 inches and make that your bottom position for every rep. Reassess in a
            month. Range often comes back on its own once the irritation settles.
          </P>
        </Section>

        <Section id="getting-them-up" title="Getting the weights into position">
          <P>
            This part causes more shoulder trouble than the pressing does, and almost nobody
            mentions it.
          </P>
          <P>
            Hauling two 40 lb dumbbells up from the floor to your shoulders while lying back is a
            fast, uncontrolled movement at the exact joint angle that already hurts. Doing that
            twice per set, 4 sets a session, adds up.
          </P>
          <P>
            The safe version: sit on the end of the bench with a dumbbell standing upright on each
            thigh. Kick one knee up and lie back at the same time so the leg does the work of
            lifting the weight to your shoulder. Repeat with the other side. To finish a set, bring
            the weights back to your thighs and sit up rather than dropping them.
          </P>
          <P>
            If you cannot do that cleanly with the weight you have picked, the weight is too heavy
            for now.
          </P>
        </Section>

        <InlineCta
          title="Log the angle, not just the weight"
          body="A note like 'incline, 2nd notch, palms in' in LiftCamp means next week you repeat the setup that did not hurt instead of guessing at it."
        />

        <Section id="machine" title="When to use a machine instead">
          <P>
            If the bench angle, the grip and the depth all fail to help, stop pressing with free
            weights for a few weeks. This is not a setback, it is how you keep training the muscle
            while the joint calms down.
          </P>
          <P>
            A <ExerciseLink slug="leverage-chest-press">chest press machine</ExerciseLink> fixes
            the path so you can spend your attention on how the shoulder feels rather than on
            balancing anything. Most have a seat adjustment, and moving the seat up drops the
            handles lower on your chest, which changes the shoulder angle. Spend one session trying
            2 or 3 seat heights.
          </P>
          <P>
            You can also shorten the range on a machine easily by simply not letting the stack
            touch down. That is harder to do honestly with dumbbells.
          </P>
          <P>
            <ExerciseLink slug="machine-bench-press">Machine bench press</ExerciseLink> and{" "}
            <ExerciseLink slug="leverage-decline-chest-press">
              decline machine chest press
            </ExerciseLink>{" "}
            are both worth a try. Declines put the shoulder in less flexion than flat or incline,
            which is why some people with cranky shoulders find them the most comfortable press in
            the building.
          </P>
        </Section>

        <Section id="week" title="A week that works">
          <P>Two pressing days, neither of them heavy enough to aggravate anything:</P>
          <P>
            <strong>Day A:</strong> Incline dumbbell press at 15 to 30 degrees, palms in, 3 sets of
            8 to 10. Machine chest press, 2 sets of 12.
          </P>
          <P>
            <strong>Day B:</strong> Flat dumbbell press with a neutral grip, 3 sets of 10 to 12.
            Machine or decline press, 2 sets of 12.
          </P>
          <P>
            Add 5 lb per hand when you finish all sets with about 2 reps left in you and no pain
            during or the day after. Early on that is every 2 to 4 weeks. Later it slows down, and
            that is normal.
          </P>
        </Section>

        <Section id="tracking" title="Keeping track of it">
          <P>
            The hard part of training around a sore joint is telling whether it is improving. Pain
            is a bad memory. You will swear last month was worse without any way to check.
          </P>
          <P>
            Write down the weight, the reps, and one word about how the shoulder felt, every
            session. After 6 weeks you can look back and see a real trend instead of a feeling.
          </P>
          <P>
            LiftCamp does this on your phone and is free. A notebook works the same way. What
            matters is that the record exists.
          </P>
        </Section>

        <Section id="see-someone" title="When to see someone">
          <P>Book an appointment if:</P>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-foreground/80">
            <li>The pain has been there longer than 2 or 3 weeks and is not improving</li>
            <li>It wakes you up, or hurts when you lie on that side</li>
            <li>Reaching overhead or behind your back hurts outside the gym too</li>
            <li>The arm feels weak, or you get numbness or tingling</li>
            <li>There was a specific moment it went, like a pop or a rep that felt wrong</li>
          </ul>
          <Callout tone="warning" title="This is not medical advice">
            A physio can usually tell you what is going on in one visit. Working it out from the
            internet takes months and often gets it wrong.
          </Callout>
        </Section>
      </Prose>
    </>
  );
}
