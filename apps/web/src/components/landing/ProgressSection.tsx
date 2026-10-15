import { TrendingUp } from "lucide-react";
import { PhoneShot } from "./PhoneShot";

export function ProgressSection() {
  return (
    <section data-reveal-section className="border-y border-border bg-muted/60 py-ds-3xl">
      <div className="mx-auto grid max-w-7xl gap-ds-2xl px-ds-lg lg:grid-cols-[5fr_7fr] lg:items-center">
        <div>
          <p
            data-reveal="text"
            className="font-label text-label uppercase tracking-widest text-primary"
          >
            Progress
          </p>
          <h2
            data-reveal="text"
            className="mt-ds-sm font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
          >
            Watch the line go up.
          </h2>
          <p
            data-reveal="text"
            className="mt-ds-md font-body text-xl leading-relaxed text-muted-foreground"
          >
            Every exercise gets its own history and charts for estimated max, heaviest weight, reps
            and volume. PRs get marked the moment you hit them, and bodyweight strength levels show
            how your big four stack up.
          </p>
        </div>

        <div className="grid items-center gap-ds-xl md:grid-cols-[auto_1fr]">
          <div data-reveal="item" className="[--i:0]">
            <PhoneShot
              name="05-profile-prs"
              alt="LiftCamp profile screen with recent PRs and strength levels"
              className="mx-auto w-[280px] rotate-[-2deg]"
            />
          </div>
          <div className="space-y-ds-lg">
            <div
              data-reveal="item"
              className="rounded-xl border border-border bg-card p-ds-lg shadow-lg [--i:1]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-caption text-caption text-muted-foreground">
                    Back Squat · Estimated max
                  </p>
                  <p className="font-heading text-4xl font-extrabold tabular-nums text-card-foreground">
                    185 lbs
                  </p>
                </div>
                <span className="inline-flex items-center gap-ds-xs rounded-full bg-accent px-ds-sm py-ds-xs font-caption text-caption text-accent-foreground">
                  <TrendingUp className="h-4 w-4" /> +60 lbs
                </span>
              </div>
              <svg viewBox="0 0 320 160" className="mt-ds-md h-44 w-full" aria-hidden="true">
                <line
                  x1="0"
                  y1="40"
                  x2="320"
                  y2="40"
                  className="stroke-border"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="90"
                  x2="320"
                  y2="90"
                  className="stroke-border"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="140"
                  x2="320"
                  y2="140"
                  className="stroke-border"
                  strokeDasharray="4 4"
                />
                <path
                  d="M0 140 L40 132 L80 120 L120 118 L160 98 L200 86 L240 70 L280 52 L320 30 L320 160 L0 160 Z"
                  className="fill-primary/10"
                />
                <path
                  d="M0 140 L40 132 L80 120 L120 118 L160 98 L200 86 L240 70 L280 52 L320 30"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx="320" cy="30" r="7" className="fill-pr stroke-card" strokeWidth="3" />
                <circle cx="200" cy="86" r="5" className="fill-pr stroke-card" strokeWidth="2" />
              </svg>
              <div className="mt-ds-sm flex justify-between font-caption text-caption text-muted-foreground">
                <span>Week 1</span>
                <span>Week 12</span>
              </div>
            </div>

            <div
              data-reveal="item"
              className="rounded-xl bg-foreground p-ds-lg text-background [--i:2]"
            >
              <p className="font-caption text-caption text-background/70">Strength levels</p>
              <div className="mt-ds-md space-y-ds-md">
                <div>
                  <div className="flex justify-between font-label text-label">
                    <span>Squat</span>
                    <span className="text-pr">Novice</span>
                  </div>
                  <div className="mt-ds-xs h-2 rounded-full bg-background/15">
                    <div className="h-2 w-[55%] rounded-full bg-pr" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-label text-label">
                    <span>Bench press</span>
                    <span className="text-pr">Novice</span>
                  </div>
                  <div className="mt-ds-xs h-2 rounded-full bg-background/15">
                    <div className="h-2 w-[48%] rounded-full bg-pr" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-label text-label">
                    <span>Deadlift</span>
                    <span className="text-pr">Intermediate</span>
                  </div>
                  <div className="mt-ds-xs h-2 rounded-full bg-background/15">
                    <div className="h-2 w-[68%] rounded-full bg-pr" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-label text-label">
                    <span>Overhead press</span>
                    <span className="text-pr">Beginner</span>
                  </div>
                  <div className="mt-ds-xs h-2 rounded-full bg-background/15">
                    <div className="h-2 w-[30%] rounded-full bg-pr" />
                  </div>
                </div>
              </div>
              <p className="mt-ds-lg font-caption text-caption text-background/70">
                Based on your bodyweight
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
