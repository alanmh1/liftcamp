import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";

/** The plate blue band at the end of /routines. The mock's sign-up button is
 *  left out (there is no web sign-up); the App Store badge and the Android
 *  waitlist do that job, as on the landing page's closing band. */
export function RoutinesCta() {
  return (
    <section aria-labelledby="routines-cta" className="mx-auto max-w-[1080px] px-5 pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <h2
            id="routines-cta"
            className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]"
          >
            Start one of these today
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
            The app keeps your weights between sessions, so next week it tells you what you lifted
            last time.
          </p>
          <AppStoreBadge tone="white" height={48} campaign="routines" className="mt-8" />
          <AndroidNotify source="routines" tone="dark" className="flex flex-col items-center" />
        </div>
      </div>
    </section>
  );
}
