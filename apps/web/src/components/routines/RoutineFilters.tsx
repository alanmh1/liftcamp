import type { ReactNode } from "react";

/**
 * Three axes, because those are the three things people decide by: how many
 * days they can train, what they can train with, and how far along they are.
 * Each axis is multi-select: a card matches an axis when it matches any
 * chip picked there, and it shows when it matches every axis with a chip
 * picked. The options come from the data, so a chip never filters to zero
 * on its own. Filtering happens in the client on about thirty routines, so
 * no URL state and no refetch.
 */
export function RoutineFilters({
  dayOptions,
  equipmentOptions,
  levelOptions,
  days,
  equipment,
  levels,
  onDay,
  onEquipment,
  onLevel,
  onClear,
  shown,
  total,
}: {
  dayOptions: number[];
  equipmentOptions: string[];
  levelOptions: string[];
  days: number[];
  equipment: string[];
  levels: string[];
  onDay: (d: number) => void;
  onEquipment: (e: string) => void;
  onLevel: (l: string) => void;
  onClear: () => void;
  shown: number;
  total: number;
}) {
  const active = days.length + equipment.length + levels.length > 0;

  return (
    <section aria-label="Filter routines" className="mx-auto max-w-[1080px] px-5">
      <div className="rounded-lg border border-border bg-background p-5 shadow-sm shadow-foreground/5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[auto_auto_1fr] lg:gap-0 lg:divide-x lg:divide-border">
          <FilterGroup legend="Days a week" className="lg:pr-8">
            {dayOptions.map((d) => (
              <Chip
                key={d}
                active={days.includes(d)}
                onClick={() => onDay(d)}
                label={`${d} day${d === 1 ? "" : "s"} a week`}
              >
                {d}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup legend="Equipment" className="lg:px-8">
            {equipmentOptions.map((e) => (
              <Chip key={e} active={equipment.includes(e)} onClick={() => onEquipment(e)}>
                {e}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup legend="Difficulty" className="lg:pl-8">
            {levelOptions.map((l) => (
              <Chip key={l} active={levels.includes(l)} onClick={() => onLevel(l)}>
                {l}
              </Chip>
            ))}
          </FilterGroup>
        </div>
        <div className="mt-5 flex min-h-10 items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="tabular-nums">
              Showing {shown} of {total}
            </span>{" "}
            routines
          </p>
          {active && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-accent"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterGroup({
  legend,
  className,
  children,
}: {
  legend: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={className}>
      <legend className="float-left mb-3 w-full text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {legend}
      </legend>
      <div className="clear-left flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Accessible name when the visible text is only a number. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-10 min-w-11 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
    >
      {children}
    </button>
  );
}
