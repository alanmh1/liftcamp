import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

// Parse a "YYYY-MM-DD" date string as a LOCAL date. Using new Date("2026-06-01")
// would parse as UTC midnight, which renders as the previous day in negative-UTC
// timezones (e.g. Pacific) — landing workouts in the wrong calendar square. The
// explicit constructor below is always local.
export function parseLocalDate(s: string): Date | null {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Count of distinct calendar days (in the given month/year) that have a workout.
export function distinctDaysInMonth(dates: Date[], month: Date): number {
  const set = new Set<string>();
  for (const d of dates) {
    if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
      set.add(d.toDateString());
    }
  }
  return set.size;
}

export function WorkoutCalendar({
  dates,
  onSelectDay,
}: {
  dates: string[];
  onSelectDay?: (day: Date) => void;
}) {
  const [month, setMonth] = useState<Date>(() => new Date());


  const workoutDays = useMemo(
    () => dates.map(parseLocalDate).filter((d): d is Date => d != null),
    [dates],
  );

  const count = useMemo(
    () => distinctDaysInMonth(workoutDays, month),
    [workoutDays, month],
  );

  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <Collapsible defaultOpen className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 [&[data-state=open]>svg]:rotate-180">
        <span className="text-sm font-semibold">
          {monthLabel} · <span className="text-primary">{count}</span>{" "}
          <span className="font-normal text-muted-foreground">
            {count === 1 ? "day" : "days"} trained
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          showOutsideDays={false}
          modifiers={{ worked: workoutDays }}
          modifiersClassNames={{
            worked: "bg-primary/20 text-primary font-semibold",
          }}
          className="w-full p-0"
          classNames={{
            root: "w-full",
            months: "relative w-full flex flex-col gap-4",
            month: "w-full flex flex-col gap-2",
            month_grid: "w-full border-collapse",
            weekdays: "grid grid-cols-7 gap-1",
            weekday: "text-muted-foreground text-[0.75rem] font-normal text-center",
            week: "grid grid-cols-7 gap-1 mt-1",
            day: "aspect-square w-full p-0 text-center align-middle rounded-md font-mono text-sm",
          }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
