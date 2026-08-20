import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Tent, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "liftcamp.onboarding.dismissed.v1";

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  cta?: { label: string; to: string };
};

/**
 * The first-run checklist on the home screen. Unlike the read-only "Set up
 * camp" summary on the profile page, every unfinished step here carries the
 * link that completes it, so there is always one tap between the user and the
 * next milestone. It disappears for good once all steps are done (or dismissed).
 */
export function OnboardingChecklist({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["onboarding-checklist", userId],
    queryFn: async () => {
      const [routine, firstSet, finished] = await Promise.all([
        supabase
          .from("app_events")
          .select("created_at")
          .eq("user_id", userId)
          .eq("name", EVENTS.routineChosen)
          .limit(1),
        supabase
          .from("sets")
          .select("id")
          .eq("user_id", userId)
          .eq("completed", true)
          .limit(1),
        supabase
          .from("workouts")
          .select("id")
          .eq("user_id", userId)
          .not("finished_at", "is", null)
          .limit(1),
      ]);
      return {
        routine: (routine.data?.length ?? 0) > 0,
        set: (firstSet.data?.length ?? 0) > 0,
        finished: (finished.data?.length ?? 0) > 0,
      };
    },
  });

  if (!data || dismissed) return null;

  const steps: Step[] = [
    {
      id: "routine",
      label: "Pick a routine",
      hint: "Choose a starter program, or generate a day.",
      done: data.routine,
      cta: { label: "Browse routines", to: "/routines" },
    },
    {
      id: "set",
      label: "Log your first set",
      hint: "Tap Start Workout, add an exercise, log weight and reps.",
      done: data.set,
    },
    {
      id: "finished",
      label: "Finish a workout",
      hint: "Hit finish and it lands in your history.",
      done: data.finished,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — just hide for this session */
    }
    setDismissed(true);
  }

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the getting started checklist"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          <Tent className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold tracking-tight">Getting started</p>
        <span className="mr-9 ml-auto rounded-full bg-secondary px-2 py-0.5 font-mono text-xs font-semibold text-secondary-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="mt-2.5 px-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="mt-3 flex flex-col gap-1 px-4 pb-4">
        {steps.map((s) => {
          const isNext = s === next;
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2 py-2",
                isNext && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  s.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent",
                )}
                aria-hidden
              >
                <Check className="h-3 w-3" />
              </span>
              <span className="flex-1">
                <span
                  className={cn(
                    "block text-sm",
                    s.done
                      ? "text-muted-foreground line-through"
                      : isNext
                        ? "font-semibold"
                        : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {isNext && (
                  <>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{s.hint}</span>
                    {s.cta && (
                      <Link
                        to={s.cta.to}
                        className="mt-1.5 inline-flex h-8 items-center rounded-md bg-secondary px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s.cta.label}
                      </Link>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
