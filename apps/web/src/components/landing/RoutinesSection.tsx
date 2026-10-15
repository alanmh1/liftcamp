import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Dumbbell, GraduationCap, ArrowRight } from "lucide-react";

type Routine = {
  id: string;
  pill: string;
  days: string;
  experience: string;
  equipment: string;
  title: string;
  meta: string;
  cta: string;
  slug: string;
};

const routines: Routine[] = [
  {
    id: "full-body",
    pill: "Full Body",
    days: "3 / week",
    experience: "Brand new",
    equipment: "Full gym",
    title: "Full Body",
    meta: "3 days · 2 workouts alternated · 3 × 8 to 12",
    cta: "Start Day A",
    slug: "full-body-3-day",
  },
  {
    id: "upper-lower",
    pill: "Upper / Lower",
    days: "4 / week",
    experience: "Some experience",
    equipment: "Full gym",
    title: "Upper / Lower Split",
    meta: "4 days · upper and lower twice each · 3 × 8 to 12",
    cta: "Start Upper A",
    slug: "upper-lower-split",
  },
  {
    id: "ppl",
    pill: "Push / Pull / Legs",
    days: "3 / week",
    experience: "Brand new",
    equipment: "Machines and dumbbells",
    title: "Push / Pull / Legs",
    meta: "3 days · 5 exercises · about 40 minutes",
    cta: "Start Push",
    slug: "push-pull-legs-beginner",
  },
  {
    id: "phul",
    pill: "PHUL",
    days: "4 / week",
    experience: "Experienced",
    equipment: "Full gym",
    title: "PHUL",
    meta: "4 days · two heavy days at 3 to 5 reps, two volume days at 8 to 12",
    cta: "Start Upper Power",
    slug: "phul",
  },
  {
    id: "bro-split",
    pill: "Bro Split",
    days: "5 / week",
    experience: "Experienced",
    equipment: "Full gym",
    title: "Bro Split",
    meta: "5 days · one muscle group per day · 3 × 8 to 12",
    cta: "Start Chest Day",
    slug: "bro-split",
  },
  {
    id: "dumbbell",
    pill: "Dumbbell only",
    days: "3 / week",
    experience: "Brand new",
    equipment: "Two dumbbells and a bench",
    title: "Dumbbell Full Body",
    meta: "3 days · 6 exercises · 3 × 8 to 12",
    cta: "Start Day A",
    slug: "dumbbell-full-body",
  },
  {
    id: "machines",
    pill: "Machines only",
    days: "3 / week",
    experience: "Brand new",
    equipment: "Machines and cables",
    title: "Machines Only",
    meta: "3 days · fixed movement paths, less to learn · 3 × 10 to 12",
    cta: "Start Day A",
    slug: "machines-only-workout",
  },
  {
    id: "bodyweight",
    pill: "Bodyweight only",
    days: "3 / week",
    experience: "Brand new",
    equipment: "None",
    title: "Bodyweight Only",
    meta: "3 days · easiest version of every move on day one · 3 × 8 to 15",
    cta: "Start Day A",
    slug: "bodyweight-workout-plan",
  },
];

export function RoutinesSection() {
  const [activeId, setActiveId] = useState("full-body");
  const active = routines.find((r) => r.id === activeId) ?? routines[0];

  return (
    <section
      id="routines"
      data-reveal-section
      className="relative overflow-hidden bg-primary py-ds-3xl text-primary-foreground"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-[480px] w-[480px] rounded-full bg-pr/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_55%,rgba(255,255,255,0.06)_55%,rgba(255,255,255,0.06)_70%,transparent_70%)]" />

      <div className="relative mx-auto grid max-w-7xl gap-ds-2xl px-ds-lg lg:grid-cols-[7fr_5fr] lg:items-center">
        <div className="min-w-0">
          <p data-reveal="text" className="font-label text-label uppercase tracking-widest text-pr">
            Routines
          </p>
          <h2
            data-reveal="text"
            className="mt-ds-sm max-w-3xl font-heading text-5xl font-extrabold leading-tight tracking-tight"
          >
            A starter routine that actually fits your week.
          </h2>
          <p
            data-reveal="text"
            className="mt-ds-md max-w-2xl font-body text-xl leading-relaxed text-primary-foreground/80"
          >
            Whether you’ve got a full gym, a pair of dumbbells or just the floor, LiftCamp picks a
            proven plan and tells you what to do on every day of it.
          </p>

          <div
            data-reveal="item"
            role="group"
            aria-label="Choose a routine"
            className="-mx-ds-lg mt-ds-xl flex flex-nowrap gap-ds-sm overflow-x-auto px-ds-lg pb-ds-xs [--i:0] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {routines.map((routine, index) => (
              <button
                key={routine.id}
                type="button"
                data-index={index}
                aria-pressed={routine.id === activeId}
                aria-controls="routine-card"
                onClick={() => setActiveId(routine.id)}
                className="shrink-0 whitespace-nowrap rounded-full border border-primary-foreground/30 px-ds-md py-ds-sm font-label text-label text-primary-foreground hover:border-primary-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pr aria-pressed:border-pr aria-pressed:bg-pr aria-pressed:text-pr-foreground motion-safe:transition-colors motion-safe:duration-150"
              >
                {routine.pill}
              </button>
            ))}
          </div>
        </div>

        <div
          id="routine-card"
          aria-live="polite"
          data-reveal="item"
          className="[--i:1] rotate-2 rounded-xl bg-popover p-ds-lg text-popover-foreground shadow-2xl shadow-foreground/30"
        >
          <p className="font-caption text-caption uppercase tracking-wider text-muted-foreground">
            Build my routine
          </p>
          <div key={active.id} data-anim="swap">
            <div className="mt-ds-md space-y-ds-sm">
              <div className="flex items-center justify-between gap-ds-md rounded-md bg-muted px-ds-md py-ds-sm">
                <span className="flex shrink-0 items-center gap-ds-sm font-label text-label">
                  <CalendarDays className="h-4 w-4 text-primary" /> Training days
                </span>
                <span className="text-right font-heading text-lg font-bold">{active.days}</span>
              </div>
              <div className="flex items-center justify-between gap-ds-md rounded-md bg-muted px-ds-md py-ds-sm">
                <span className="flex shrink-0 items-center gap-ds-sm font-label text-label">
                  <GraduationCap className="h-4 w-4 text-primary" /> Experience
                </span>
                <span className="text-right font-heading text-lg font-bold">
                  {active.experience}
                </span>
              </div>
              <div className="flex items-center justify-between gap-ds-md rounded-md bg-muted px-ds-md py-ds-sm">
                <span className="flex shrink-0 items-center gap-ds-sm font-label text-label">
                  <Dumbbell className="h-4 w-4 text-primary" /> Equipment
                </span>
                <span className="text-right font-heading text-lg font-bold">
                  {active.equipment}
                </span>
              </div>
            </div>
            <div className="mt-ds-md rounded-lg border-2 border-primary bg-accent p-ds-md">
              <p className="font-caption text-caption text-accent-foreground">
                Recommended for you
              </p>
              <p className="mt-ds-xs font-heading text-2xl font-bold text-accent-foreground">
                {active.title}
              </p>
              <p className="font-body text-sm text-muted-foreground">{active.meta}</p>
            </div>
            <Link
              to="/routines/$slug"
              params={{ slug: active.slug }}
              className="mt-ds-md flex h-12 items-center justify-center gap-ds-sm rounded-lg bg-primary font-label text-label text-primary-foreground hover:bg-primary/90"
            >
              {active.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
