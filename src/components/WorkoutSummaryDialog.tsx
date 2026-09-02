import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookmarkPlus, Trophy } from "lucide-react";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import type { Milestone } from "@/lib/milestones";
import type { SessionTotals } from "@/lib/workout-summary";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export type WorkoutSummary = {
  workoutName: string;
  totals: SessionTotals;
  minutes: number | null;
  unit: string;
  /** Null while the follow-up queries are still in flight. */
  prNames: string[] | null;
  milestones: Milestone[] | null;
  volumePct: number | null;
  /** Lifetime finished-workout count, null until the follow-up query lands. */
  finishedCount: number | null;
  /** Exercise ids in workout order, for saving this session as a template. */
  exerciseIds: string[];
};

/**
 * Neutral sign-offs. Deliberately say nothing about how much was lifted or how
 * hard the session was: effort praise reads as sarcasm after a short day.
 */
const SIGN_OFFS = [
  "Nice one.",
  "Another one!",
  "Good work.",
  "That's a wrap.",
  "Session logged.",
  "Done and dusted.",
  "In the books.",
  "Logged it.",
  "That'll do.",
  "Boo-yah!",
  "Get in!",
  "Let's go.",
  "Beautiful.",
  "Yes! Another one.",
  "Big day.",
];

/** True once mounted and the user has not asked for reduced motion. */
function useAnimated(): boolean | null {
  const [animated, setAnimated] = useState<boolean | null>(null);
  useEffect(() => {
    setAnimated(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return animated;
}

/** Counts from 0 to `value` with an ease-out over ~600ms. */
function useCountUp(value: number, animated: boolean | null): number {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (animated !== true) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animated]);
  return n;
}

function Rise({
  animated,
  index,
  className,
  children,
}: {
  animated: boolean | null;
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  if (animated === null) return null;
  if (!animated) return <div className={className}>{children}</div>;
  return (
    <div
      className={className}
      style={{
        animation: "fade-in 0.35s ease-out both",
        animationDelay: `${index * 60}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="num text-2xl font-semibold tabular-nums">{value}</span>
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
  const [savingTemplate, setSavingTemplate] = useState(false);
  const animated = useAnimated();
  const firedConfetti = useRef(false);

  const totals = summary?.totals;
  const prNames = summary?.prNames ?? null;
  const milestones = summary?.milestones ?? null;
  const celebrate = (milestones?.length ?? 0) > 0 || (prNames?.length ?? 0) > 0;

  const exerciseCount = useCountUp(totals?.exerciseCount ?? 0, animated);
  const setCount = useCountUp(totals?.setCount ?? 0, animated);
  const minuteCount = useCountUp(summary?.minutes ?? 0, animated);
  const volumeCount = useCountUp(totals?.volume ?? 0, animated);

  useEffect(() => {
    if (animated !== true || !celebrate || firedConfetti.current) return;
    firedConfetti.current = true;
    let cancelled = false;
    void (async () => {
      const confetti = (await import("canvas-confetti")).default;
      if (cancelled) return;
      confetti({
        particleCount: 60,
        spread: 70,
        ticks: 120,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#1B5FA8", "#F5D272"],
        disableForReducedMotion: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [animated, celebrate]);

  if (!summary || !totals) return null;
  const { minutes, unit, volumePct } = summary;
  const exerciseIds = summary.exerciseIds ?? [];

  const headline =
    milestones && milestones.length > 0
      ? milestones[0].title
      : prNames && prNames.length > 0
        ? prNames.length > 1
          ? "New personal records"
          : "New personal record"
        : SIGN_OFFS[(summary.finishedCount ?? 0) % SIGN_OFFS.length];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 p-0 pb-6">
        <DialogHeader className="px-6 pt-6 pb-4 text-center">
          <DialogTitle className="font-display text-xl">{headline}</DialogTitle>
          <p className="text-sm text-muted-foreground">{summary.workoutName}</p>
          {summary.finishedCount != null && (
            <p className="num text-xs text-muted-foreground">
              Workout #{summary.finishedCount}
            </p>
          )}
        </DialogHeader>

        <div className="px-6">
          <Rise animated={animated} index={0}>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-4">
              <Stat value={Math.round(exerciseCount).toString()} label="Exercises" />
              <Stat value={Math.round(setCount).toString()} label="Sets" />
              <Stat
                value={minutes != null ? `${Math.round(minuteCount)}m` : "—"}
                label="Time"
              />
            </div>
          </Rise>

          <Rise animated={animated} index={1} className="mt-4 text-center">
            <span className="num text-lg font-semibold">
              {Math.round(volumeCount).toLocaleString()} {unit}
            </span>
            {" "}
            lifted
            {volumePct != null && volumePct > 0 && (
              <span className="num ml-1 text-sm text-muted-foreground">
                {" "}(+{volumePct}% vs last time)
              </span>
            )}
          </Rise>

          {prNames != null && prNames.length > 0 && (
            <Rise animated={animated} index={2} className="mt-4">
              <div className="rounded-xl border border-pr bg-pr/10 p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-pr" aria-hidden />
                  <span className="text-sm font-semibold">
                    {prNames.length} personal record{prNames.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {prNames.join(", ")}
                </p>
              </div>
            </Rise>
          )}

          {milestones != null &&
            milestones.map((m, i) => (
              <Rise key={m.title} animated={animated} index={3 + i} className="mt-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </div>
              </Rise>
            ))}

          {exerciseIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSavingTemplate(true)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Save as template
            </button>
          )}

          <SaveAsTemplateDialog
            open={savingTemplate}
            onOpenChange={setSavingTemplate}
            defaultName={summary.workoutName}
            exerciseIds={exerciseIds}
          />

          {summary.finishedCount === 1 && <InstallPrompt />}

          <button
            onClick={onClose}
            className="mt-3 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
