import { Link } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { useFrequencyReminder } from "@/lib/frequency-reminder";

/**
 * Home-screen nudge toward the weekly frequency goal. Non-blocking: it can be
 * snoozed for the day, or turned off entirely from the Dashboard.
 */
export function FrequencyNudge({ userId }: { userId: string }) {
  const { show, message, done, target, dismiss } = useFrequencyReminder(userId);
  if (!show) return null;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Weekly goal reminder</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="num">{done}</span> of <span className="num">{target}</span> sessions
            done this week.
          </p>
          <Link
            to="/history"
            className="mt-2 inline-flex h-9 items-center rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See frequency stats →
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss reminder for today"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
