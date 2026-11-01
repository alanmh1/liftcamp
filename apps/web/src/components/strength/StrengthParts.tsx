import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  assignCardTints,
  STRENGTH_LEVELS,
  strengthTableRow,
  type StrengthSex,
  type WeightUnit,
} from "@liftcamp/shared";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { Faq } from "@/components/guides/Faq";
import { ROUTINE_TINTS } from "@/lib/routine-tints";
import { cn } from "@/lib/utils";
import {
  closestBodyweight,
  CTA_BODY,
  CTA_HEADING,
  formatNumber,
  LEVEL_MEANINGS,
  REFERENCE_LIFTER,
  strengthPages,
  TABLE_BODYWEIGHTS,
  tableHeading,
  type FaqItem,
  type StrengthPage,
} from "@/lib/strength-pages";
import { Segmented, UNIT_OPTIONS } from "./Segmented";

/** The accent at increasing strength, Beginner to Elite, as the app's bar.
 *  Static class names so Tailwind sees them. No warning colour, no gold. */
const SEGMENT_CLASSES = [
  "bg-primary/15",
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

/** Five equal segments with a marker at `position` (0 to 1). */
export function StrengthBar({ position, className }: { position: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, position * 100));
  return (
    <div className={className}>
      <div className="relative">
        <div className="flex gap-1">
          {STRENGTH_LEVELS.map((l, i) => (
            <div key={l} className={cn("h-2.5 flex-1 rounded-full", SEGMENT_CLASSES[i])} />
          ))}
        </div>
        <span
          aria-hidden
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-primary shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex text-[12px] text-muted-foreground">
        {STRENGTH_LEVELS.map((l) => (
          <span key={l} className="flex-1 truncate text-center">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export const sectionHeading =
  "border-b border-border pb-4 text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground";

/** Horizontal scroll inside its own box, so a small phone never scrolls the page. */
function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15px] tabular-nums">
        {children}
      </table>
    </div>
  );
}

const th = "bg-muted/60 px-3 py-2.5 text-[13px] font-semibold text-foreground";
const td = "border-t border-border px-3 py-2.5";

export function UnitToggle({
  unit,
  onChange,
}: {
  unit: WeightUnit;
  onChange: (u: WeightUnit) => void;
}) {
  return (
    <Segmented<WeightUnit>
      label="Unit"
      size="sm"
      options={UNIT_OPTIONS}
      value={unit}
      onChange={onChange}
    />
  );
}

/** One lift's table for one sex, in `unit`. `highlight` is the row to mark. */
function StandardsTable({
  page,
  sex,
  unit,
  highlight,
}: {
  page: StrengthPage;
  sex: StrengthSex;
  unit: WeightUnit;
  highlight: number | null;
}) {
  const rows = TABLE_BODYWEIGHTS[sex][unit];
  return (
    <div className="mt-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {tableHeading(page, sex)}
      </h2>
      <TableScroll>
        <caption className="sr-only">
          {tableHeading(page, sex)}, in {unit}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Bodyweight
            </th>
            {STRENGTH_LEVELS.map((l) => (
              <th key={l} scope="col" className={th}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((bw) => {
            const t = strengthTableRow(page.exerciseId, sex, bw, unit);
            if (!t) return null;
            const on = bw === highlight;
            return (
              <tr
                key={bw}
                aria-current={on ? "true" : undefined}
                className={cn(on && "bg-primary/10 font-semibold")}
              >
                <th scope="row" className={cn(td, "font-semibold")}>
                  {bw} {unit}
                </th>
                <td className={td}>under {formatNumber(t[0])}</td>
                {t.map((v, i) => (
                  <td key={i} className={td}>
                    {formatNumber(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </TableScroll>
    </div>
  );
}

/** The men's and women's tables with the unit toggle. With a bodyweight in
 *  the calculator, the closest row is marked: in the chosen sex's table, or
 *  in both before one is chosen. */
export function StandardsTables({
  page,
  unit,
  onUnitChange,
  bodyweight,
  sex,
  footnote,
}: {
  page: StrengthPage;
  unit: WeightUnit;
  onUnitChange: (u: WeightUnit) => void;
  bodyweight: number | null;
  sex: StrengthSex | null;
  footnote: string;
}) {
  const mark = (s: StrengthSex) =>
    sex === null || sex === s ? closestBodyweight(TABLE_BODYWEIGHTS[s][unit], bodyweight) : null;
  return (
    <section className="mt-12" aria-label={`${page.h1} tables`}>
      <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border pb-4">
        <span className="text-[14px] text-muted-foreground">Weights in</span>
        <UnitToggle unit={unit} onChange={onUnitChange} />
      </div>
      <StandardsTable page={page} sex="male" unit={unit} highlight={mark("male")} />
      <StandardsTable page={page} sex="female" unit={unit} highlight={mark("female")} />
      <p className="mt-4 text-[15px] text-muted-foreground">{footnote}</p>
    </section>
  );
}

/** The hub's table: Novice and Intermediate for the two reference lifters. */
export function SummaryTable({
  unit,
  onUnitChange,
}: {
  unit: WeightUnit;
  onUnitChange: (u: WeightUnit) => void;
}) {
  const m = REFERENCE_LIFTER.male[unit];
  const f = REFERENCE_LIFTER.female[unit];
  return (
    <section className="mt-12" aria-labelledby="summary-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <h2
          id="summary-heading"
          className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground"
        >
          Novice and Intermediate on 7 lifts
        </h2>
        <UnitToggle unit={unit} onChange={onUnitChange} />
      </div>
      <TableScroll>
        <caption className="sr-only">
          Novice and Intermediate for a {m} {unit} man and a {f} {unit} woman, in {unit}
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(th, "align-bottom")}>
              Lift
            </th>
            <th scope="colgroup" colSpan={2} className={cn(th, "pb-0")}>
              Men, {m} {unit}
            </th>
            <th scope="colgroup" colSpan={2} className={cn(th, "pb-0")}>
              Women, {f} {unit}
            </th>
          </tr>
          <tr>
            <th scope="col" className={cn(th, "font-normal text-muted-foreground")}>
              Novice
            </th>
            <th scope="col" className={cn(th, "font-normal text-muted-foreground")}>
              Intermediate
            </th>
            <th scope="col" className={cn(th, "font-normal text-muted-foreground")}>
              Novice
            </th>
            <th scope="col" className={cn(th, "font-normal text-muted-foreground")}>
              Intermediate
            </th>
          </tr>
        </thead>
        <tbody>
          {strengthPages().map((p) => {
            const men = strengthTableRow(p.exerciseId, "male", m, unit);
            const women = strengthTableRow(p.exerciseId, "female", f, unit);
            if (!men || !women) return null;
            return (
              <tr key={p.slug}>
                <th scope="row" className={cn(td, "font-semibold")}>
                  <Link
                    to="/strength-standards/$lift"
                    params={{ lift: p.slug }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {p.name}
                  </Link>
                </th>
                <td className={td}>{formatNumber(men[0])}</td>
                <td className={td}>{formatNumber(men[1])}</td>
                <td className={td}>{formatNumber(women[0])}</td>
                <td className={td}>{formatNumber(women[1])}</td>
              </tr>
            );
          })}
        </tbody>
      </TableScroll>
    </section>
  );
}

export function LevelMeanings() {
  return (
    <section className="mt-12" aria-labelledby="levels-heading">
      <h2 id="levels-heading" className={sectionHeading}>
        What the levels mean
      </h2>
      <ul className="mt-4 p-0">
        {LEVEL_MEANINGS.map((m, i) => (
          <li
            key={m.level}
            className="flex items-start gap-3 border-b border-border py-3 last:border-0"
          >
            <span
              aria-hidden
              className={cn("mt-1.5 h-2.5 w-6 shrink-0 rounded-full", SEGMENT_CLASSES[i])}
            />
            <p className="text-[16px] leading-relaxed text-foreground">
              <span className="font-semibold">{m.level}.</span>{" "}
              <span className="text-foreground/80">{m.text}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FaqSection({ items }: { items: readonly FaqItem[] }) {
  return (
    <section className="mt-12" id="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className={sectionHeading}>
        Questions
      </h2>
      <div className="text-[16px] leading-relaxed">
        <Faq items={[...items]} />
      </div>
    </section>
  );
}

/** The plate blue band other public pages close on. */
export function StrengthCta() {
  return (
    <div className="relative mt-12 overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        <div className="max-w-[46ch]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{CTA_HEADING}</h2>
          <p className="mt-3 text-base leading-relaxed text-primary-foreground/85">{CTA_BODY}</p>
        </div>
        <div className="shrink-0">
          <AppStoreBadge tone="white" height={48} campaign="strength" />
        </div>
      </div>
    </div>
  );
}

/** The two link cards on a lift page: the exercise page and the Full Body
 *  routine. The routine is laid out first for the tint walk so it takes the
 *  hero slot, the colour its card has on /routines. */
export function LiftLinkCards({ page }: { page: StrengthPage }) {
  const slots = assignCardTints(
    [
      { id: "routine", art: "routine" },
      { id: "exercise", art: page.exerciseSlug },
    ],
    ROUTINE_TINTS.length,
  );
  const tint = (id: string) => ROUTINE_TINTS[slots.get(id) ?? 0];
  const card =
    "group flex w-full flex-col rounded-lg border border-border p-5 shadow-sm shadow-foreground/5 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <ul className="mt-12 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2">
      <li className="flex">
        <Link
          to="/exercises/$slug"
          params={{ slug: page.exerciseSlug }}
          className={cn(card, tint("exercise"))}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-bold leading-snug text-foreground">
              How to {page.name.toLowerCase()}, with a starting weight
            </p>
            <ArrowUpRight
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-foreground/50 group-hover:text-primary"
            />
          </div>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
            View exercise
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </li>
      <li className="flex">
        <Link
          to="/routines/$slug"
          params={{ slug: "full-body-3-day" }}
          className={cn(card, tint("routine"))}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-bold leading-snug text-foreground">Full Body 3x a week</p>
            <ArrowUpRight
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-foreground/50 group-hover:text-primary"
            />
          </div>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
            View routine
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </li>
    </ul>
  );
}

export function OtherLifts({ current }: { current: string }) {
  return (
    <section className="mt-12" aria-labelledby="other-lifts-heading">
      <h2 id="other-lifts-heading" className={sectionHeading}>
        Other lifts
      </h2>
      <ul className="mt-2 p-0">
        {strengthPages()
          .filter((p) => p.slug !== current)
          .map((p) => (
            <li key={p.slug} className="border-b border-border">
              <Link
                to="/strength-standards/$lift"
                params={{ lift: p.slug }}
                className="flex items-center gap-3 py-3 text-[16px] font-medium hover:text-primary"
              >
                <span className="min-w-0 flex-1">{p.h1}</span>
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
