import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import type { WeightUnit } from "@liftcamp/shared";
import { cn } from "@/lib/utils";
import { strengthOutcome, unitOf, withUnit, type StrengthSearch } from "@/lib/strength-calc";
import { shareText, strengthPages, STRENGTH_PAGES } from "@/lib/strength-pages";
import { StrengthBar } from "./StrengthParts";
import { Segmented, UNIT_OPTIONS } from "./Segmented";

const DEFAULT_HUB_LIFT = "bench-press";

/** A number field's text from a search value. */
const text = (v: number | undefined) => (v === undefined ? "" : String(v));

/** A typed value for the URL: empty is absent, anything unreadable is left
 *  out the same way. */
function parse(v: string): number | undefined {
  const t = v.trim().replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[14px] font-semibold text-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-[16px] tabular-nums text-foreground outline-none transition-colors focus:border-primary aria-[invalid=true]:border-foreground/40";

function UnitInput({
  id,
  value,
  unit,
  invalid,
  onChange,
}: {
  id: string;
  value: string;
  unit?: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, unit && "pr-10")}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[15px] text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
}

/**
 * The calculator on the hub and every lift page. Its state is the page's
 * search params, so a shared link carries the result and the server renders
 * it. Typed text is kept locally so "62." survives a keystroke; the URL gets
 * the number.
 */
export function StrengthCalculator({
  search,
  onSearchChange,
  liftSlug,
}: {
  search: StrengthSearch;
  onSearchChange: (next: StrengthSearch) => void;
  /** The lift page's slug. Absent on the hub, which shows a lift picker. */
  liftSlug?: string;
}) {
  const id = useId();
  const unit = unitOf(search);
  const hub = liftSlug === undefined;
  const slug = liftSlug ?? search.lift ?? DEFAULT_HUB_LIFT;
  const page = STRENGTH_PAGES[slug]!;

  const [w, setW] = useState(text(search.w));
  const [r, setR] = useState(text(search.r));
  const [bw, setBw] = useState(text(search.bw));
  const [a, setA] = useState(text(search.a));

  // A unit change converts the numbers (here or from the tables' toggle), so
  // the fields take the converted values.
  const lastUnit = useRef(unit);
  useEffect(() => {
    if (lastUnit.current === unit) return;
    lastUnit.current = unit;
    setW(text(search.w));
    setBw(text(search.bw));
  }, [unit, search.w, search.bw]);

  const set = (patch: Partial<StrengthSearch>) => {
    const next: StrengthSearch = { ...search, ...patch };
    for (const k of Object.keys(next) as (keyof StrengthSearch)[])
      if (next[k] === undefined) delete next[k];
    onSearchChange(next);
  };

  const reps = parse(r);
  const step = (d: number) => {
    const n = Math.min(12, Math.max(1, Math.round((reps ?? 0) + d)));
    setR(String(n));
    set({ r: n });
  };

  const { errors, result } = strengthOutcome(page.exerciseId, search);

  return (
    <section
      aria-label="Strength calculator"
      className="rounded-xl border border-border bg-background p-5 shadow-sm shadow-foreground/5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {hub ? "Find your level" : `Find your ${page.name.toLowerCase()} level`}
        </h2>
        <Segmented<WeightUnit>
          label="Unit"
          size="sm"
          options={UNIT_OPTIONS}
          value={unit}
          onChange={(u) => onSearchChange(withUnit(search, u))}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {hub && (
          <div className="col-span-2 sm:col-span-3">
            <Field id={`${id}-lift`} label="Lift">
              <select
                id={`${id}-lift`}
                value={slug}
                onChange={(e) => set({ lift: e.target.value })}
                className={cn(inputClass, "appearance-auto")}
              >
                {strengthPages().map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field id={`${id}-w`} label="Weight lifted" error={errors.w}>
          <UnitInput
            id={`${id}-w`}
            value={w}
            unit={unit}
            invalid={!!errors.w}
            onChange={(v) => {
              setW(v);
              set({ w: parse(v) });
            }}
          />
        </Field>

        <Field id={`${id}-r`} label="Reps" error={errors.r}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="One rep fewer"
              onClick={() => step(-1)}
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:border-primary"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              id={`${id}-r`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={r}
              aria-invalid={!!errors.r}
              aria-describedby={errors.r ? `${id}-r-error` : undefined}
              onChange={(e) => {
                setR(e.target.value);
                set({ r: parse(e.target.value) });
              }}
              className={cn(inputClass, "px-1 text-center")}
            />
            <button
              type="button"
              aria-label="One rep more"
              onClick={() => step(1)}
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:border-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Field>

        <Field id={`${id}-bw`} label="Bodyweight" error={errors.bw}>
          <UnitInput
            id={`${id}-bw`}
            value={bw}
            unit={unit}
            invalid={!!errors.bw}
            onChange={(v) => {
              setBw(v);
              set({ bw: parse(v) });
            }}
          />
        </Field>

        <div className="col-span-2 sm:col-span-2">
          <p className="text-[14px] font-semibold text-foreground">Standards for</p>
          <div className="mt-1.5">
            <Segmented<"m" | "f">
              label="Standards for"
              options={[
                { value: "m", label: "Men" },
                { value: "f", label: "Women" },
              ]}
              value={search.s ?? null}
              onChange={(s) => set({ s })}
            />
          </div>
        </div>

        <Field id={`${id}-a`} label="Age" hint="optional" error={errors.a}>
          <UnitInput
            id={`${id}-a`}
            value={a}
            invalid={!!errors.a}
            onChange={(v) => {
              setA(v);
              set({ a: parse(v) });
            }}
          />
        </Field>
      </div>

      <div className="mt-6 border-t border-border pt-5" aria-live="polite">
        {result ? (
          <Result
            level={result.level}
            maxLine={result.maxLine}
            nextLine={result.nextLine}
            position={result.position}
            share={shareText(page, result.level)}
          />
        ) : (
          <p className="text-[15px] text-muted-foreground">
            Put in a recent set, your bodyweight and Men or Women to see your level.
          </p>
        )}
      </div>
    </section>
  );
}

function Result({
  level,
  maxLine,
  nextLine,
  position,
  share,
}: {
  level: string;
  maxLine: string;
  nextLine: string;
  position: number;
  share: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };

  const onShare = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: share, url });
      } catch {
        // Cancelled.
      }
      return;
    }
    await copy(`${share} ${url}`);
  };

  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Your level
      </p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-primary">{level}</p>
      <p className="mt-1 text-[16px] tabular-nums text-foreground">{maxLine}</p>
      <StrengthBar position={position} className="mt-4" />
      <p className="mt-3 text-[15px] font-semibold tabular-nums text-foreground">{nextLine}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Share
        </button>
        <button
          type="button"
          onClick={() => copy(window.location.href)}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-[15px] font-medium transition-colors hover:border-primary"
        >
          Copy link
        </button>
        <span role="status" className="text-[14px] text-muted-foreground">
          {copied ? "Copied" : ""}
        </span>
      </div>
    </div>
  );
}
