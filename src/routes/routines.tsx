import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { BackLink } from "@/components/BackLink";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SystemTemplateCard } from "@/components/SystemTemplateCard";
import { groupPrograms, type TemplateRow } from "@/lib/templates";
import { canonMuscle } from "@/lib/muscle-vocab";
import { getPublicRoutines, type PublicRoutines } from "@/lib/public-catalog.functions";

const SITE = "https://liftcamp.app";

const TITLE = "Free Workout Routines for Beginners — LiftCamp";
const DESCRIPTION =
  "Browse every built-in LiftCamp routine, from push/pull/legs to a 3 day full body split. Free, no account needed to look, one tap to start.";

export const Route = createFileRoute("/routines")({
  loader: async (): Promise<PublicRoutines> => getPublicRoutines(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}/routines` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/routines` }],
  }),
  component: RoutinesPage,
});

function RoutinesPage() {
  const { session } = useAuth();
  const { templates, muscleByExercise } = Route.useLoaderData();

  const musclesFor: Record<string, string[]> = {};
  for (const t of templates) {
    const seen: string[] = [];
    for (const te of t.template_exercises) {
      const raw = muscleByExercise[te.exercise_id];
      const m = raw ? canonMuscle(raw) : "";
      if (m && !seen.includes(m)) seen.push(m);
    }
    musclesFor[t.id] = seen;
  }

  const programs = groupPrograms(templates as TemplateRow[]);

  return (
    // The app shell caps every route at 480px, which is right for the logging
    // screens and wrong for a page strangers land on from search. Same breakout
    // the rest of the public catalog uses.
    <div
      className="min-h-dvh bg-background flex flex-col"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <main className={`flex-1 px-5 pt-6 ${session ? "pb-28" : "pb-12"}`}>
        <div className="mx-auto w-full max-w-[1080px]">
          {session && <BackLink to="/" label="Home" />}
          <h1 className="text-2xl font-bold tracking-tight">Workout routines</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">
            Every built-in LiftCamp routine. Pick one, use it as written, or copy it and change
            whatever you want. All of them are free.
          </p>

          {programs.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No built-in routines yet.</p>
          ) : (
            <div className="mt-6 flex flex-col gap-6">
              {programs.map((g) => (
                <section key={g.program} className="flex flex-col gap-2">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{g.program}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {g.templates.length} day{g.templates.length === 1 ? "" : "s"}
                      {g.blurb ? `. ${g.blurb}` : ""}
                    </p>
                  </div>
                  {/* One card per row on a phone, two from 640px, three from
                      1024px. items-start stops a short card stretching to match
                      the tallest one in its row. */}
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
                    {g.templates.map((t) => (
                      <li key={t.id}>
                        <SystemTemplateCard template={t} muscles={musclesFor[t.id]} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {!session && (
            <div className="mt-10 rounded-xl bg-secondary px-5 py-6">
              <h2 className="text-lg font-bold tracking-tight">Start one of these today</h2>
              <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
                A free account keeps your weights between sessions, so next week the app tells you
                what you lifted last time.
              </p>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Create a free account
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">
                No card, no app store. Works in your browser.
              </p>
            </div>
          )}
        </div>
      </main>

      {!session && <SiteFooter />}

      {session && <BottomNav />}
    </div>
  );
}
