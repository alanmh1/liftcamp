import { P, Prose, Section } from "@/components/guides/Prose";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { Callout } from "@/components/guides/Callout";
import { ExerciseLink } from "@/components/guides/ExerciseLink";
import { InlineCta } from "@/components/guides/InlineCta";
import { BuilderLink } from "@/components/guides/BuilderLink";
import { RoutineLink } from "@/components/guides/RoutineLink";
import type { Guide } from "./types";

export const meta: Guide["meta"] = {
  slug: "squat-without-a-rack",
  title: "How to squat when your gym has no squat rack",
  dek: "Goblet squats carry you a long way, split squats take over when the dumbbells run out, and the leg press covers the heavy end.",
  description:
    "No squat rack at your gym? Here is how to train legs with dumbbells, the leg press and the Smith machine, including starting weights and when each one stops being enough.",
  category: "Programming",
  published: "2026-09-02",
  updated: "2026-09-02",
  readMinutes: 7,
  toc: [
    { id: "goblet", label: "Start with the goblet squat" },
    { id: "how-heavy", label: "How heavy, and when it runs out" },
    { id: "split", label: "Split squats take over" },
    { id: "leg-press", label: "The leg press for the heavy end" },
    { id: "smith", label: "Squatting in a Smith machine" },
    { id: "hamstrings", label: "Do not forget the back of your legs" },
    { id: "day", label: "A leg day with no rack" },
    { id: "missing", label: "What you are actually missing" },
  ],
  hero: { alt: "Clay illustration of a kettlebell beside a leg press machine" },
};

export function Body() {
  return (
    <>
      <AnswerBlock>
        <P>
          <strong>
            Use the <ExerciseLink slug="goblet-squat">goblet squat</ExerciseLink>.
          </strong>{" "}
          One dumbbell held against your chest, squat between your feet. It trains the same
          muscles as a barbell squat and needs nothing but a dumbbell rack.
        </P>
        <P>
          When the heaviest dumbbell your gym owns stops being hard, move to{" "}
          <ExerciseLink slug="split-squat-with-dumbbells">split squats</ExerciseLink> and the{" "}
          <ExerciseLink slug="leg-press">leg press</ExerciseLink>, which load your legs far past
          what you can hold in your hands.
        </P>
        <P>
          Add weight when you can do 3 sets of 10 with 2 reps left in you and no loss of depth on
          the last set.
        </P>
      </AnswerBlock>

      <Prose>
        <Section id="goblet" title="Start with the goblet squat">
          <P>
            Hold one dumbbell vertically against your chest, hands cupped under the top end like
            you are holding a mug. Feet about shoulder width, toes turned out slightly. Squat down
            between your knees, elbows tracking inside your thighs, then stand.
          </P>
          <P>
            The front-loaded position does something useful for beginners. The weight in front acts
            as a counterbalance, so you can sit down into the squat without tipping forward, and
            most people reach a depth on their first goblet squat that takes them weeks to reach
            with a barbell.
          </P>
          <P>
            It is also self-limiting in a way a barbell is not. If the weight is too heavy you
            cannot hold it against your chest, so the set ends before the rep gets ugly. Nobody
            gets pinned under a goblet squat.
          </P>
          <P>
            Start with 20 lb for 2 sets of 8. If that feels like nothing, go to 30. The first
            session is for finding the movement, not for testing yourself.
          </P>
        </Section>

        <Section id="how-heavy" title="How heavy, and when it runs out">
          <P>
            Add 5 lb when you finish 3 sets of 10 with a couple of reps in reserve. Most people
            work up to somewhere between 50 and 75 lb over a few months.
          </P>
          <P>
            Then you hit the ceiling. Gyms without racks usually cap their dumbbells around 75 lb,
            and by the time you can goblet squat that, holding it is the hard part rather than
            squatting it. Your grip and upper back quit before your legs do.
          </P>
          <P>
            That is not a failure of the exercise. It is a normal place to arrive after several
            months, and it is the signal to change the movement rather than keep chasing weight.
          </P>
          <Callout tone="note" title="Check your gym's actual cap">
            Dumbbell racks vary a lot. Some top out at 50 lb, some go to 100. Walk to the end of the
            rack and look before you plan around a number.
          </Callout>
        </Section>

        <Section id="split" title="Split squats take over">
          <P>
            One leg at a time doubles the load on that leg without doubling what you have to hold.
            Two 40 lb dumbbells in a split squat is harder than 80 lb in a goblet squat, and you
            never fought your grip to get there.
          </P>
          <P>
            Stand with one foot forward and one back, about 2 to 3 feet apart. Drop straight down
            so your back knee travels toward the floor, then push through the front foot to stand.
            Your front shin should stay close to vertical and your torso close to upright.
          </P>
          <P>
            Start with bodyweight only for 2 sets of 8 per leg. Single leg work is harder than
            people expect and the first session will tell you plenty about your balance. Add
            dumbbells the following week.
          </P>
          <P>
            The <ExerciseLink slug="bulgarian-split-squat">Bulgarian split squat</ExerciseLink>{" "}
            puts your back foot up on a bench, which loads the front leg harder still. Save it for
            when the flat version is comfortable. It is a demanding exercise and it punishes bad
            balance.
          </P>
        </Section>

        <BuilderLink label="Build a routine around what your gym has" muscle="quads" body="Search the library by muscle, pick the versions you can actually load, and save the plan." />

        <RoutineLink slug="dumbbell-only-workout" label="Try the dumbbell only routine" body="Three full body days that need two dumbbells and a bench, so a missing rack never costs you a session." />

        <InlineCta
          title="Two dumbbells, four exercises, one record"
          body="LiftCamp tracks each of these separately, so when the goblet squat caps out you can see exactly where the split squat picked up."
        />

        <Section id="leg-press" title="The leg press for the heavy end">
          <P>
            The <ExerciseLink slug="leg-press">leg press</ExerciseLink> is where you get to load
            your legs properly without a barbell anywhere near you. Almost every gym has one, even
            the ones with no racks at all.
          </P>
          <P>
            Set the seat so your knees bend to about 90 degrees at the bottom without your lower
            back peeling off the pad. Feet about shoulder width, mid platform. Press through your
            whole foot, and do not slam the knees straight at the top.
          </P>
          <P>
            One thing worth knowing: the sled itself weighs something before you add a single
            plate, and that number is different on every machine. It might be 25 lb, it might be
            over 100. So do not compare your leg press number to anybody else's, including your own
            at a different gym.
          </P>
          <P>Three sets of 10 to 12 after your dumbbell work is plenty.</P>
        </Section>

        <Section id="smith" title="Squatting in a Smith machine">
          <P>
            If your gym has a Smith machine, you can squat in it, with one adjustment. The bar
            travels on a fixed rail, so you cannot shift your hips back the way you would in a free
            squat. Set your feet 6 to 12 inches further forward than feels natural and let the rail
            hold you upright.
          </P>
          <P>
            The bar on a Smith machine does not weigh 45 lb. Most are counterbalanced and the
            starting resistance is somewhere around 15 to 25 lb, varying by manufacturer. Pick a
            number, write it down, and use the same number every time so your own progress stays
            comparable.
          </P>
          <P>
            It is a fine squat for a beginner. It trains your quads and glutes and it lets you
            train close to failure without a spotter. What it trains less of is balance and
            stabilising, because the machine does that part.
          </P>
        </Section>

        <Section id="hamstrings" title="Do not forget the back of your legs">
          <P>
            Every option above is quad-dominant. Without a rack it is easy to build a leg day that
            is all front of the thigh and nothing else.
          </P>
          <P>
            <ExerciseLink slug="stiff-legged-dumbbell-deadlift">
              Dumbbell Romanian deadlifts
            </ExerciseLink>{" "}
            fix that. Two dumbbells, soft knees, push your hips back and let the weights travel
            down the front of your legs until you feel a stretch in the hamstrings, then stand.
            Start light, around 20 lb per hand, because form goes first on this one.
          </P>
          <P>
            A <ExerciseLink slug="seated-hamstring-curl">seated hamstring curl</ExerciseLink>{" "}
            machine covers the same ground with less to think about.
          </P>
        </Section>

        <Section id="day" title="A leg day with no rack">
          <P>
            <strong>Goblet squat</strong>, 3 sets of 10
          </P>
          <P>
            <strong>Split squat</strong>, 3 sets of 8 per leg
          </P>
          <P>
            <strong>Leg press</strong>, 3 sets of 12
          </P>
          <P>
            <strong>Dumbbell Romanian deadlift</strong>, 3 sets of 10
          </P>
          <P>
            <strong>Standing calf raise</strong>, 3 sets of 15
          </P>
          <P>
            Twice a week, 6 to 8 weeks, adding a little weight whenever a session feels easy. That
            is a real leg program and there is no barbell in it.
          </P>
        </Section>

        <Section id="missing" title="What you are actually missing">
          <P>
            Honest version: for your first year, close to nothing. Muscle responds to hard sets
            taken near failure, and every exercise above produces those.
          </P>
          <P>
            What a barbell squat gives you that these do not is a single movement you can load
            almost indefinitely, plus the bracing and balance demand of holding weight on your
            back. Those matter if you want to compete in something, or eventually if you want to
            keep getting stronger for years rather than months.
          </P>
          <P>
            If you get to the point where the leg press is your only way to make legs hard and the
            dumbbells stopped mattering a while ago, that is the moment to look at what a gym with
            racks costs near you. Not before.
          </P>
        </Section>
      </Prose>
    </>
  );
}
