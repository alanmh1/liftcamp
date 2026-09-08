import { Link } from "@tanstack/react-router";
import { Target, X } from "lucide-react";
import { useStrengthGoalReminder } from "@/lib/strength-goals";

/**
 * Home-screen nudge toward a strength goal whose lift has gone stale. Can be
 * snoozed for the day or turned off from the Dashboard.
 */
export function StrengthGoalNudge({ userId }: { userId: string }) {
  const { show, message, goal, dismiss } = useStrengthGoalReminder(userId);
  if (!show || !goal) return null;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Target className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Strength goal</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{message}</p>
          <Link
            to="/history"
            className="mt-2 inline-flex h-9 items-center rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See goal progress →
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss goal reminder for today"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
