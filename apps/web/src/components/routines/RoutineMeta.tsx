import { difficultyClass } from "@/lib/routine-prescription";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";

/** "N days · N exercises", from the loader. */
export function routineCounts(r: Pick<PublicRoutineSummary, "daysPerWeek" | "exerciseCount">): string {
  return `${r.daysPerWeek} day${r.daysPerWeek === 1 ? "" : "s"} · ${r.exerciseCount} exercises`;
}

/** The level pill in the existing difficulty colours. */
export function LevelPill({ level, className = "" }: { level: string; className?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${difficultyClass(level)} ${className}`}>
      {level}
    </span>
  );
}
