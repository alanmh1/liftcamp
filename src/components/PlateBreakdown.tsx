import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useGymSettings } from "@/lib/gym-settings";
import {
  perSideLabel,
  smallestIncrement,
  solvePlates,
  trimNum,
  warmupRamp,
  type PlateSolution,
} from "@/lib/plate-math";

function PlateChips({ sol, unit }: { sol: PlateSolution; unit: string }) {
  if (sol.perSide.length === 0) {
    return <span className="text-xs text-muted-foreground italic">empty bar</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {sol.perSide.flatMap((p) =>
        Array.from({ length: p.count }, (_, i) => (
          <span
            key={`${p.size}-${i}`}
            className="num inline-flex h-7 min-w-9 items-center justify-center rounded-full border border-border bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground"
          >
            {trimNum(p.size)}
          </span>
        )),
      )}
      <span className="ml-1 text-[11px] text-muted-foreground">per side ({unit})</span>
    </div>
  );
}

/**
 * "What do I put on the bar?" — per-side plate math for the current set,
 * plus a warm-up ramp to the working weight. Barbell lifts only.
 */
export function PlateBreakdown({ target }: { target: number }) {
  const [open, setOpen] = useState(false);
  const { unit, bar, plates } = useGymSettings();

  const sol = solvePlates(target, bar, plates);
  const ramp = warmupRamp(target, bar, plates);
  const inc = smallestIncrement(plates);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="mt-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Plates: <span className="num">{perSideLabel(sol)}</span>
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            <span className="num">{trimNum(target)}</span> {unit} on the bar
          </DrawerTitle>
        </DrawerHeader>
        <div className="mx-auto w-full max-w-md px-4 pb-8 flex flex-col gap-5">
          <section className="rounded-lg border border-border bg-card px-3 py-3">
            <p className="micro text-muted-foreground">Working set</p>
            <p className="mt-1 text-sm">
              Bar <span className="num font-semibold">{trimNum(bar)}</span> {unit}
            </p>
            <div className="mt-2">
              <PlateChips sol={sol} unit={unit} />
            </div>
            {sol.belowBar ? (
              <p className="mt-2 text-xs text-muted-foreground">
                That's lighter than the bar itself. Use the empty bar, or a fixed barbell if your
                gym has one.
              </p>
            ) : sol.shortBy > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Closest loadable weight is{" "}
                <span className="num font-semibold">{trimNum(sol.achieved)}</span> {unit}
                {inc > 0 && (
                  <>
                    {" "}
                    (your smallest jump is <span className="num">{trimNum(inc)}</span> {unit})
                  </>
                )}
                .
              </p>
            ) : null}
          </section>

          {ramp.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="micro text-muted-foreground">Warm-up ramp</p>
              <ul className="flex flex-col gap-2">
                {ramp.map((step) => (
                  <li
                    key={step.weight}
                    className="rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">
                        <span className="num">{trimNum(step.weight)}</span> {unit} ×{" "}
                        <span className="num">{step.reps}</span>
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {step.pct === 0 ? "empty bar" : `${Math.round(step.pct * 100)}%`}
                      </span>
                    </div>
                    <p className="num mt-1 text-xs text-muted-foreground">
                      {perSideLabel(step.solution)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Rest is short between warm-ups. Save the real rest for your working sets.
              </p>
            </section>
          )}

          <Link
            to="/profile"
            className="flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Edit bar &amp; plates
          </Link>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
