import { useId, useState } from "react";
import {
  BAR_WEIGHT_OPTIONS,
  DEFAULT_PLATES,
  formatPlate,
  perSideLabel,
  platesForWeight,
  type WeightUnit,
} from "@liftcamp/shared";
import { Segmented, UNIT_OPTIONS } from "@/components/strength/Segmented";
import { barbellWarmups } from "@/lib/warmup-calculator";

/**
 * The warm-up sets calculator on /plate-calculator. The sets come from
 * barbellWarmups (lib/warmup-calculator.ts), which runs the app's own
 * warmupSets rule from packages/shared, and the plates come from
 * platesForWeight with the default plates. This file only holds the inputs.
 *
 * The first render is the default (135 lb on a 45 lb bar), so the server
 * sends the answer in the HTML and hydration takes over.
 */

function parseWeight(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function WarmupCalculator({
  defaultWorking,
}: {
  defaultWorking: Record<WeightUnit, number>;
}) {
  const [unit, setUnit] = useState<WeightUnit>("lb");
  const [workingText, setWorkingText] = useState(String(defaultWorking.lb));
  const [bar, setBar] = useState<number>(BAR_WEIGHT_OPTIONS.lb[0]);
  const ids = useId();

  const switchUnit = (u: WeightUnit) => {
    if (u === unit) return;
    setUnit(u);
    setWorkingText(String(defaultWorking[u]));
    setBar(BAR_WEIGHT_OPTIONS[u][0]);
  };

  const working = parseWeight(workingText);
  const sets = working === null ? null : barbellWarmups(working, unit, bar);
  const plates = (w: number) => perSideLabel(platesForWeight(w, bar, DEFAULT_PLATES[unit]));

  const barOptions = BAR_WEIGHT_OPTIONS[unit].map((b) => ({
    value: String(b),
    label: `${formatPlate(b)} ${unit}`,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm shadow-foreground/5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="min-w-0 text-center">
          <label htmlFor={`${ids}-working`} className="block text-[14px] font-semibold">
            Working weight
          </label>
          <div className="mt-1.5 flex items-center justify-center gap-3">
            <div className="relative w-40 min-w-0 shrink">
              <input
                id={`${ids}-working`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={workingText}
                onChange={(e) => setWorkingText(e.target.value)}
                className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 pr-10 text-[16px] tabular-nums text-foreground outline-none transition-colors focus:border-primary"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">
                {unit}
              </span>
            </div>
            <Segmented<WeightUnit>
              label="Unit"
              options={UNIT_OPTIONS}
              value={unit}
              onChange={switchUnit}
            />
          </div>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[14px] font-semibold">Bar weight</p>
          <div className="mt-1.5">
            <Segmented<string>
              label="Bar weight"
              options={barOptions}
              value={String(bar)}
              onChange={(v) => setBar(Number(v))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5" aria-live="polite">
        {sets === null || working === null ? (
          <p className="text-center text-[16px] text-muted-foreground">
            Enter your working weight in {unit}
          </p>
        ) : sets.length === 0 ? (
          <p className="text-center text-[16px] text-muted-foreground">
            At {formatPlate(working)} {unit} the empty bar is warm-up enough. Do one easy set with
            it, then start your working sets.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-[15px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="pb-2 text-[13px] font-semibold">
                  Set
                </th>
                <th scope="col" className="pb-2 text-[13px] font-semibold">
                  Weight
                </th>
                <th scope="col" className="pb-2 text-[13px] font-semibold">
                  Reps
                </th>
                <th scope="col" className="pb-2 text-[13px] font-semibold">
                  Plates
                </th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <th scope="row" className="py-2.5 pr-3 font-semibold">
                    Warm-up {i + 1}
                  </th>
                  <td className="py-2.5 pr-3">
                    {formatPlate(s.weight)} {unit}
                  </td>
                  <td className="py-2.5 pr-3">{s.reps}</td>
                  <td className="py-2.5 text-muted-foreground">{plates(s.weight)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className="py-2.5 pr-3 font-semibold">
                  Working sets
                </th>
                <td className="py-2.5 pr-3 font-semibold">
                  {formatPlate(working)} {unit}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">Your plan</td>
                <td className="py-2.5 text-muted-foreground">{plates(working)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
