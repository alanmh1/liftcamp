import { PageGlow } from "@/components/PageGlow";

/** The /routines title block, on the shared page glow. */
export function RoutinesHeader() {
  return (
    <section className="relative overflow-hidden">
      <PageGlow />
      <div className="relative mx-auto max-w-[1080px] px-5 pb-10 pt-12 sm:pt-16 lg:pb-12 lg:pt-20">
        <h1 className="max-w-3xl text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[52px] lg:text-[64px]">
          Free workout routines for beginners
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-[1.6] text-foreground/75 sm:text-lg">
          Free workout plans for your first six months of lifting. Each routine lists every exercise
          with sets and reps, so you know what you're doing before you walk in. Use one as written or
          copy it and change whatever you want.
        </p>
      </div>
    </section>
  );
}
