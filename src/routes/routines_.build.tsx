import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { muscleColors, formatEquipmentLabel } from "@/lib/exercise-visuals";
import { CANONICAL_MUSCLES, muscleLabel } from "@/lib/muscle-vocab";
import { searchPublicExercises, type PublicSearchExercise } from "@/lib/public-catalog.functions";
import { readDraftRoutine, writeDraftRoutine, type DraftExercise } from "@/lib/draft-routine";

const SITE = "https://liftcamp.app";

const TITLE = "Workout Routine Builder — Free, No Account — LiftCamp";
const DESCRIPTION =
  "Build your own workout routine from 898 exercises. Pick your lifts, put them in order, and save it. Free, and nothing to install.";

export const Route = createFileRoute("/routines_/build")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}/routines/build` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/routines/build` }],
  }),
  component: BuilderPage,
});

function BuilderPage() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<DraftExercise[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");

  // localStorage is not available during SSR, so the draft loads after mount.
  // Writing before that would clobber a real draft with the empty initial state.
  useEffect(() => {
    const draft = readDraftRoutine();
    if (draft) {
      setName(draft.name);
      setPicked(draft.exercises);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraftRoutine({ name, exercises: picked, updatedAt: Date.now() });
  }, [hydrated, name, picked]);

  const trimmed = q.trim();
  const active = trimmed.length > 1 || !!muscle;

  const { data: results, isFetching } = useQuery({
    queryKey: ["public-exercise-search", trimmed, muscle],
    enabled: active,
    staleTime: 5 * 60 * 1000,
    queryFn: () => searchPublicExercises({ data: { q: trimmed, muscle: muscle || undefined } }),
  });

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);

  function add(ex: PublicSearchExercise) {
    if (pickedIds.has(ex.id)) return;
    setPicked((cur) => [...cur, { id: ex.id, name: ex.name, equipment: ex.equipment }]);
  }

  function removeAt(i: number) {
    setPicked((cur) => cur.filter((_, idx) => idx !== i));
  }

  function move(i: number, delta: number) {
    setPicked((cur) => {
      const next = [...cur];
      const j = i + delta;
      if (j < 0 || j >= next.length) return cur;
      const a = next[i]!;
      const b = next[j]!;
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  return (
    // The app shell caps every route at 480px, which is wrong for a page
    // strangers land on from search.
    <div
      className="min-h-dvh bg-background flex flex-col"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <main className={`flex-1 px-5 pt-6 ${session ? "pb-28" : "pb-12"}`}>
        <div className="mx-auto w-full max-w-[1080px]">
          <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Link to="/routines" className="hover:underline">
              Routines
            </Link>
            <span aria-hidden>›</span>
            <span>Build your own</span>
          </nav>

          <h1 className="mt-2 text-2xl font-bold tracking-tight">Build your own routine</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">
            Search the library, add the lifts you want, put them in the order you'll do them. It
            saves on this device as you go, so you can build it now and make an account later.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Search */}
            <section>
              <h2 className="text-lg font-bold tracking-tight">Add exercises</h2>

              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search exercises"
                  aria-label="Search exercises"
                  className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-[16px] outline-none transition-colors focus:border-primary"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setMuscle("")}
                  aria-pressed={muscle === ""}
                  className={
                    "rounded-full px-3 py-1 text-[13px] font-semibold " +
                    (muscle === "" ? "bg-primary text-primary-foreground" : "bg-secondary")
                  }
                >
                  All
                </button>
                {CANONICAL_MUSCLES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMuscle(muscle === m ? "" : m)}
                    aria-pressed={muscle === m}
                    className={
                      "rounded-full px-3 py-1 text-[13px] font-semibold capitalize " +
                      (muscle === m ? "bg-primary text-primary-foreground" : "bg-secondary")
                    }
                  >
                    {muscleLabel(m)}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {!active ? (
                  <p className="text-sm text-muted-foreground">
                    Type at least two letters, or pick a muscle group.
                  </p>
                ) : isFetching && !results ? (
                  <p className="text-sm text-muted-foreground">Searching…</p>
                ) : !results || results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing matched. Try a shorter word, or the muscle group instead.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {results.map((ex) => {
                      const already = pickedIds.has(ex.id);
                      const c = muscleColors(ex.primary_muscle);
                      return (
                        <li
                          key={ex.id}
                          className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{ex.name}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {ex.primary_muscle && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[12px] font-semibold capitalize"
                                  style={{ backgroundColor: c.bg, color: c.fg }}
                                >
                                  {ex.primary_muscle}
                                </span>
                              )}
                              {ex.equipment && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">
                                  {formatEquipmentLabel(ex.equipment)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => add(ex)}
                            disabled={already}
                            className="h-9 shrink-0 rounded-md border border-input bg-background px-3 text-[13px] font-semibold text-primary disabled:opacity-40"
                          >
                            {already ? "Added" : "Add"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* The routine */}
            <section>
              <h2 className="text-lg font-bold tracking-tight">Your routine</h2>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name it, e.g. Monday Upper"
                aria-label="Routine name"
                className="mt-3 h-12 w-full rounded-xl border border-border bg-background px-4 text-[16px] outline-none transition-colors focus:border-primary"
              />

              {picked.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing added yet. Search on the left and add your first exercise.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {picked.map((ex, i) => (
                    <li
                      key={ex.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5"
                    >
                      <span className="w-5 shrink-0 text-[13px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{ex.name}</p>
                        {ex.equipment && (
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {formatEquipmentLabel(ex.equipment)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${ex.name} up`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === picked.length - 1}
                        aria-label={`Move ${ex.name} down`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        aria-label={`Remove ${ex.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {picked.length > 0 && (
                <div className="mt-5 rounded-xl bg-secondary px-5 py-5">
                  <p className="max-w-[60ch] text-sm text-muted-foreground">
                    {picked.length} exercise{picked.length === 1 ? "" : "s"} saved on this device.{" "}
                    {session
                      ? "Save it to your account to start a workout from it."
                      : "Create a free account to keep it and start a workout from it."}
                  </p>
                  <Link
                    to="/login"
                    search={{ mode: "signup" }}
                    className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
                  >
                    Save this routine
                  </Link>
                  <p className="mt-2 text-xs text-muted-foreground">
                    No card, no app store. Works in your browser.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
