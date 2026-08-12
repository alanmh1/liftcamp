import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { loadFunnel } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";

/** Personal first-run funnel: which of the five milestones this account reached. */
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

  return (
    <section className="rounded-lg border border-border p-3">
      <p className="micro text-muted-foreground">Your first-run progress</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className={
                "grid h-4 w-4 shrink-0 place-items-center rounded-full border " +
                (s.reached
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent")
              }
              aria-hidden
            >
              <Check className="h-3 w-3" />
            </span>
            <span className={s.reached ? "" : "text-muted-foreground"}>{s.label}</span>
            {s.at && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {new Date(s.at).toLocaleDateString()}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
