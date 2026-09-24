import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createTemplateFromExercises } from "@/lib/templates";
import { setPendingRoutine } from "@/lib/routine-share";
import { getSharedRoutine } from "@/lib/share-routine.functions";
import { LOGO_MARK_SRC } from "@/lib/brand";
import { ExerciseThumb } from "@/components/catalog/ExerciseThumb";

export const Route = createFileRoute("/r/$token")({
  loader: ({ params }) => getSharedRoutine({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Shared routine";
    const title = `${name} · a routine on LiftCamp`;
    const description = loaderData
      ? `${name}, ${loaderData.exercises.length} exercises. Copy it into LiftCamp and start logging in a tap.`
      : "This routine link isn't available.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: SharedRoutinePage,
});

function SharedRoutinePage() {
  const routine = Route.useLoaderData();
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function use() {
    if (!routine || busy) return;
    if (!user) {
      setPendingRoutine(token);
      navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    const id = await createTemplateFromExercises(
      user.id,
      routine.name,
      routine.exercises.map((e) => e.id),
    );
    setBusy(false);
    if (!id) {
      toast.error("Couldn't save that routine. Try again.");
      return;
    }
    toast.success(`${routine.name} added to your routines.`);
    navigate({ to: "/" });
  }

  if (!routine) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">Routine not found</h1>
        <p className="text-sm text-muted-foreground">
          This link has been turned off, or it was never valid.
        </p>
        <Link to="/" className="text-sm font-semibold text-primary underline">
          Go to LiftCamp
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-6">
      <div className="flex items-center gap-2">
        <img src={LOGO_MARK_SRC} alt="" className="h-7 w-7 rounded" />
        <span className="text-sm font-semibold tracking-tight">LiftCamp</span>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">{routine.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {routine.exercises.length} exercise{routine.exercises.length === 1 ? "" : "s"} · shared
        routine
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {routine.exercises.map((e, i) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
          >
            <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
              {i + 1}
            </span>
            <ExerciseThumb imageUrl={e.image_url} className="w-[64px]" />
            <div className="min-w-0 flex-1">
              {e.slug ? (
                <Link
                  to="/exercises/$slug"
                  params={{ slug: e.slug }}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {e.name}
                </Link>
              ) : (
                <span className="block truncate text-sm font-medium">{e.name}</span>
              )}
              {e.primary_muscle && (
                <span className="text-[13px] capitalize text-muted-foreground">{e.primary_muscle}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-4 mt-8">
        <button
          type="button"
          onClick={use}
          disabled={busy || loading}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {user ? "Add to my routines" : "Use this routine free"}
        </button>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          No card, no app store. Works in your browser.
        </p>
      </div>
    </div>
  );
}
