import type { CSSProperties } from "react";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "Is LiftCamp really free?",
    a: "Yes. The app, the routines, the exercise library and the progress charts are free. No ads, no trial, no card required.",
  },
  {
    q: "I’ve never lifted before. Is this for me?",
    a: "That’s exactly who it’s built for. Pick “brand new” and LiftCamp starts you on a simple routine with clear instructions for every exercise. When you outgrow it, PHUL, Push/Pull/Legs and more are waiting.",
  },
  {
    q: "Do I need an account?",
    a: "Not to get started. Try a workout first, then create a free account with Apple, Google or email when you want to save it.",
  },
  {
    q: "Does it work without signal?",
    a: "Yes. Workouts are stored on your phone while you train and sync once you’re connected again.",
  },
  {
    q: "I’m on Android. Can I still use LiftCamp?",
    a: "Not yet. LiftCamp is on Android soon. Leave your email above and we will tell you the day it lands.",
  },
  {
    q: "What about my privacy?",
    a: "Your workouts are private unless you share a summary or approve someone to follow you. LiftCamp does not sell data or run ads.",
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      data-reveal-section
      className="scroll-mt-24 mx-auto max-w-7xl px-ds-lg py-ds-3xl"
    >
      <div className="grid gap-ds-2xl lg:grid-cols-[4fr_8fr]">
        <div>
          <p
            data-reveal="text"
            className="font-label text-label uppercase tracking-widest text-primary"
          >
            FAQ
          </p>
          <h2
            data-reveal="text"
            className="mt-ds-sm font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
          >
            Good questions.
          </h2>
          <p data-reveal="text" className="mt-ds-md font-body text-body text-muted-foreground">
            Requires iOS 16.4 or later. Supports Larger Text, Dark Interface and Reduced Motion.
          </p>
        </div>
        <div className="space-y-ds-sm">
          {faqs.map((item, index) => (
            <details
              key={index}
              data-reveal="item"
              style={{ "--i": index } as CSSProperties}
              className="group rounded-lg border border-border bg-card px-ds-lg py-ds-md open:shadow-md hover:shadow-lg motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-ds-md font-heading text-xl font-bold text-card-foreground [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-5 w-5 shrink-0 text-primary motion-safe:transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-ds-sm max-w-3xl font-body text-body text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
