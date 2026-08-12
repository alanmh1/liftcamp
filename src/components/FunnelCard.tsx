import { useQuery } from "@tanstack/react-query";
import { Check, Tent, Flame } from "lucide-react";
import { loadFunnel } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * "Set up camp" — the personal first-run checklist, framed as a small quest:
 * a step counter, a fill bar, and the next step called out so there is always
 * one obvious thing to do.
 */
export function FunnelCard() {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ["funnel", userId],
    enabled: !!userId,
    queryFn: () => loadFunnel(userId!),
  });

  const steps = q.data ?? [];
  if (steps.length === 0) return null;

  const done = steps.filter((s) => s.reached).length;
  const total = steps.length;
  const complete = done === total;
  const next = steps.find((s) => !s.reached);

  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          {complete ? <Flame className="h-4 w-4" /> : <Tent className="h-4 w-4" />}
        </span>
        <p className="text-sm font-semibold tracking-tight">Set up camp</p>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 font-mono text-xs font-semibold",
            complete ? "bg-pr text-pr-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {done}/{total}
        </span>
      </div>

      <div className="mt-2.5 px-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {complete ? "Camp's set. Now go get stronger." : `Next up: ${next?.label}`}
        </p>
      </div>

      <ol className="mt-2.5 flex flex-col gap-1.5 px-3 pb-3">
        {steps.map((s) => {
          const isNext = !s.reached && s === next;
          return (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors",
                isNext && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  s.reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : isNext
                      ? "border-primary text-transparent"
                      : "border-border text-transparent",
                )}
                aria-hidden
              >
                <Check className="h-3 w-3" />
              </span>
              <span
                className={cn(
                  s.reached ? "" : isNext ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {s.at && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {new Date(s.at).toLocaleDateString()}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
