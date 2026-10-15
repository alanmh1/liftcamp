import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";
import { LOGO_MARK_SRC } from "@/lib/brand";

export function TrackInAppCard() {
  return (
    <aside
      aria-labelledby="track-heading"
      className="relative overflow-hidden rounded-xl bg-primary p-ds-xl text-primary-foreground shadow-xl shadow-primary/20"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pr/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative">
        <img
          src={LOGO_MARK_SRC}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-[16px] drop-shadow-lg"
        />
        <h2
          id="track-heading"
          className="mt-ds-lg font-heading text-3xl font-extrabold leading-tight tracking-tight"
        >
          Track this lift in the app
        </h2>
        <p className="mt-ds-sm font-body text-body text-primary-foreground/85">
          Last session's numbers beside every set, a rest timer that starts itself, and a streak for
          showing up.
        </p>
        <AppStoreBadge tone="white" height={48} campaign="exercise-detail" className="mt-ds-lg" />
        <AndroidNotify source="exercise" tone="dark" />
      </div>
    </aside>
  );
}
