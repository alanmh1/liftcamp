import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { EVENTS, track } from "@/lib/analytics";
import {
  meaningfulSets,
  readTrialLog,
  writeTrialLog,
  type TrialSet,
} from "@/lib/trial-log";

const EMPTY: TrialSet[] = [
  { weight: "", reps: "" },
  { weight: "", reps: "" },
  { weight: "", reps: "" },
];

/**
 * The signed-out logger on public exercise pages.
 *
 * Reader arrives from search, reads how to do the lift, and can log it right
 * there. Nothing leaves the device until they create an account, at which point
 * claimTrialLog() turns the draft into a real workout — so the CTA is "keep this"
 * rather than "sign up".
 */
export function TrialLogger({
  exerciseId,
  exerciseName,
  exerciseSlug,
}: {
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
}) {
  const { session, loading } = useAuth();
  const [sets, setSets] = useState<TrialSet[]>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [tracked, setTracked] = useState(false);

  // localStorage only after mount — this page is server-rendered.
  useEffect(() => {
    const existing = readTrialLog();
    if (existing && existing.exerciseId === exerciseId && existing.sets.length > 0) {
      setSets(existing.sets);
    }
    setHydrated(true);
  }, [exerciseId]);

  useEffect(() => {
    if (!hydrated || session) return;
    writeTrialLog({
      exerciseId,
      exerciseName,
      exerciseSlug,
      sets,
      updatedAt: Date.now(),
    });
  }, [hydrated, session, sets, exerciseId, exerciseName, exerciseSlug]);

  function update(i: number, patch: Partial<TrialSet>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    if (!tracked) {
      setTracked(true);
      void track(EVENTS.trialSetLogged ?? "trial_set_logged", { exercise: exerciseName });
    }
  }

  const filled = meaningfulSets({
    exerciseId,
    exerciseName,
    exerciseSlug,
    sets,
    updatedAt: 0,
  }).length;

  if (loading) return null;

  if (session) {
    return (
      <section className="mt-8 rounded-xl border border-border bg-secondary/40 p-5">
        <h2 className="text-lg font-semibold tracking-tight">Log this lift</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          Start a workout and add {exerciseName} to it. LiftCamp fills in what you
          lifted last time.
        </p>
        <Link
          to="/"
          className="mt-3 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
        >
          Open LiftCamp
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-secondary/40 p-5">
      <h2 className="text-lg font-semibold tracking-tight">Log your sets</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        No account needed. Type what you lifted — it saves on this device.
      </p>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[28px_1fr_1fr_32px] items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Set</span>
          <span>Weight</span>
          <span>Reps</span>
          <span className="sr-only">Remove</span>
        </div>
        {sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_1fr_32px] items-center gap-2">
            <span className="text-[15px] font-semibold text-muted-foreground">{i + 1}</span>
            <input
              value={s.weight}
              onChange={(e) => update(i, { weight: e.target.value })}
              inputMode="decimal"
              placeholder="—"
              aria-label={`Set ${i + 1} weight`}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={s.reps}
              onChange={(e) => update(i, { reps: e.target.value })}
              inputMode="numeric"
              placeholder="—"
              aria-label={`Set ${i + 1} reps`}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              aria-label={`Remove set ${i + 1}`}
              onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={sets.length <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSets((prev) => [...prev, { weight: "", reps: "" }])}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[15px] font-medium transition-colors hover:border-primary"
      >
        <Plus className="h-4 w-4" />
        Add set
      </button>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-[15px] leading-relaxed">
          {filled > 0 ? (
            <>
              <span className="font-semibold">
                {filled} set{filled === 1 ? "" : "s"} saved on this device.
              </span>{" "}
              Create a free account to keep them and see these weights next session.
            </>
          ) : (
            <>Create a free account and LiftCamp remembers every set, so next week you
            know exactly what to add.</>
          )}
        </p>
        <Link
          to="/login"
          search={{ mode: "signup" }}
          className="mt-3 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[16px] font-semibold text-primary-foreground"
        >
          {filled > 0 ? "Keep this workout — it's free" : "Track this lift free"}
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          No card, no app store. Works in your browser.
        </p>
      </div>
    </section>
  );
}
