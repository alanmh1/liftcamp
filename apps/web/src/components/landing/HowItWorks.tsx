import { ClipboardList, MousePointerClick, CalendarCheck } from "lucide-react";
import { PhoneShot } from "./PhoneShot";

export function HowItWorks() {
  return (
    <section
      id="how"
      data-reveal-section
      className="scroll-mt-24 mx-auto max-w-7xl px-ds-lg py-ds-3xl"
    >
      <div className="grid gap-ds-2xl lg:grid-cols-[5fr_7fr] lg:items-center">
        <div
          data-reveal="item"
          className="relative mx-auto flex w-full max-w-[460px] justify-center [--i:0] rounded-xl bg-accent py-ds-xl"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pr/60 blur-2xl" />
          <PhoneShot
            name="02-active-workout"
            alt="LiftCamp workout screen showing previous weights next to today's sets"
            className="relative w-[280px]"
          />
          <div className="absolute -bottom-ds-lg -right-ds-lg max-w-[260px] rounded-lg border border-border bg-popover p-ds-md shadow-xl hover:shadow-2xl motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5">
            <p className="font-caption text-caption uppercase tracking-wider text-muted-foreground">
              Last time
            </p>
            <p className="mt-ds-xs font-heading text-2xl font-bold tabular-nums text-popover-foreground">
              105 lbs × 8
            </p>
            <p className="font-caption text-caption text-muted-foreground">
              LiftCamp remembers, so you never have to.
            </p>
          </div>
        </div>

        <div>
          <p
            data-reveal="text"
            className="font-label text-label uppercase tracking-widest text-primary"
          >
            How it works
          </p>
          <h2
            data-reveal="text"
            className="mt-ds-sm max-w-2xl font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
          >
            Three steps. Zero spreadsheets.
          </h2>

          <ol className="mt-ds-xl divide-y divide-border border-y border-border">
            <li
              data-reveal="item"
              className="grid grid-cols-[64px_1fr] gap-ds-lg rounded-lg py-ds-lg [--i:1] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent text-primary">
                <ClipboardList className="h-7 w-7" />
              </span>
              <div>
                <h3 className="font-heading text-2xl font-bold text-foreground">Pick a routine</h3>
                <p className="mt-ds-xs max-w-xl font-body text-body text-muted-foreground">
                  Tell us your training days, experience and equipment. You get a plan with
                  exercises, sets and rep targets already filled in.
                </p>
              </div>
            </li>
            <li
              data-reveal="item"
              className="grid grid-cols-[64px_1fr] gap-ds-lg rounded-lg py-ds-lg [--i:2] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MousePointerClick className="h-7 w-7" />
              </span>
              <div>
                <h3 className="font-heading text-2xl font-bold text-foreground">
                  Tap to log each set
                </h3>
                <p className="mt-ds-xs max-w-xl font-body text-body text-muted-foreground">
                  Last session’s numbers sit right next to today’s. Tick the set, the rest timer
                  starts on its own.
                </p>
              </div>
            </li>
            <li
              data-reveal="item"
              className="grid grid-cols-[64px_1fr] gap-ds-lg rounded-lg py-ds-lg [--i:3] hover:shadow-md motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-pr text-pr-foreground">
                <CalendarCheck className="h-7 w-7" />
              </span>
              <div>
                <h3 className="font-heading text-2xl font-bold text-foreground">Keep the week</h3>
                <p className="mt-ds-xs max-w-xl font-body text-body text-muted-foreground">
                  Set a weekly target from 2 to 6 days. Hit it, and your streak grows. That’s the
                  whole trick to getting strong.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
