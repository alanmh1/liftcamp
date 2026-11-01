import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
import { formatEquipmentLabel, muscleLabel, normalizeSearch } from "@liftcamp/shared";
import { getCatalogIndex, type CatalogRow } from "@/lib/public-catalog.functions";
import { rowMuscles } from "@/lib/catalog-grouping";
import { ExerciseThumb } from "@/components/catalog/ExerciseThumb";

const PAGE = 60;

function titleCase(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : null;
}

/** The hub's search field. The query lives in the hub so the featured strip
 *  and the list below both narrow on it. */
export function ExerciseSearch({
  value,
  onChange,
  total,
}: {
  value: string;
  onChange: (value: string) => void;
  total: number;
}) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="mt-ds-lg max-w-2xl">
      <label htmlFor="exercise-search" className="sr-only">
        Search exercises
      </label>
      <div className="flex items-center gap-ds-sm rounded-full border border-border bg-background px-ds-md shadow-lg shadow-primary/5 focus-within:ring-2 focus-within:ring-ring">
        <Search aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          id="exercise-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Search ${total} exercises`}
          className="h-14 min-w-0 flex-1 bg-transparent font-body text-body text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="rounded-full p-ds-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The full list. The catalog index is NOT in the server-rendered payload: it
 * loads on the first search keystroke or difficulty pick. Crawlers get the
 * browse links, the featured strip and "Browse all", a plain link to the
 * server-rendered A to Z page, and never trigger the fetch.
 */
export function ExerciseList({
  query,
  indexableTotal,
  difficulties,
}: {
  query: string;
  /** Exercises on /exercises/all, the indexable ones. */
  indexableTotal: number;
  difficulties: { value: string; label: string; count: number }[];
}) {
  const [level, setLevel] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  const active = query.trim().length > 0 || level !== null;
  const loadIndex = useServerFn(getCatalogIndex);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["catalog-index"],
    queryFn: () => loadIndex(),
    enabled: active,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    setVisible(PAGE);
  }, [query, level]);

  const results = useMemo(() => {
    if (!rows || !active) return [];
    const needle = normalizeSearch(query);
    return rows.filter((r) => {
      if (level && r.level !== level) return false;
      if (!needle) return true;
      // alias_text is stored already normalized by norm_search(), so it is
      // compared raw. Normalizing it again would strip the '|' separators
      // that stop a query matching across two adjacent aliases.
      return normalizeSearch(r.name).includes(needle) || (r.alias_text ?? "").includes(needle);
    });
  }, [rows, active, query, level]);

  const pill =
    "rounded-full px-ds-md py-ds-xs font-label text-sm text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm";

  return (
    <section aria-labelledby="list-heading" className="mx-auto max-w-4xl px-ds-lg py-ds-2xl">
      <div className="flex flex-wrap items-end justify-between gap-ds-md">
        <h2
          id="list-heading"
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          All exercises
        </h2>
        <div
          role="group"
          aria-label="Filter by difficulty"
          className="flex flex-wrap gap-ds-xs rounded-full bg-muted p-ds-xs"
        >
          <button
            type="button"
            aria-pressed={level === null}
            onClick={() => setLevel(null)}
            className={pill}
          >
            All levels
          </button>
          {difficulties.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={level === d.value}
              onClick={() => setLevel(level === d.value ? null : d.value)}
              className={pill}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <>
          <div className="mt-ds-lg flex items-center justify-between gap-ds-sm">
            <p className="font-caption text-caption tabular-nums text-muted-foreground">
              {isLoading
                ? "Searching…"
                : results.length > visible
                  ? `${results.length} matches, showing ${Math.min(visible, results.length)}`
                  : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
            </p>
            {level !== null && (
              <button
                type="button"
                onClick={() => {
                  setLevel(null);
                  setVisible(PAGE);
                }}
                className="inline-flex items-center gap-ds-xs font-caption text-caption text-muted-foreground hover:underline"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {!isLoading && results.length === 0 ? (
            <p className="mt-ds-sm rounded-lg border border-dashed border-border p-ds-lg font-body text-body text-muted-foreground">
              Nothing matched. Try a shorter word, or clear the filter.
            </p>
          ) : (
            <ul className="mt-ds-sm divide-y divide-border overflow-hidden rounded-lg border border-border p-0">
              {results.slice(0, visible).map((row) => (
                <ListRow key={row.slug} row={row} />
              ))}
            </ul>
          )}

          {results.length > visible && (
            <div className="mt-ds-lg flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-border bg-background px-ds-lg font-label text-label font-semibold hover:bg-muted"
              >
                Show 60 more
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-ds-xl flex justify-center">
        <Link
          to="/exercises/all"
          className="inline-flex min-h-[38px] items-center justify-center gap-ds-xs rounded-lg bg-primary px-ds-lg py-ds-xs font-label text-label font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Browse all {indexableTotal} exercises <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/** One exercise as a library list row. The hub, equipment and sub-muscle
 *  pages render their lists from it too; `showMuscle` drops the muscle from
 *  the caption on a page that is already about one muscle. */
export function ListRow({ row, showMuscle = true }: { row: CatalogRow; showMuscle?: boolean }) {
  const muscle = showMuscle ? rowMuscles(row)[0] : undefined;
  return (
    <li>
      <Link
        to="/exercises/$slug"
        params={{ slug: row.slug }}
        className="group flex items-center gap-ds-md px-ds-md py-ds-sm hover:bg-muted/60"
      >
        <ExerciseThumb imageUrl={row.image_url} alt={row.name} className="w-[72px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-lg font-bold text-foreground group-hover:text-primary">
            {row.name}
          </span>
          <span className="block font-caption text-caption text-muted-foreground">
            {[
              muscle && muscleLabel(muscle),
              row.equipment && formatEquipmentLabel(row.equipment),
              titleCase(row.level),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
    </li>
  );
}
