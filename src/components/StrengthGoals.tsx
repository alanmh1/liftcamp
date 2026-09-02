import { useState } from "react";
import { Target, Trophy, Trash2, Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWeightUnit } from "@/lib/weight-unit";
import {
  useStrengthGoals,
  useStrengthGoalReminder,
  useTrainingAge,
} from "@/lib/strength-goals";
import { roundLoad } from "@/lib/one-rep-max-model";
import { OneRepMaxCalculator } from "@/components/OneRepMaxCalculator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Dashboard strength goals: a target weight per lift, measured against the
 * training-age adjusted 1RM estimate, plus the reminder that nudges the lift
 * back into rotation when it goes stale.
 */
export function StrengthGoals({ userId }: { userId: string }) {
  const { unit } = useWeightUnit();
  const { trainingAge, setTrainingAge } = useTrainingAge();
  const { goals, isLoading, save, remove } = useStrengthGoals(userId, trainingAge);
  const reminder = useStrengthGoalReminder(userId);
  const [editing, setEditing] = useState<
    { exerciseId?: string; name?: string; id?: string; target: string } | null
  >(null);

  return (
    <div className="flex flex-col gap-4">
      <OneRepMaxCalculator
        userId={userId}
        trainingAge={trainingAge}
        setTrainingAge={setTrainingAge}
        onUseAsGoal={(exerciseId, name, suggested) =>
          setEditing({ exerciseId, name, target: String(suggested) })
        }
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Strength goals</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A target weight per lift, tracked against your estimated 1RM.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ target: "" })}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
        </div>

        {isLoading ? (
          <Skeleton className="mt-3 h-20 w-full rounded-lg" />
        ) : goals.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No goals yet. Pick a lift and a number you want on the bar.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {goals.map((g) => (
              <li key={g.id} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    {g.reached ? (
                      <Trophy className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Target className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {g.best != null ? (
                        <>
                          <span className="num">{roundLoad(g.best)}</span> / {""}
                          <span className="num">{roundLoad(g.target)}</span> {unit} est. 1RM
                        </>
                      ) : (
                        <>
                          Target <span className="num">{roundLoad(g.target)}</span> {unit} — no
                          sets logged yet
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    <span className="num">{g.pct}</span>%
                  </p>
                </div>
                <Progress value={g.pct} className="mt-2 h-2" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-muted-foreground">
                    {g.reached
                      ? "Goal reached — raise the bar."
                      : g.best != null
                        ? `${roundLoad(g.target - g.best)} ${unit} to go`
                        : "Log a set on this lift to start tracking."}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ id: g.id, name: g.name, target: String(g.target) })
                      }
                      className="inline-flex h-8 items-center rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${g.name} goal`}
                      onClick={() =>
                        remove.mutate(g.id, {
                          onSuccess: () => toast.success("Goal cleared"),
                          onError: () => toast.error("Couldn't clear that goal"),
                        })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold">
              <Bell className="h-3.5 w-3.5" aria-hidden />
              Remind me about my goals
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {reminder.enabled
                ? reminder.message ||
                  "You're on top of your goal lifts — no nudge needed right now."
                : "Reminders are off. Turn them on to get nudged when a goal lift goes stale."}
            </p>
          </div>
          <Switch
            checked={reminder.enabled}
            onCheckedChange={(v) => reminder.setEnabled(v)}
            aria-label="Strength goal reminders"
          />
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit strength goal" : "New strength goal"}</DialogTitle>
            <DialogDescription>
              Progress uses your best training-age adjusted 1RM estimate for that lift.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <GoalForm
              unit={unit}
              initial={editing}
              saving={save.isPending}
              onSubmit={(exerciseId, target) =>
                save.mutate(
                  { id: editing.id, exerciseId, target },
                  {
                    onSuccess: () => {
                      setEditing(null);
                      toast.success("Goal saved");
                    },
                    onError: (e) =>
                      toast.error(e instanceof Error ? e.message : "Couldn't save that goal"),
                  },
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalForm({
  unit,
  initial,
  saving,
  onSubmit,
}: {
  unit: string;
  initial: { exerciseId?: string; name?: string; id?: string; target: string };
  saving: boolean;
  onSubmit: (exerciseId: string, target: number) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    initial.exerciseId && initial.name ? { id: initial.exerciseId, name: initial.name } : null,
  );
  const [target, setTarget] = useState(initial.target);

  const results = useQuery({
    enabled: !initial.id && q.trim().length >= 2,
    queryKey: ["strength-goal-search", q.trim()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number.parseFloat(target);
        if (!initial.id && !picked) {
          toast.error("Pick a lift first");
          return;
        }
        if (!Number.isFinite(n) || n <= 0) {
          toast.error("Enter a target weight");
          return;
        }
        onSubmit(picked?.id ?? initial.exerciseId ?? "", n);
      }}
    >
      {initial.id ? (
        <p className="text-sm font-medium">{initial.name}</p>
      ) : picked ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <p className="truncate text-sm font-medium">{picked.name}</p>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a lift…"
            aria-label="Search exercises"
          />
          {(results.data ?? []).length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
              {(results.data ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked({ id: r.id, name: r.name })}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Target 1RM ({unit})
        <Input
          className="mt-1.5"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="100"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {saving ? "Saving…" : "Save goal"}
      </button>
    </form>
  );
}
