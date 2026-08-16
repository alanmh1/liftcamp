import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { getCatalogIndex, type CatalogRow } from "@/lib/public-catalog.functions";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { normalizeSearch } from "@/lib/muscle-vocab";

export type EquipmentFacet = { value: string; label: string; count: number };

const RESULT_CAP = 60;

function titleCase(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : null;
}

/** Hub search and equipment cut.
 *
 *  The old control was a button that swapped the whole hub out for the picker.
 *  This is a real field: it filters in place and the region rail stays put.
 *
 *  The 883-row index is NOT in the server-rendered payload — it loads on the
 *  first keystroke or equipment click. Crawlers get the static rail plus the
 *  authored strip below and never trigger the fetch; humans pay for it only
 *  when they search. */
export function CatalogSearch({
  equipment,
  featured,
  featuredKind,
  total,
}: {
  equipment: EquipmentFacet[];
  featured: Pick<CatalogRow, "slug" | "name" | "equipment" | "level">[];
  featuredKind: "authored" | "common";
  total: number;
}) {
  const [q, setQ] = useState("");
  const [eq, setEq] = useState<string | null>(null);

  const active = q.trim().length > 0 || eq !== null;
  const loadIndex = useServerFn(getCatalogIndex);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["catalog-index"],
    queryFn: () => loadIndex(),
    enabled: active,
    staleTime: 1000 * 60 * 30,
  });

  const results = useMemo(() => {
    if (!rows || !active) return [];
    const needle = normalizeSearch(q);
    return rows.filter((r) => {
      if (eq && r.equipment !== eq) return false;
      if (!needle) return true;
      // alias_text is stored already normalized by norm_search(), so it is
      // compared raw. Normalizing it again would be a no-op at best and would
      // strip the '|' separators that stop a query matching across two
      // adjacent aliases.
      return (
        normalizeSearch(r.name).includes(needle) || (r.alias_text ?? "").includes(needle)
      );
    });
  }, [rows, active, q, eq]);

  return (
    <div>
      <div className="relative max-w-[520px]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${total} exercises`}
          aria-label="Search exercises"
          className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-[15px] outline-none transition-colors focus:border-primary lg:text-base"
        />
      </div>

      {/* Equipment is the highest-intent second axis — "what can I do with just
          dumbbells" had no path through the catalog at all before this. */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filter by equipment
        </p>
        <ul className="mt-2 flex flex-wrap gap-2 p-0">
          {equipment.map((f) => {
            const on = eq === f.value;
            return (
              <li key={f.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEq(on ? null : f.value)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors lg:text-sm " +
                    (on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary")
                  }
                >
                  {f.label}
                  <span className="font-mono text-[12px] opacity-70">{f.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {active ? (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground lg:text-sm">
              {isLoading
                ? "Searching…"
                : `${results.length} ${results.length === 1 ? "match" : "matches"}${
                    results.length > RESULT_CAP ? ` — showing first ${RESULT_CAP}` : ""
                  }`}
            </p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setEq(null);
              }}
              className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:underline lg:text-sm"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          {!isLoading && results.length === 0 ? (
            <p className="mt-4 text-[15px] text-muted-foreground">
              Nothing matched. Try a shorter word, or clear the equipment filter.
            </p>
          ) : (
            <ul className="mt-2 p-0">
              {results.slice(0, RESULT_CAP).map((r) => (
                <ResultRow key={r.slug} row={r} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        featured.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {featuredKind === "authored" ? "Explained in full" : "Start here"}
            </p>
            <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground lg:text-base">
              {featuredKind === "authored"
                ? "These have a hand-written beginner block: where to start, what the set should feel like, and what to do instead if the gym is busy."
                : "The lifts most programs are built from. If you are new, learning these twelve covers almost every session you will run."}
            </p>
            <ul className="mt-3 grid gap-x-6 p-0 sm:grid-cols-2">
              {featured.map((r) => (
                <ResultRow key={r.slug} row={r} />
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

function ResultRow({
  row,
}: {
  row: Pick<CatalogRow, "slug" | "name" | "equipment" | "level">;
}) {
  return (
    <li className="border-b border-border">
      <Link
        to="/exercises/$slug"
        params={{ slug: row.slug }}
        className="flex items-center gap-3 py-3 text-[15px] lg:text-base"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{row.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground lg:text-sm">
            {[row.equipment && formatEquipmentLabel(row.equipment), titleCase(row.level)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </Link>
    </li>
  );
}
