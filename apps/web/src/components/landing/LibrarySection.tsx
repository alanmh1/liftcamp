import { PlayCircle, Search } from "lucide-react";
import { PhoneShot } from "./PhoneShot";

export function LibrarySection() {
  return (
    <section id="library" data-reveal-section className="mx-auto max-w-7xl px-ds-lg py-ds-3xl">
      <div className="grid gap-ds-2xl lg:grid-cols-[1fr_1.1fr] lg:items-end">
        <div>
          <p
            data-reveal="text"
            className="font-label text-label uppercase tracking-widest text-primary"
          >
            Exercise library
          </p>
          <h2
            data-reveal="text"
            className="mt-ds-sm font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
          >
            Never fake your way through a machine again.
          </h2>
        </div>
        <p data-reveal="text" className="font-body text-xl leading-relaxed text-muted-foreground">
          850+ exercises with step-by-step instructions and front-and-back muscle diagrams. Hundreds
          include short demo animations, so you know what good form looks like before you load the
          bar.
        </p>
      </div>

      <div className="mt-ds-2xl grid gap-ds-lg lg:grid-cols-[1.3fr_1fr]">
        <div
          data-reveal="item"
          className="relative flex min-h-[520px] [--i:0] justify-center overflow-hidden rounded-xl bg-accent px-ds-lg pb-ds-3xl pt-ds-xl"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-pr/50 blur-3xl" />
          <PhoneShot
            name="04-exercise-info"
            alt="LiftCamp exercise detail for Barbell Bench Press with muscle diagrams"
            className="relative w-[290px]"
          />
          <div className="absolute bottom-ds-lg left-ds-lg right-ds-lg flex items-center gap-ds-sm rounded-full bg-popover/95 px-ds-md py-ds-sm shadow-lg backdrop-blur">
            <Search className="h-5 w-5 text-muted-foreground" />
            <p className="font-body text-body text-muted-foreground">dumbbell shoulder press</p>
            <span className="ml-auto rounded-full bg-accent px-ds-sm py-ds-xs font-caption text-caption text-accent-foreground">
              Dumbbells
            </span>
          </div>
        </div>

        <div
          data-reveal="item"
          className="flex flex-col rounded-xl border border-border bg-card p-ds-xl [--i:1]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-caption text-caption uppercase tracking-wider text-muted-foreground">
                Chest · Barbell
              </p>
              <h3 className="mt-ds-xs font-heading text-3xl font-bold text-card-foreground">
                Barbell Bench Press
              </h3>
            </div>
            <span className="inline-flex items-center gap-ds-xs rounded-full bg-pr px-ds-sm py-ds-xs font-caption text-caption text-pr-foreground">
              <PlayCircle className="h-4 w-4" /> Demo
            </span>
          </div>

          <div className="mt-ds-lg flex flex-wrap gap-ds-sm">
            <span className="rounded-full bg-primary px-ds-md py-ds-xs font-label text-label text-primary-foreground">
              Chest
            </span>
            <span className="rounded-full bg-accent px-ds-md py-ds-xs font-label text-label text-accent-foreground">
              Shoulders
            </span>
            <span className="rounded-full bg-accent px-ds-md py-ds-xs font-label text-label text-accent-foreground">
              Triceps
            </span>
          </div>

          <p className="mt-ds-lg font-caption text-caption uppercase tracking-wider text-muted-foreground">
            How to do it
          </p>
          <ol className="mt-ds-sm space-y-ds-md">
            <li className="grid grid-cols-[28px_1fr] gap-ds-sm font-body text-body text-card-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-label text-caption">
                1
              </span>
              Lie back on a flat bench and grip the bar a little wider than shoulder width.
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-ds-sm font-body text-body text-card-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-label text-caption">
                2
              </span>
              Lower the bar slowly to the middle of your chest, elbows tucked slightly.
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-ds-sm font-body text-body text-card-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-label text-caption">
                3
              </span>
              Press back up until your arms are straight. Keep your feet planted the whole time.
            </li>
          </ol>

          <div className="mt-auto rounded-lg bg-accent p-ds-md">
            <p className="font-label text-label text-accent-foreground">Beginner note</p>
            <p className="mt-ds-xs font-body text-sm text-accent-foreground">
              Start with just the bar. Adding weight next week is the fun part.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
