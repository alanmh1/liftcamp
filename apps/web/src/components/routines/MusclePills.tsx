import { muscleColors } from "@/lib/exercise-visuals";

const MAX_PILLS = 5;

/** A routine's muscles, most exercises first, capped at five with a +N for the rest. */
export function MusclePills({ muscles, className = "" }: { muscles: string[]; className?: string }) {
  const shown = muscles.slice(0, MAX_PILLS);
  const hidden = muscles.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Muscles worked">
      {shown.map((m) => {
        const c = muscleColors(m);
        return (
          <li
            key={m}
            className="rounded-full px-2.5 py-1 text-[13px] font-semibold capitalize"
            style={{ backgroundColor: c.bg, color: c.fg }}
          >
            {m}
          </li>
        );
      })}
      {hidden > 0 && (
        <li className="rounded-full bg-muted px-2.5 py-1 text-[13px] font-semibold text-muted-foreground">
          +{hidden}
        </li>
      )}
    </ul>
  );
}
