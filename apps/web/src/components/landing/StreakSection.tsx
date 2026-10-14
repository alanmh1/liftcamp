import type { CSSProperties } from "react";
import { Flame } from "lucide-react";
import { PhoneShot } from "./PhoneShot";

const weeks = [true, true, true, true, true, true, false, false];

export function StreakSection() {
  return (
    <section data-reveal-section className="mx-auto max-w-7xl px-ds-lg py-ds-3xl">
      <div className="relative overflow-hidden rounded-xl bg-pr px-ds-xl py-ds-2xl lg:px-ds-2xl">
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-background/40 blur-3xl" />
        <div className="relative grid gap-ds-2xl lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p
              data-reveal="text"
              className="inline-flex items-center gap-ds-sm font-label text-label uppercase tracking-widest text-pr-foreground"
            >
              <Flame className="h-4 w-4" /> Streaks
            </p>
            <h2
              data-reveal="text"
              className="mt-ds-sm max-w-2xl font-display text-6xl font-extrabold leading-none tracking-tight text-pr-foreground"
            >
              Showing up is the program.
            </h2>
            <p
              data-reveal="text"
              className="mt-ds-lg max-w-xl font-body text-xl leading-relaxed text-pr-foreground/80"
            >
              Pick a weekly target between 2 and 6 days. Hit it and the streak grows. String four
              weeks together and LiftCamp banks your progress, so one rough week doesn’t undo a good
              month.
            </p>

            <div
              data-reveal="item"
              className="mt-ds-xl max-w-xl rounded-lg bg-popover [--i:0] p-ds-lg shadow-lg"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-heading text-3xl font-bold text-popover-foreground">6 weeks</p>
                <p className="font-caption text-caption text-muted-foreground">
                  Target: 3 days / week
                </p>
              </div>
              <div className="mt-ds-md grid grid-cols-8 gap-ds-sm">
                {weeks.map((done, index) => (
                  <span
                    key={index}
                    data-done={done}
                    data-anim="flame"
                    style={{ "--i": index } as CSSProperties}
                    className="flex h-12 items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground data-[done=true]:border-solid data-[done=true]:border-primary data-[done=true]:bg-primary data-[done=true]:text-primary-foreground"
                  >
                    <Flame className="h-5 w-5" />
                  </span>
                ))}
              </div>
              <p className="mt-ds-sm font-caption text-caption text-muted-foreground">
                Streak banked after week four. Keep going.
              </p>
            </div>
          </div>

          <div className="mx-auto -rotate-3">
            <PhoneShot
              name="03-summary-trex"
              alt="LiftCamp workout summary: you lifted as much as a T. rex, 18,080 lbs"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
