import { Flame, Trophy, WifiOff, Sparkles } from "lucide-react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";
import { PhoneShot } from "./PhoneShot";

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[720px] w-[720px] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-pr/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[length:28px_28px] opacity-70" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-ds-2xl px-ds-lg pb-ds-3xl pt-ds-2xl lg:grid-cols-[1.05fr_1fr] lg:pt-ds-3xl">
        <div>
          <p className="inline-flex items-center gap-ds-sm rounded-full border border-primary/20 bg-accent px-ds-md py-ds-xs font-label text-label text-accent-foreground">
            <Sparkles className="h-4 w-4" /> LiftCamp is now on iPhone
          </p>
          <h1 className="mt-ds-lg font-display text-6xl font-extrabold leading-none tracking-tight text-foreground lg:text-display xl:text-[6rem]">
            Lifting, minus the{" "}
            <span className="relative isolate inline-block text-primary">
              guesswork
              <span
                data-anim="hero-underline"
                className="absolute -bottom-1 left-0 -z-10 h-5 w-full -rotate-1 rounded-full bg-pr"
              />
            </span>
            .
          </h1>
          <p className="mt-ds-lg max-w-xl font-body text-xl leading-relaxed text-muted-foreground">
            LiftCamp tells you exactly what to do in the gym, makes logging a set a single tap, and
            turns showing up every week into a streak worth protecting. Built for your first six
            months, with plenty of room to grow.
          </p>
          <div className="mt-ds-xl flex flex-wrap items-center gap-ds-md">
            <AppStoreBadge tone="black" height={54} campaign="hero" />
          </div>
          <AndroidNotify source="hero" />

          <div className="mt-ds-xl flex flex-wrap gap-ds-xl border-t border-border pt-ds-lg">
            <div>
              <p className="font-heading text-heading font-bold text-foreground">900+</p>
              <p className="font-caption text-caption text-muted-foreground">
                exercises, explained
              </p>
            </div>
            <div>
              <p className="font-heading text-heading font-bold text-foreground">16</p>
              <p className="font-caption text-caption text-muted-foreground">routines</p>
            </div>
            <div>
              <p className="font-heading text-heading font-bold text-foreground">1 tap</p>
              <p className="font-caption text-caption text-muted-foreground">to log a set</p>
            </div>
          </div>
        </div>

        {/* Below lg: one phone under the copy, no floating chips. */}

        <div className="flex justify-center lg:hidden">
          <div data-anim="hero-phone" className="[--i:0]">
            <PhoneShot
              name="02-active-workout"

              priority

              alt="LiftCamp active workout screen logging Barbell Bench Press sets"

              className="w-[260px]"
            />
          </div>
        </div>

        <div className="relative mx-auto hidden h-[700px] w-full max-w-[620px] lg:block">
          <div data-anim="hero-phone" className="absolute right-0 top-0 rotate-3 [--i:0]">
            <PhoneShot
              name="01-home"
              priority
              alt="LiftCamp home screen with weekly workout goal and saved routines"
              className="shadow-foreground/25"
            />
          </div>
          <div data-anim="hero-phone" className="absolute left-0 top-10 z-10 -rotate-6 [--i:1]">
            <PhoneShot
              name="02-active-workout"
              priority
              alt="LiftCamp active workout screen logging Barbell Bench Press sets"
            />
          </div>
          <div
            data-anim="hero-chip"
            className="absolute -left-6 bottom-24 z-20 [--i:0] flex items-center gap-ds-sm rounded-lg bg-pr px-ds-md py-ds-sm shadow-xl"
          >
            <Trophy className="h-5 w-5 text-pr-foreground" />
            <div>
              <p className="font-label text-label text-pr-foreground">New PR</p>
              <p className="font-caption text-caption text-pr-foreground">
                Bench Press · 115 lbs × 6
              </p>
            </div>
          </div>
          <div
            data-anim="hero-chip"
            className="absolute -right-4 bottom-10 z-20 [--i:1] flex items-center gap-ds-sm rounded-lg border border-border bg-popover px-ds-md py-ds-sm shadow-xl"
          >
            <Flame className="h-5 w-5 text-warning" />
            <p className="font-label text-label text-popover-foreground">6-week streak</p>
          </div>
          <div
            data-anim="hero-chip"
            className="absolute right-10 top-[46%] z-20 [--i:2] flex items-center gap-ds-sm rounded-full bg-foreground px-ds-md py-ds-xs shadow-xl"
          >
            <WifiOff className="h-4 w-4 text-background" />
            <p className="font-caption text-caption text-background">Works offline</p>
          </div>
        </div>
      </div>
    </section>
  );
}
