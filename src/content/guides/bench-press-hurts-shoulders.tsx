import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "bench-press-hurts-shoulders",
  title: "Bench press hurts my shoulders. What should I press instead?",
  dek: "Swap the barbell for incline dumbbells, keep your palms turned in, and stop above the depth that pinches.",
  description:
    "If the barbell bench press hurts your shoulders, here is what to press instead: incline dumbbell press setup, starting weight, machine options, and when to see a physio.",
  category: "Technique",
  published: "2026-08-24",
  updated: "2026-08-24",
  readMinutes: 6,
  toc: [
    { id: "the-bar", label: "What the bar decides for you" },
    { id: "caveat", label: "One honest caveat" },
    { id: "setup", label: "Setting up the incline dumbbell press" },
    { id: "starting-weight", label: "Starting weight" },
    { id: "machine", label: "The machine chest press" },
    { id: "decline", label: "Decline pressing" },
    { id: "week", label: "A week that works" },
    { id: "my-shoulder", label: "My shoulder" },
    { id: "tracking", label: "Keeping track of it" },
    { id: "see-someone", label: "When to see someone" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>
            Swap the <ExerciseLink slug="barbell-bench-press">barbell bench press</ExerciseLink>{" "}
            for the <ExerciseLink slug="incline-dumbbell-press">incline dumbbell
            press</ExerciseLink>.
          </strong>{" "}
          Dumbbells let each arm move on its own path, so your shoulder isn't locked into the
          width and angle the bar decides for it.
        </P>
        <P>
          If the incline still hurts, use a{" "}
          <ExerciseLink slug="leverage-chest-press">chest press machine</ExerciseLink> and
          shorten the range so you stop above the painful spot.
        </P>
        <P>
          Add weight when you can do 3 sets of 10 with control and about 2 reps left in you at
          the end of each set.
        </P>
        <P>
          If the pain has lasted more than 2 or 3 weeks, wakes you up at night, or comes with
          weakness or numbness down your arm, book a physio before you keep pressing. This
          guide is about training around a cranky shoulder, not diagnosing one.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="the-bar" title="What the bar decides for you">
          <P>
            Grip a barbell and four things get fixed at once. Your hands sit at one width for
            the whole set. Your wrists can't rotate, because both hands are attached to the same
            rigid object. Your elbows travel wherever the bar path puts them. And the bar stops
            at your chest every single rep, at the same depth, whether your shoulder feels fine
            that day or not.
          </P>
          <P>
            Your shoulder has to work with all of that. If the width or the depth happens to be
            somewhere your joint doesn't like, there's no room to adjust mid-set.
          </P>
          <P>
            Dumbbells give all four back. Your hands can rotate to a neutral grip. Each arm
            finds its own line. You can bring the weights closer together at the top or drift
            wider at the bottom. You decide how deep you go and you can stop 3 inches short on
            your left side if that's what feels good.
          </P>
          <P>
            Plenty of people bench for 20 years and never have a shoulder problem. If that's
            you, keep benching. This is for people whose shoulder complains every time they set
            up under a bar.
          </P>
        </Section>

        <Section id="caveat" title="One honest caveat">
          <P>
            No press is universally safer than another. There's no research showing incline
            dumbbells beat flat barbell for shoulder health, and I'd be careful with anyone who
            tells you otherwise.
          </P>
          <P>
            What matters is that you find a pressing variation you can do without pain, then
            load it consistently for months. A comfortable press you train hard beats a
            "correct" press you avoid or grind through.
          </P>
          <P>
            Some people find <ExerciseLink slug="dumbbell-bench-press">flat
            dumbbells</ExerciseLink> fine and inclines irritating. Try both.
          </P>
        </Section>

        <Section id="setup" title="Setting up the incline dumbbell press">
          <P>
            Set the bench to about 30 degrees. Most adjustable benches have a notch right around
            there. Steeper angles shift work onto the front of the shoulder, which is often the
            part that already hurts.
          </P>
          <P>
            Getting the dumbbells up is the part beginners fumble. Sit on the bench with a
            dumbbell standing on each thigh. Kick one knee up and lie back at the same time,
            letting the momentum carry the weight to your shoulder. Repeat with the other side.
            To finish, sit up and let them come back down to your thighs.
          </P>
          <P>Once you're set:</P>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-foreground/80">
            <li>
              Keep your elbows about 45 degrees out from your torso. Flaring them straight out to
              90 puts your shoulder in the position that bothers most people.
            </li>
            <li>
              Turn your palms slightly toward each other instead of facing straight forward. This
              alone fixes the pain for a lot of people.
            </li>
            <li>
              Lower until you feel a stretch across your chest, then press. If a certain depth
              pinches, stop above it. A shorter pain-free range you can add weight to over
              months is worth more than a full range you can only do once.
            </li>
          </ul>
        </Section>

        <Section id="starting-weight" title="Starting weight">
          <P>Start with 15 lb dumbbells. If 15 feels like a fight on the first set, use 10.</P>
          <P>
            Too heavy if you can't lower the weights under control for a slow 2 count, or if
            your last rep looks nothing like your first.
          </P>
          <P>
            Add 5 lb per hand when you hit 3 sets of 10 with about 2 reps left in the tank on
            each set. That's roughly every 2 to 4 weeks early on, then slower.
          </P>
        </Section>

        <InlineCta
          title="Log the swap so you can see it working"
          body="LiftCamp keeps your incline dumbbell press history with its own weights, so two months from now you can tell whether the new press is actually progressing."
        />

        <Section id="machine" title="The machine chest press">
          <P>
            Machines have a reputation problem among people who lift, and it's undeserved for
            beginners with a sore shoulder.
          </P>
          <P>
            You don't have to balance anything, so you can pay attention to how your shoulder
            feels instead of where the weights are drifting. You can push closer to failure
            without a spotter. And you can't drop it on yourself.
          </P>
          <P>
            The handle height is adjustable on most machines through the seat. Move the seat up
            and the handles sit lower on your chest, which changes the angle at your shoulder.
            Spend one session trying two or three seat heights and use whichever feels best.
          </P>
          <P>Two sets of 12 to 15 after your dumbbell work is plenty.</P>
        </Section>

        <Section id="decline" title="Decline pressing">
          <P>
            <ExerciseLink slug="decline-barbell-bench-press">Declines</ExerciseLink> put your
            shoulder in less flexion than flat or incline pressing, which is why some people
            with shoulder pain find them the most comfortable press in the gym.
          </P>
          <P>
            The catch is that most commercial gyms have 1 decline bench, or none. A{" "}
            <ExerciseLink slug="leverage-decline-chest-press">decline chest press
            machine</ExerciseLink> works the same way if your gym has one. If neither exists,
            skip it. You aren't missing anything you can't get elsewhere.
          </P>
        </Section>

        <Section id="week" title="A week that works">
          <P>Two pressing days:</P>
          <P>
            <strong>Day A:</strong> Incline dumbbell press, 3 sets of 8 to 10. Machine chest
            press, 2 sets of 12.
          </P>
          <P>
            <strong>Day B:</strong> Incline dumbbell press, 3 sets of 10 to 12 with a lighter
            weight. Decline or machine press, 2 sets of 12.
          </P>
          <P>
            That's it. Your chest doesn't know what implement is producing the tension. It
            responds to hard sets taken near failure, and dumbbells produce those fine.
          </P>
        </Section>

        <Section id="my-shoulder" title="My shoulder">
          <P>
            I benched through shoulder pain for about a year before I did anything about it. The
            pain showed up in the bottom of the rep, faded during the day, and came back the
            next time I pressed. Classic pattern for ignoring it.
          </P>
          <P>
            I ended up seeing a physio. What helped was a few months of loading the shoulder in
            positions I'd been avoiding, plus dropping the barbell bench entirely. I haven't
            done a barbell bench press in about 3 years. Incline dumbbells are my only main
            press now, with machine work after, and the shoulder hasn't bothered me since.
          </P>
          <P>
            I'm one person and this isn't a treatment plan. What I'd pass on: the physio was
            worth the money, and giving up an exercise I thought I needed cost me nothing.
          </P>
        </Section>

        <Section id="tracking" title="Keeping track of it">
          <P>
            Swapping exercises only works if you can see whether the new one is progressing. Two
            months of incline dumbbell press should show up as more weight or more reps, and it's
            hard to judge that from memory.
          </P>
          <P>
            I built LiftCamp for this. Every exercise has a starting weight, a note on what to do
            when it feels too heavy, and substitution options when a movement bothers you. It
            logs your sets so the progression is visible instead of guessed at. It's free and
            runs in your browser.
          </P>
          <P>
            A notebook works too. Write down the weight and the reps every session, and you'll
            have the same information.
          </P>
        </Section>

        <Section id="see-someone" title="When to see someone">
          <P>Book an appointment if:</P>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-foreground/80">
            <li>The pain has been there longer than 2 or 3 weeks and isn't improving</li>
            <li>It wakes you up or hurts when you lie on that side</li>
            <li>
              Reaching overhead or behind your back hurts in daily life, not just in the gym
            </li>
            <li>The arm feels weak, or you get numbness or tingling</li>
            <li>
              There was a specific moment it went, like a pop or a heavy rep that felt wrong
            </li>
          </ul>
          <Callout tone="warning" title="This is not medical advice">
            A physio can tell you what's going on in one visit. Guessing on the internet takes
            months and often gets it wrong.
          </Callout>
        </Section>
      </Prose>
    </>
  );
}
