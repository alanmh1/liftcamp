import type { ReactNode } from "react";

/** One training day as a card: the title, a line under it, numbered exercise
 *  rows with sets × reps on the right, and an optional footer. The routine
 *  pages (routines_.$slug.tsx) and the guides' RoutineDayCard both draw it,
 *  so a day in a guide reads the same as a day on a routine page. Without a
 *  title the line under it sits at the top of the card, for a card inside a
 *  section whose heading already names the day. */
export function DayCard({
  id,
  title,
  subtitle,
  heading: Heading = "h2",
  className = "",
  footer,
  children,
}: {
  id?: string;
  title?: string;
  subtitle?: ReactNode;
  /** h2 on a routine page, where the day is a top-level section; h3 inside a
   *  guide section that already has its own h2. */
  heading?: "h2" | "h3";
  className?: string;
  footer?: ReactNode;
  /** DayRow elements. */
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-lg border border-border bg-background p-5 shadow-sm shadow-foreground/5 ${className}`}
    >
      <div className="border-b border-border pb-3">
        {title != null && (
          <Heading className="text-lg font-bold leading-snug text-foreground">{title}</Heading>
        )}
        {subtitle != null && (
          <p className={`${title != null ? "mt-0.5 " : ""}text-sm text-muted-foreground`}>
            {subtitle}
          </p>
        )}
      </div>
      <ol className="mt-3 flex flex-col gap-2.5">{children}</ol>
      {footer}
    </section>
  );
}

/** The divider every row but the last carries. */
export const DAY_ROW_CLASS = "border-b border-border/60 pb-2.5 last:border-0 last:pb-0";

/** The numbered badge the exercise page's steps use. */
export function DayNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold tabular-nums text-accent-foreground"
    >
      {n}
    </span>
  );
}

/** Numbers, not just names: a day without sets and reps is a list, and the
 *  page promises a plan. */
export function DaySetsReps({ sets, reps }: { sets: number; reps: string }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[13px] font-semibold tabular-nums text-foreground">
      {sets} × {reps}
    </span>
  );
}
