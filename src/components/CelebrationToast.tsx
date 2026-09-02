import { toast } from "sonner";
import { Trophy, Flame } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Celebration toasts for the two moments worth interrupting for: a new personal
 * record on a lift, and crossing a lifetime volume milestone.
 *
 * Rendered with `toast.custom` so the card can carry its own entrance animation
 * and a sweep of light across the medal — the default sonner card can't.
 */

function Card({
  tone,
  icon,
  eyebrow,
  title,
  detail,
}: {
  tone: "pr" | "volume";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  const accent = tone === "pr" ? "border-pr bg-pr/10" : "border-primary/40 bg-primary/10";
  const iconWrap = tone === "pr" ? "bg-pr text-pr-foreground" : "bg-primary text-primary-foreground";
  return (
    <div
      className={`celebrate-pop relative w-full overflow-hidden rounded-xl border ${accent} bg-background p-4 shadow-lg`}
    >
      <span aria-hidden className="celebrate-sheen pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-3">
        <span
          className={`celebrate-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <p className="truncate text-sm font-semibold">{title}</p>
          {detail && <p className="num truncate text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

function round(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString();
}

/**
 * Fires when a completed set beats the best estimated 1RM for that lift.
 * Shows the exact lift and the exact weight × reps that did it.
 */
export function celebratePr(opts: {
  exercise: string;
  /** Effective load in the user's unit (bodyweight already folded in). */
  load: number | null;
  reps: number | null;
  orm: number;
  unit: string;
}) {
  const { exercise, load, reps, orm, unit } = opts;
  const lift =
    load != null && reps
      ? `${round(load)} ${unit} × ${reps}`
      : load != null
        ? `${round(load)} ${unit}`
        : null;
  haptic([20, 50, 20]);
  toast.custom(
    () => (
      <Card
        tone="pr"
        icon={<Trophy className="h-5 w-5" aria-hidden />}
        eyebrow="New personal record"
        title={exercise}
        detail={`${lift ? `${lift} · ` : ""}est. 1RM ${round(orm)} ${unit}`}
      />
    ),
    { duration: 5000 },
  );
}

/** Fires when lifetime volume crosses a round number. */
export function celebrateVolumeMilestone(opts: {
  title: string;
  description: string;
}) {
  haptic([20, 60, 20]);
  toast.custom(
    () => (
      <Card
        tone="volume"
        icon={<Flame className="h-5 w-5" aria-hidden />}
        eyebrow="Milestone"
        title={opts.title}
        detail={opts.description}
      />
    ),
    { duration: 6000 },
  );
}
