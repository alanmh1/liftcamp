import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared sorting primitives for the admin dashboard tables.
 *
 * Everything here works on data already in memory -- the dashboard's datasets
 * are small (tens of users, a handful of aggregated traffic rows), so sorting
 * client side avoids a round trip per click.
 *
 * Values are compared on the underlying value, never the rendered string: a
 * relative timestamp like "3 days ago" sorts nonsensically as text.
 */

export type SortDir = "desc" | "asc";

export type SortState<K extends string> = { key: K; dir: SortDir };

/** Sortable value kinds. `null` always sinks to the bottom, in both directions. */
export type SortValue = number | string | Date | null | undefined;

function compare(a: SortValue, b: SortValue, dir: SortDir): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  // Nulls sink regardless of direction, so a missing "Last seen" never leads.
  if (aNull) return 1;
  if (bNull) return -1;

  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;

  let base: number;
  if (typeof av === "number" && typeof bv === "number") base = av - bv;
  else base = String(av).localeCompare(String(bv), undefined, { numeric: true });

  return dir === "asc" ? base : -base;
}

/**
 * Sorts `rows` by the accessor for the active column. Returns a new array so
 * the caller's query cache data is never mutated.
 */
export function useSortedRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  return useMemo(() => {
    const get = accessors[sort.key];
    if (!get) return rows;
    return [...rows].sort((a, b) => compare(get(a), get(b), sort.dir));
    // accessors is defined inline by callers; key + dir + rows drive the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.key, sort.dir]);
}

/** Per-table sort state. First click on a new column sorts descending. */
export function useTableSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );
  return { sort, toggle };
}

export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;

  return (
    <th
      scope="col"
      className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        <Icon className={cn("h-3 w-3 shrink-0", active ? "opacity-100" : "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

/** "3 days ago" style formatting, coarse enough to scan a column quickly. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
