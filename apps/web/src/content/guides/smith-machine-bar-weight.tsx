import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "smith-machine-bar-weight",
  title: "How much does the Smith machine bar weigh?",
  dek: "Usually somewhere between 15 and 25 lb, not the 45 lb of a free barbell. It varies by machine, so find your gym's number once and keep using it.",
  description:
    "The Smith machine bar does not weigh 45 lb. Here is why, roughly what it does weigh, how to find the number at your gym, and how to log it so your progress stays comparable.",
  category: "Getting started",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 5,
  toc: [
    { id: "why", label: "Why it is not 45 lb" },
    { id: "range", label: "The range you will see" },
    { id: "finding", label: "Finding your gym's number" },
    { id: "logging", label: "What to actually write down" },
    { id: "comparing", label: "Do not compare it to the free bar" },
    { id: "angled", label: "Angled machines" },
  ],
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>Most Smith machine bars work out somewhere between 15 and 25 lb.</strong> The bar
          itself is a normal weight, but almost all of them run on a counterweight system that
          cancels out most of it.
        </P>
        <P>
          It varies by manufacturer and model, so there is no single number that is true everywhere.
          Some counterbalanced machines come out under 10 lb.
        </P>
        <P>
          Ask a staff member for your gym's number, use it every time, and do not compare it to
          what you lift on a free barbell.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="why" title="Why it is not 45 lb">
          <P>
            A Smith machine bar runs on rails inside the frame, and on most models it is attached to
            a cable and a counterweight, the same way a sash window is. The counterweight pulls up
            while the bar pulls down.
          </P>
          <P>
            So the metal in your hands might genuinely weigh 45 lb, but a chunk of that is being
            held up by the machine. What you feel is the difference.
          </P>
          <P>
            This is why the first rep on a Smith machine feels strangely light to people coming
            from free weights. Nothing is wrong with you. There is less weight there.
          </P>
        </Section>

        <Section id="range" title="The range you will see">
          <P>
            Fully counterbalanced machines, which is most of what you find in commercial gyms, land
            around 15 to 25 lb of effective starting resistance.
          </P>
          <P>
            A small number of machines have no counterweight at all. On those the bar is whatever it
            weighs, often 30 to 45 lb, and it feels immediately heavier when you unrack it empty.
          </P>
          <P>
            Older or budget machines vary more. If your gym has two Smith machines from different
            eras, they may not match each other, which is worth knowing before you wonder why
            Tuesday felt harder than Friday.
          </P>
        </Section>

        <Section id="finding" title="Finding your gym's number">
          <P>Three ways, in order of how reliable they are.</P>
          <P>
            <strong>Ask at the desk.</strong> Staff usually know, or can find it. This takes 30
            seconds and is the only method that gives you the real number.
          </P>
          <P>
            <strong>Look for the manufacturer plate.</strong> There is normally a sticker or plate
            on the frame with a brand and model. The spec is often published, and the brand alone
            narrows it a lot.
          </P>
          <P>
            <strong>Compare it against something you know.</strong> Unrack the empty bar and press
            or squat it, then do the same movement with a dumbbell you know the weight of. This
            gives you a rough feel rather than a number, but a rough feel is enough to know whether
            you are dealing with 15 lb or 45.
          </P>
          <Callout tone="note" title="Good enough beats exact">
            If you cannot find out, write down 20 lb and move on. Being consistently 5 lb wrong
            costs you nothing. Changing your assumption every few weeks makes your whole history
            useless.
          </Callout>
        </Section>

        <InlineCta
          title="Log it once, not every session"
          body="Put the bar weight in a note on the exercise in LiftCamp and every future session uses the same baseline, so your Smith machine numbers actually line up over time."
        />

        <Section id="logging" title="What to actually write down">
          <P>
            Pick one approach and never change it. Both work. Mixing them is what breaks your
            history.
          </P>
          <P>
            <strong>Plates only.</strong> You loaded two 25s, you log 50. Simple, and it matches
            what you see on the machine. The downside is that your first few weeks show as very
            light numbers.
          </P>
          <P>
            <strong>Plates plus your bar estimate.</strong> Two 25s on a bar you decided is 20 lb,
            you log 70. Closer to the truth of what you are moving, and it means an empty bar
            session still records something instead of a zero.
          </P>
          <P>
            I would use the second one. The reason is that beginners often start on the empty bar,
            and a log full of zeroes for the first two weeks does not show you the progress you
            actually made.
          </P>
          <P>
            Whichever you choose, write the choice down somewhere. In 6 months you will not
            remember, and that is exactly when you will want to compare.
          </P>
        </Section>

        <Section id="comparing" title="Do not compare it to the free bar">
          <P>
            A <ExerciseLink slug="smith-machine-bench-press">Smith machine bench press</ExerciseLink>{" "}
            and a <ExerciseLink slug="barbell-bench-press">barbell bench press</ExerciseLink> are
            different exercises, and the bar weight is only part of why.
          </P>
          <P>
            On a Smith machine the rail holds the bar steady, so none of your effort goes into
            keeping the path straight. Most people can move more weight on the Smith, sometimes
            noticeably more.
          </P>
          <P>
            Which means if you switch from Smith to free bar, expect your numbers to drop, and do
            not read that as losing strength. You changed the exercise. Track them as two separate
            things and compare each against its own history.
          </P>
        </Section>

        <Section id="angled" title="Angled machines">
          <P>
            Some Smith machines run on a slight angle rather than straight up and down, usually
            around 7 to 12 degrees off vertical.
          </P>
          <P>
            That angle exists because a real bench press or squat bar path is not perfectly vertical
            either, so the angled version feels more natural for pressing. It also means the bar
            weight you feel changes slightly depending on which direction you face.
          </P>
          <P>
            The practical rule: face the same way every time. Most angled machines have the bar
            traveling toward your head as it rises, so set up so the movement feels smooth rather
            than fighting you, then note which way you faced.
          </P>
        </Section>
      </Prose>
    </>
  );
}
