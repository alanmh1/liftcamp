import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { InlineCta } from "@/components/guides/InlineCta";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "gym-etiquette-for-beginners",
  title: "Gym etiquette for beginners: what actually matters",
  seoTitle: "Gym etiquette for beginners: what really matters",
  dek: "Most of what you are worried about, nobody notices. There are about six things people genuinely care about, and they take a minute to learn.",
  description:
    "A beginner's guide to gym etiquette. How to ask to work in, how long to stay on a machine, wiping down, re-racking, phones, and what nobody minds.",
  category: "Getting started",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 6,
  toc: [
    { id: "nobody-minds", label: "Things nobody minds" },
    { id: "working-in", label: "How to ask to work in" },
    { id: "machines", label: "How long you can stay on a machine" },
    { id: "dumbbells", label: "Taking dumbbells away from the rack" },
    { id: "reracking", label: "Putting things back" },
    { id: "wiping", label: "Wiping down" },
    { id: "phones", label: "Phones and filming" },
    { id: "space", label: "Setting up near someone" },
    { id: "watching", label: "Nobody is watching you" },
  ],
  hero: { alt: "Clay illustration of a spray bottle beside a folded gym towel" },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>
            Put your weights back, wipe the bench, and do not stand directly in front of the
            dumbbell rack.
          </strong>{" "}
          That covers most of it.
        </P>
        <P>
          If someone is using the thing you want, ask how many sets they have left. It is a normal
          question and the answer is almost always friendly.
        </P>
        <P>
          Nobody minds that you are new, that you are lifting light weights, or that you are looking
          things up on your phone.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="nobody-minds" title="Things nobody minds">
          <P>
            Worth getting this out of the way first, because the anxiety about gym etiquette is
            mostly about things that are fine.
          </P>
          <P>
            Nobody minds that you are lifting the empty bar. Everybody in the room started there,
            including the largest person in it. Most of them remember it clearly.
          </P>
          <P>
            Nobody minds that you do not know how a machine works. Everybody has sat on something
            backward. Reading the diagram on the side is what the diagram is for.
          </P>
          <P>
            Nobody minds that you are resting between sets. Sitting on a bench doing nothing for 2
            minutes is what everyone else is also doing.
          </P>
          <P>
            Nobody minds that you brought your phone. Half the room is logging their workout, and
            the other half is on Instagram.
          </P>
          <P>
            Nobody minds that you are wearing the wrong shoes, or a cotton t shirt, or that you do
            not own a lifting belt.
          </P>
        </Section>

        <Section id="working-in" title="How to ask to work in">
          <P>
            This is the one people dread and it is genuinely easy. Wait until the person is between
            sets, not mid rep, then say one of two things.
          </P>
          <P>
            <strong>"How many sets have you got left?"</strong> This is the polite version and it
            gets you an answer like "two more" so you can come back. Most people will also offer to
            let you work in.
          </P>
          <P>
            <strong>"Mind if I work in with you?"</strong> Direct, and completely normal. Working in
            means you alternate sets while they rest. On a machine you change the pin, on a bar you
            swap the plates.
          </P>
          <P>
            Say yes when someone asks you the same thing. That is the whole social contract.
          </P>
          <P>
            The one time working in is awkward is a heavily loaded barbell, where changing plates
            between every set costs both of you more time than waiting. In that case just ask how
            long they will be.
          </P>
          <Callout tone="note" title="Headphones are not a wall">
            Almost everyone has headphones in. Tapping someone on the shoulder or catching their eye
            and gesturing is normal and expected. You are not interrupting anything sacred.
          </Callout>
        </Section>

        <Section id="machines" title="How long you can stay on a machine">
          <P>
            As long as you are actually using it. Three or four sets with 90 seconds of rest between
            them is maybe 8 minutes and nobody will think twice.
          </P>
          <P>
            What annoys people is sitting on a machine while scrolling, for 5 minutes, when someone
            is visibly waiting. The rest itself is fine. The rest with no sign you are coming back
            to it is not.
          </P>
          <P>
            If you notice someone hovering, say "I have two more sets, want to jump in?" You have
            now handled it, and you look like someone who knows what they are doing.
          </P>
          <P>
            At peak hours, doing a superset across two machines on opposite sides of the room is the
            one thing that genuinely irritates people. You are holding both while using neither.
            Save that for quiet times.
          </P>
        </Section>

        <Section id="dumbbells" title="Taking dumbbells away from the rack">
          <P>
            Fine, and normal. Take them to a bench, to the mat area, wherever you need them.
          </P>
          <P>
            The actual rule is do not stand right in front of the rack doing your set. Curling
            directly in front of the 30s means nobody else can reach the 25s or the 35s. Take two
            steps back and everyone can get past you.
          </P>
          <P>
            Put them back on the correct numbers when you are done. Not roughly nearby. The rack is
            in order for a reason and one pair in the wrong slot means the next person hunts for
            them.
          </P>
        </Section>

        <InlineCta
          title="Knowing what you are doing next helps a lot"
          body="Most gym anxiety is not knowing what comes next. LiftCamp gives you the session in order with your last weights already filled in, so you can walk in with a plan."
        />

        <Section id="reracking" title="Putting things back">
          <P>
            Strip the bar when you finish. Every plate off, back on the pegs, sorted by size. This
            is the single most reliable way to be liked in a gym.
          </P>
          <P>
            Leaving 4 plates a side on a bench for the next person is the classic complaint, and it
            is a real one. Someone smaller than you now has to unload 180 lb before they can start.
          </P>
          <P>
            Clips and collars go back on the peg too. Benches go back to flat. Adjustable seats can
            stay wherever, nobody cares about that one.
          </P>
        </Section>

        <Section id="wiping" title="Wiping down">
          <P>
            Wipe the bench or the pad after you use it, whether or not you think you sweated on it.
            You did, a bit, and the next person cannot tell the difference between your sweat and
            the last three people's.
          </P>
          <P>
            Most gyms have spray bottles and paper towel on the wall, or a dispenser of wipes near
            the entrance. Some have both and it varies by room.
          </P>
          <P>
            Bringing a small towel and laying it on the bench works too, and is standard in a lot of
            gyms outside the US.
          </P>
          <P>
            You do not need to wipe dumbbell handles or barbell knurling. Nobody does and the spray
            would make them slippery.
          </P>
        </Section>

        <Section id="phones" title="Phones and filming">
          <P>
            Using your phone between sets is completely normal. Logging your workout, changing your
            music, replying to something. Nobody notices.
          </P>
          <P>
            Filming yourself is also normal now, and useful. Watching a set back is the fastest way
            to spot what your form is actually doing.
          </P>
          <P>
            Two rules if you film. Point the camera at yourself, framed so other people are not in
            the shot, and do not leave a tripod or a propped phone in a walkway. Some gyms have
            explicit rules about filming, usually posted near the entrance.
          </P>
          <P>
            If someone asks you not to film them, apologize and delete it. That is the end of it.
          </P>
        </Section>

        <Section id="space" title="Setting up near someone">
          <P>
            Give people room. The rough guide is do not set up so close that either of you has to
            think about the other while moving a weight.
          </P>
          <P>
            Do not walk directly between someone and the mirror while they are mid set. They are
            watching their own form, and you crossing it is briefly annoying.
          </P>
          <P>
            Do not walk close behind someone doing an overhead press or a barbell row. If they step
            back, you are in the way of a moving weight.
          </P>
          <P>
            None of this is precious. Just walk around rather than through.
          </P>
        </Section>

        <Section id="watching" title="Nobody is watching you">
          <P>
            The strongest people in the gym are the least likely to be paying attention to you. They
            are counting their own reps and thinking about their own next set.
          </P>
          <P>
            Unsolicited form advice from strangers does happen, and it is usually well meant and
            frequently wrong. You are allowed to say "thanks, I am working on it" and carry on. You
            do not owe anyone a conversation.
          </P>
          <P>
            If you want a check on your technique, staff will usually help if you ask, and asking is
            a completely normal thing to do. It is part of what the membership pays for.
          </P>
          <P>
            The feeling that everyone is looking at you fades within about three visits. It goes
            faster if you walk in with a plan for what you are doing that day, because then you are
            busy too.
          </P>
        </Section>
      </Prose>
    </>
  );
}
