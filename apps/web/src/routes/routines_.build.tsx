import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DraftSession } from "@/components/routines/DraftSession";
import { muscleColors, equipmentIcon } from "@/lib/exercise-visuals";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { tileAccent } from "@/lib/routine-tiles";
import { CANONICAL_MUSCLES, muscleLabel } from "@liftcamp/shared";
import { ensureShareLink, shareLink } from "@/lib/routine-share";
import {
  searchPublicExercises,
  getPublicRoutineBySlug,
  getRoutinesBuiltThisWeek,
  getExerciseCount,
  type PublicSearchExercise,
  type PublicRoutineDetail,
} from "@/lib/public-catalog.functions";
import {
  readDraftRoutine,
  writeDraftRoutine,
  claimDraftRoutine,
  loggedSets,
  type DraftExercise,
} from "@/lib/draft-routine";


const SITE = "https://liftcamp.app";

// "Workout Routine Builder" and "Workout Plan Maker" compete for the same
// query; one term in the title, the other stays on the page.
const TITLE = "Workout Routine Builder: Free Plan Maker | LiftCamp";
// Count is filled in from the live catalog by the loader — see head() below.
function descriptionFor(count: number) {
  return `Free workout routine builder. Make your own workout plan from ${count} exercises: pick your lifts, set the order, save it. No account to start, nothing to install.`;
}

/** Plain answers, short enough to be quoted by an answer engine and useful
 *  enough to be worth reading. Rendered on the page and mirrored into FAQPage
 *  JSON-LD from the same array, so the two can never drift. */
const FAQ: { q: string; a: string }[] = [
  {
    q: "How many exercises should a workout routine have?",
    a: "Four to seven per session is enough for most people. Two or three compound lifts that cover the big muscle groups, then two to four smaller exercises. Past about eight, the last ones get done tired and add little.",
  },
  {
    q: "How many days a week should I lift?",
    a: "Three days a week is the usual starting point, and it is enough to get stronger for a long time. Two still works if that is what you can keep up. Four to six days only pays off once you are splitting the body across days.",
  },
  {
    q: "What order should exercises go in?",
    a: "Hardest first. Squats, deadlifts, presses and rows go at the front while you are fresh, because they need the most technique and effort. Isolation work, arms and calves go at the end.",
  },
  {
    q: "Is the routine builder free?",
    a: "Yes. Building a routine needs no account at all — it saves on your device as you go. A free account keeps it across devices and lets you start a tracked workout from it. There is no card and no paid tier to unlock.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. LiftCamp runs in your browser, and you can add it to your phone's home screen so it opens like an app. Nothing goes through an app store.",
  },
  {
    q: "How often should I change my routine?",
    a: "Change it when it stops working, not on a schedule. If you are still adding weight or reps to your main lifts, keep the routine. Six to twelve weeks on the same plan is normal.",
  },
];

const HOW_TO_STEPS = [
  { name: "Pick your training days", text: "Decide how many days a week you can realistically train. Three is a good default." },
  { name: "Choose your main lifts", text: "Start with two or three compound exercises that cover the big muscle groups for that day." },
  { name: "Add accessory work", text: "Add two to four smaller exercises for the muscles you want to focus on." },
  { name: "Put them in order", text: "Hardest exercises first, isolation work last, so the important lifts get your best effort." },
  { name: "Save and train", text: "Save the routine to your free account and start a tracked workout from it at the gym." },
];

type BuildSearch = { muscle?: string; from?: string; day?: number };

export const Route = createFileRoute("/routines_/build")({
  validateSearch: (search: Record<string, unknown>): BuildSearch => ({
    muscle: typeof search['muscle'] === "string" ? search['muscle'] : undefined,
    from: typeof search['from'] === "string" ? search['from'] : undefined,
    day: Number.isFinite(Number(search['day'])) ? Number(search['day']) : undefined,
  }),
  loader: async () => ({ exerciseCount: await getExerciseCount() }),
  head: ({ loaderData }) => {
    const DESCRIPTION = descriptionFor(loaderData?.exerciseCount ?? 886);
    return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}/routines/build` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/routines/build` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "LiftCamp Workout Routine Builder",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web browser, iOS, Android",
          url: `${SITE}/routines/build`,
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to build a workout routine",
          description:
            "Build a workout plan by choosing your training days, picking compound lifts, adding accessory work and ordering them hardest first.",
          totalTime: "PT10M",
          step: HOW_TO_STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
    };
  },
  component: BuilderPage,
});

function BuilderPage() {
  const { session, user } = useAuth();
  const search = Route.useSearch();
  const { exerciseCount } = Route.useLoaderData();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<DraftExercise[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [trying, setTrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [muscle, setMuscle] = useState(search.muscle ?? "");
  const [seeded, setSeeded] = useState(false);

  // localStorage is not available during SSR, so the draft loads after mount.
  // Writing before that would clobber a real draft with the empty initial state.
  useEffect(() => {
    const draft = readDraftRoutine();
    if (draft) {
      setName(draft.name);
      setPicked(draft.exercises);
      if (draft.exercises.length > 0) setSeeded(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraftRoutine({ name, exercises: picked, updatedAt: Date.now() });
  }, [hydrated, name, picked]);

  // ?from=<program-slug>&day=<index> lands a visitor on the builder with a real
  // day already loaded, so an entry point from a routine page starts them at
  // "change this" rather than an empty page. Never overwrites an existing draft.
  const { data: seedRoutine } = useQuery<PublicRoutineDetail | null>({
    queryKey: ["public-routine", search.from],
    enabled: hydrated && !seeded && !!search.from,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getPublicRoutineBySlug({ data: { slug: search.from as string } }),
  });

  useEffect(() => {
    if (!seedRoutine || seeded) return;
    const day = seedRoutine.days[Math.max(0, Math.min(search.day ?? 0, seedRoutine.days.length - 1))];
    if (!day) return;
    setSeeded(true);
    setName(`${seedRoutine.program} — ${day.name}`);
    setPicked(day.exercises.map((e) => ({ id: e.id, name: e.name, equipment: e.equipment })));
  }, [seedRoutine, seeded, search.day]);

  const trimmed = q.trim();
  const active = trimmed.length > 1 || !!muscle;

  const { data: results, isFetching } = useQuery({
    queryKey: ["public-exercise-search", trimmed, muscle],
    enabled: active,
    staleTime: 5 * 60 * 1000,
    queryFn: () => searchPublicExercises({ data: { q: trimmed, muscle: muscle || undefined } }),
  });

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);

  const setCount = useMemo(
    () => picked.reduce((n, ex) => n + loggedSets(ex).length, 0),
    [picked],
  );

  // Up to four distinct pieces of kit — enough to say "this is a dumbbell day"
  // at a glance without turning the card into a legend.
  const previewEquipment = useMemo(() => {
    const seen: string[] = [];
    for (const ex of picked) {
      if (ex.equipment && !seen.includes(ex.equipment)) seen.push(ex.equipment);
      if (seen.length === 4) break;
    }
    return seen;
  }, [picked]);

  const tile = useMemo(() => {
    const accent = tileAccent(Math.max(0, picked.length - 1));
    return { background: `linear-gradient(135deg, ${accent.bg} 0%, ${accent.fg} 140%)` };
  }, [picked.length]);

  // Social proof, only when it is worth saying. Below the threshold the number
  // argues against the product, so it is not rendered at all.
  const { data: builtThisWeek } = useQuery({
    queryKey: ["routines-built-this-week"],
    staleTime: 30 * 60 * 1000,
    queryFn: () => getRoutinesBuiltThisWeek(),
  });

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    const result = await claimDraftRoutine(user.id);
    setSaving(false);
    if (!result) {
      toast.error("Could not save that routine. Try again in a moment.");
      return;
    }
    setSavedId(result.templateId);
    toast.success(
      result.workoutId ? "Routine and workout saved to your account." : "Routine saved to your account.",
    );
  }

  async function share() {
    if (!savedId) return;
    const url = await ensureShareLink(savedId);
    if (!url) {
      toast.error("Could not create a share link.");
      return;
    }
    const how = await shareLink(url, name.trim() || "My routine");
    if (how === "copied") toast.success("Link copied.");
  }



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

          <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
            Workout routine builder
          </h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">
            Make your own workout plan from {exerciseCount} exercises. Search the library, add the
            lifts you want, put them in the order you'll do them. It saves on this device as you
            go, so you can build it now and make an account later. Free, and nothing to install.
          </p>


          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {/* Search. Sticky on wide screens so a long routine list does not
                scroll the search box off the page while you add to it. */}
            <section className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
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
                      const Icon = equipmentIcon(ex.equipment);
                      return (
                        <li
                          key={ex.id}
                          className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                            <Icon className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">

                            <p className="truncate text-sm font-semibold">{ex.name}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {ex.primary_muscle && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[13px] font-semibold capitalize"
                                  style={{ backgroundColor: c.bg, color: c.fg }}
                                >
                                  {ex.primary_muscle}
                                </span>
                              )}
                              {ex.equipment && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[13px] font-semibold text-muted-foreground">
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

              {/* A card preview, so the plan looks like the thing they will
                  open at the gym rather than a list of rows. */}
              {picked.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <div
                    className="h-[72px] w-full"
                    style={{ background: tile.background }}
                    aria-hidden
                  />
                  <div className="px-4 py-3">
                    <p className="text-[15px] font-bold tracking-tight">
                      {name.trim() || "Your routine"}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">
                      {picked.length} exercise{picked.length === 1 ? "" : "s"}
                      {setCount > 0 ? ` · ${setCount} set${setCount === 1 ? "" : "s"} logged` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {previewEquipment.map((eq) => {
                        const Icon = equipmentIcon(eq);
                        return (
                          <span
                            key={eq}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[13px] font-semibold text-muted-foreground"
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {formatEquipmentLabel(eq)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {picked.length === 0 ? (
                /* An empty right column read as a broken page. A placeholder of
                   the card they are about to build shows what this side is for. */
                <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <div className="mx-auto h-[56px] w-full max-w-[220px] rounded-lg bg-secondary" aria-hidden />
                  <p className="mt-4 text-sm font-semibold">Your routine appears here</p>
                  <p className="mx-auto mt-1.5 max-w-[38ch] text-[15px] text-muted-foreground">
                    Search the library and add your first exercise. Three to seven lifts is a
                    normal session, hardest first.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {picked.map((ex, i) => {
                    const Icon = equipmentIcon(ex.equipment);
                    return (
                    <li
                      key={ex.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5"
                    >
                      <span className="w-5 shrink-0 text-[13px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background">
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{ex.name}</p>
                        {ex.equipment && (
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
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
                    );
                  })}

                </ul>
              )}

              {picked.length > 0 && (
                <>
                  {/* Try it before the ask. A visitor who has logged real sets
                      is being asked to keep something, not to sign up. */}
                  <div className="mt-6 border-t border-border pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold tracking-tight">Try this workout</h3>
                      <button
                        type="button"
                        onClick={() => setTrying((v) => !v)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-[13px] font-semibold text-primary"
                      >
                        {trying ? "Hide" : "Log some sets"}
                      </button>
                    </div>
                    <p className="mt-1.5 max-w-[60ch] text-[15px] text-muted-foreground">
                      Log a few sets the way you would at the gym. No account, nothing leaves this
                      device.
                    </p>
                    {trying && (
                      <div className="mt-4">
                        <DraftSession exercises={picked} onChange={setPicked} />
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl bg-secondary px-5 py-5">
                    <p className="max-w-[60ch] text-sm text-muted-foreground">
                      {picked.length} exercise{picked.length === 1 ? "" : "s"}
                      {setCount > 0 ? ` and ${setCount} logged set${setCount === 1 ? "" : "s"}` : ""}{" "}
                      saved on this device.{" "}
                      {session
                        ? "Save it to your account to start a workout from it anywhere."
                        : "A free account keeps it on every device and turns what you logged into a real workout."}
                    </p>

                    {savedId ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to="/"
                          className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
                        >
                          Open it in the app
                        </Link>
                        <button
                          type="button"
                          onClick={share}
                          className="inline-flex h-11 items-center rounded-md border border-input bg-background px-5 text-sm font-semibold text-primary"
                        >
                          Share this routine
                        </button>
                      </div>
                    ) : session ? (
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save to my account"}
                      </button>
                    ) : (
                      <Link
                        to="/login"
                        search={{ mode: "signup" }}
                        className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
                      >
                        Create a free account and keep this
                      </Link>
                    )}

                    <p className="mt-2 text-[13px] text-muted-foreground">
                      Free forever. No card, no app store — it runs in your browser.
                    </p>
                    {builtThisWeek !== undefined && builtThisWeek >= 25 && (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {builtThisWeek.toLocaleString()} routines built on LiftCamp this week.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>

          </div>

          {/* Written content, not filler: the tool alone gives a crawler almost
              nothing to read, and these are the questions people actually ask
              before they build a first plan. Mirrored into JSON-LD in head(). */}
          <section className="mt-14 border-t border-border pt-10">
            <h2 className="text-xl font-bold tracking-tight lg:text-2xl">
              How to build a workout routine
            </h2>
            <ol className="mt-4 flex max-w-[70ch] flex-col gap-3">
              {HOW_TO_STEPS.map((s, i) => (
                <li key={s.name} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-bold">
                    {i + 1}
                  </span>
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-semibold">{s.name}.</span>{" "}
                    <span className="text-muted-foreground">{s.text}</span>
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight lg:text-2xl">
              Workout routine builder FAQ
            </h2>
            <div className="mt-4 grid max-w-[1080px] grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
              {FAQ.map((f) => (
                <div key={f.q} className="max-w-[62ch]">
                  <h3 className="text-[16px] font-semibold tracking-tight">{f.q}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight lg:text-2xl">
              Rather start from a ready-made plan?
            </h2>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
              Ten free routines with every exercise listed — push pull legs, upper lower, 5x5,
              dumbbell only and more. Open any of them and change it here.
            </p>
            <Link
              to="/routines"
              className="mt-3 inline-flex h-10 items-center rounded-lg border border-input bg-background px-4 text-[15px] font-semibold text-primary"
            >
              Browse the routines
            </Link>
          </section>
        </div>
      </main>


      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
