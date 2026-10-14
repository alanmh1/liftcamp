import { History, Timer, Scale, WifiOff, Play, KeyRound, Share2, Rewind } from "lucide-react";

export function FeatureList() {
  return (
    <section data-reveal-section className="mx-auto max-w-7xl px-ds-lg py-ds-3xl">
      <div className="grid gap-ds-2xl lg:grid-cols-[4fr_8fr]">
        <h2
          data-reveal="text"
          className="font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
        >
          The small stuff, sorted.
        </h2>
        <ul className="grid gap-x-ds-xl gap-y-ds-lg sm:grid-cols-2">
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:0] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <Rewind className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Last session, right there
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Previous weights and reps show beside every set.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:1] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <Timer className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Rest timer presets
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Save the rest you like and it starts when you finish a set.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:2] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <WifiOff className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Basement-gym proof
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Workouts save offline and sync when you’re back online.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:3] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <Scale className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Pounds or kilograms
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Log in whichever units your gym uses.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:4] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <Play className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Freestyle when you want
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Start an empty workout or pick up your routine where you left it.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:5] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <History className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Every session, kept
              </h3>
              <p className="font-body text-body text-muted-foreground">
                A complete workout history you can scroll back through.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:6] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <Share2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Brag-ready summaries
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Finish a workout and share the totals in one tap.
              </p>
            </div>
          </li>
          <li
            data-reveal="item"
            className="flex gap-ds-md border-t border-border pt-ds-md [--i:7] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
          >
            <KeyRound className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-label text-lg font-semibold text-foreground">
                Try before you sign up
              </h3>
              <p className="font-body text-body text-muted-foreground">
                Do a workout first, then save it with Apple, Google or email.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
