import { useId, useState } from "react";
import {
  BAR_WEIGHT_OPTIONS,
  DEFAULT_PLATES,
  formatPlate,
  perSideLabel,
  perSideSpoken,
  PLATE_OPTIONS,
  plateColor,
  plateGroups,
  plateShortfall,
  plateSize,
  platesForWeight,
  type PlateColor,
  type PlateSize,
  type WeightUnit,
} from "@liftcamp/shared";
import { Segmented, UNIT_OPTIONS } from "@/components/strength/Segmented";
import { cn } from "@/lib/utils";

/**
 * The plate calculator. Every number comes from packages/shared/src/plates.ts:
 * platesForWeight for the load, plateGroups, perSideLabel and perSideSpoken
 * for the text, plateShortfall for the line under it, and plateColor and
 * plateSize for the drawing. This file only holds the inputs.
 *
 * The first render is the default (135 lb, 45 lb bar, the default plates),
 * so the server sends the answer in the HTML and hydration takes over.
 */

/** The same Chalk tones as the app's barbell figure
 *  (apps/mobile/src/components/barbell-figure.tsx). Yellow is a muted ochre,
 *  since flat gold is for PRs only. */
const PLATE_TONES: Record<PlateColor, { fill: string; text: string; border?: string }> = {
  blue: { fill: "#1B5FA8", text: "#FFFFFF" },
  yellow: { fill: "#C49A2C", text: "#221F1B" },
  green: { fill: "#2E8A57", text: "#FFFFFF" },
  white: { fill: "#FDFCFB", text: "#221F1B", border: "#DCD6CD" },
  red: { fill: "#B8402F", text: "#FFFFFF" },
  small: { fill: "#5A554C", text: "#FFFFFF" },
};

/** A typed total: empty or unreadable is null. */
function parseTarget(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PlateCalculator({ defaultTarget }: { defaultTarget: Record<WeightUnit, number> }) {
  const [unit, setUnit] = useState<WeightUnit>("lb");
  const [targetText, setTargetText] = useState(String(defaultTarget.lb));
  const [bar, setBar] = useState<number>(BAR_WEIGHT_OPTIONS.lb[0]);
  const [plates, setPlates] = useState<readonly number[]>(DEFAULT_PLATES.lb);
  const ids = useId();

  const switchUnit = (u: WeightUnit) => {
    if (u === unit) return;
    setUnit(u);
    setTargetText(String(defaultTarget[u]));
    setBar(BAR_WEIGHT_OPTIONS[u][0]);
    setPlates(DEFAULT_PLATES[u]);
  };

  const togglePlate = (p: number) =>
    setPlates((cur) =>
      cur.includes(p)
        ? cur.filter((x) => x !== p)
        : PLATE_OPTIONS[unit].filter((o) => o === p || cur.includes(o)),
    );

  const target = parseTarget(targetText);
  const load = target === null ? null : platesForWeight(target, bar, plates);
  const underBar = target !== null && target < bar;
  const short = load && target !== null && !underBar ? plateShortfall(target, load) : null;

  const barOptions = BAR_WEIGHT_OPTIONS[unit].map((b) => ({
    value: String(b),
    label: `${formatPlate(b)} ${unit}`,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm shadow-foreground/5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${ids}-target`} className="block text-[14px] font-semibold">
            Total weight
          </label>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <input
                id={`${ids}-target`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
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

        <div className="min-w-0">
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

      <fieldset className="mt-5 min-w-0">
        <legend className="text-[14px] font-semibold">Plates you have</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PLATE_OPTIONS[unit].map((p) => {
            const on = plates.includes(p);
            return (
              <label
                key={p}
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[15px] tabular-nums transition-colors",
                  on
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => togglePlate(p)}
                  className="h-4 w-4 accent-[#1B5FA8]"
                />
                {formatPlate(p)}
                <span className="sr-only"> {unit}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 border-t border-border pt-5" aria-live="polite">
        {load === null || target === null ? (
          <p className="text-[16px] text-muted-foreground">Enter a total weight in {unit}</p>
        ) : (
          <>
            <p className="text-[14px] text-muted-foreground tabular-nums">
              {formatPlate(target)} {unit} on a {formatPlate(bar)} {unit} bar
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
              {perSideLabel(load)}
            </p>
            <BarbellDrawing perSide={load.perSide} unit={unit} label={perSideSpoken(load)} />
            {load.perSide.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 p-0" aria-hidden>
                {plateGroups(load).map((g) => {
                  const tone = PLATE_TONES[plateColor(g.plate, unit)];
                  return (
                    <li
                      key={g.plate}
                      className="inline-flex items-center gap-1.5 text-[15px] tabular-nums"
                    >
                      <span
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold"
                        style={{
                          background: tone.fill,
                          color: tone.text,
                          border: tone.border ? `1px solid ${tone.border}` : undefined,
                        }}
                      >
                        {formatPlate(g.plate)}
                      </span>
                      <span className="text-muted-foreground">×{g.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {underBar && (
              <p className="mt-3 text-[15px] text-muted-foreground tabular-nums">
                The bar alone weighs {formatPlate(bar)} {unit}
              </p>
            )}
            {short && (
              <p className="mt-3 text-[15px] text-muted-foreground tabular-nums">
                {short.before}
                <span className="font-semibold text-foreground">
                  {formatPlate(short.closest)} {unit}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// The drawing's own units, the same geometry as the app's barbell figure.
const VB_W = 342;
const VB_H = 120;
const CY = VB_H / 2;
const MID = VB_W / 2;
const GRIP_HALF = 38;
const GRIP_H = 6;
const COLLAR_W = 8;
const COLLAR_H = 26;
const SLEEVE_H = 14;
const EDGE = 2;
const GAP = 2;
/** Heights by weight class, not in proportion to the weight. */
const PLATE_H: Record<PlateSize, number> = { big: 104, medium: 72, small: 44 };
const PLATE_W: Record<PlateSize, number> = { big: 18, medium: 16, small: 8 };
const COLLAR_OUT = MID - GRIP_HALF - COLLAR_W;
const SLEEVE_ROOM = COLLAR_OUT - GAP - EDGE;

/** A side view of the loaded bar: plates from the collar outward on each
 *  sleeve, mirrored. A load wider than the sleeve narrows every plate and
 *  gap by the same factor so it still fits. */
function BarbellDrawing({
  perSide,
  unit,
  label,
}: {
  perSide: readonly number[];
  unit: WeightUnit;
  label: string;
}) {
  const plates = perSide.map((p) => ({
    size: plateSize(p, unit),
    tone: PLATE_TONES[plateColor(p, unit)],
  }));
  const stack =
    plates.reduce((sum, p) => sum + PLATE_W[p.size], 0) + GAP * Math.max(plates.length - 1, 0);
  const scale = stack > SLEEVE_ROOM ? SLEEVE_ROOM / stack : 1;
  const left: number[] = [];
  let cursor = COLLAR_OUT - GAP;
  for (const p of plates) {
    const w = PLATE_W[p.size] * scale;
    left.push(cursor - w);
    cursor -= w + GAP * scale;
  }
  const bar = "#A39C91";
  const collar = "#6B645A";

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={label}
      className="mt-4 block h-auto w-full max-w-[520px]"
    >
      <rect
        x={EDGE}
        y={CY - SLEEVE_H / 2}
        width={COLLAR_OUT - EDGE}
        height={SLEEVE_H}
        rx={3}
        fill={bar}
      />
      <rect
        x={VB_W - COLLAR_OUT}
        y={CY - SLEEVE_H / 2}
        width={COLLAR_OUT - EDGE}
        height={SLEEVE_H}
        rx={3}
        fill={bar}
      />
      <rect
        x={MID - GRIP_HALF}
        y={CY - GRIP_H / 2}
        width={GRIP_HALF * 2}
        height={GRIP_H}
        rx={2}
        fill={bar}
      />
      <rect
        x={COLLAR_OUT}
        y={CY - COLLAR_H / 2}
        width={COLLAR_W}
        height={COLLAR_H}
        rx={2}
        fill={collar}
      />
      <rect
        x={VB_W - COLLAR_OUT - COLLAR_W}
        y={CY - COLLAR_H / 2}
        width={COLLAR_W}
        height={COLLAR_H}
        rx={2}
        fill={collar}
      />
      {plates.map((p, i) => {
        const w = PLATE_W[p.size] * scale;
        const h = PLATE_H[p.size];
        const stroke = p.tone.border ? { stroke: p.tone.border, strokeWidth: 1 } : {};
        return (
          <g key={i}>
            <rect
              x={left[i]}
              y={CY - h / 2}
              width={w}
              height={h}
              rx={4}
              fill={p.tone.fill}
              {...stroke}
            />
            <rect
              x={VB_W - left[i] - w}
              y={CY - h / 2}
              width={w}
              height={h}
              rx={4}
              fill={p.tone.fill}
              {...stroke}
            />
          </g>
        );
      })}
    </svg>
  );
}
