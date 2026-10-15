import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";
import { LOGO_MARK_SRC } from "@/lib/brand";

export function FinalCta() {
  return (
    <section data-reveal-section className="mx-auto max-w-7xl px-ds-lg pb-ds-3xl">
      <div className="relative overflow-hidden rounded-xl bg-primary px-ds-xl py-ds-3xl text-center text-primary-foreground">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-pr/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center">
          <img
            src={LOGO_MARK_SRC}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 rounded-[22px] drop-shadow-xl"
          />
          <h2
            data-reveal="text"
            className="mt-ds-lg font-display text-6xl font-extrabold leading-none tracking-tight lg:text-display"
          >
            Your first workout is one tap away.
          </h2>
          <p
            data-reveal="text"
            className="mt-ds-lg max-w-xl font-body text-xl leading-relaxed text-primary-foreground/80"
          >
            Download LiftCamp free on iPhone. No experience needed. Just show up.
          </p>
          <div
            data-reveal="item"
            className="mt-ds-xl flex flex-wrap items-center justify-center gap-ds-md [--i:0]"
          >
            <AppStoreBadge tone="white" height={54} campaign="landing-cta" />
          </div>
          <AndroidNotify source="cta" tone="dark" className="flex flex-col items-center" />
        </div>
      </div>
    </section>
  );
}
