import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy } from "lucide-react";
import type { Milestone } from "@/lib/milestones";
import type { SessionTotals } from "@/lib/workout-summary";

export type WorkoutSummary = {
  workoutName: string;
  totals: SessionTotals;
  minutes: number | null;
  unit: string;
  /** Null while the follow-up queries are still in flight. */
  prNames: string[] | null;
  milestones: Milestone[] | null;
  volumePct: number | null;
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Shown once, right after a workout is finished. Every session gets a readout,
 * so the finish moment carries something even between round-number milestones.
 */
export function WorkoutSummaryDialog({
  summary,
  onClose,
}: {
  summary: WorkoutSummary | null;
  onClose: () => void;
}) {
  if (!summary) return null;
  const { totals, minutes, unit, prNames, milestones, volumePct } = summary;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 p-0 pb-6">
        <DialogHeader className="px-6 pt-6 pb-4 text-center">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {summary.workoutName} done
          </DialogTitle>
        </DialogHeader>

        <div className="px-6">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-4">
            <Stat value={totals.exerciseCount.toString()} label="Exercises" />
            <Stat value={totals.setCount.toString()} label="Sets" />
            <Stat value={minutes != null ? `${minutes}m` : "—"} label="Time" />
          </div>

          <div className="mt-4 text-center">
            <span className="text-lg font-semibold">
              {Math.round(totals.volume).toLocaleString()} {unit}
            </span>
            {" "}
            lifted
            {volumePct != null && (
              <span className="ml-1 text-sm text-muted-foreground">
                {" "}({volumePct > 0 ? "+" : ""}{volumePct}% vs last time)
              </span>
            )}
          </div>

          {prNames != null && prNames.length > 0 && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {prNames.length} personal record{prNames.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {prNames.join(", ")}
              </p>
            </div>
          )}

          {milestones != null &&
            milestones.map((m) => (
              <div
                key={m.title}
                className="mt-3 rounded-xl border border-border bg-background p-4"
              >
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </div>
            ))}

          <button
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
