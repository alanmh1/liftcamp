import { createContext, useContext } from "react";
import { Link } from "@tanstack/react-router";
import { DAY_ROW_CLASS, DayCard, DayNumber, DaySetsReps } from "@/components/routines/DayCard";
import { MuscleDiagram, type DiagramMuscles } from "@/components/catalog/v2/MuscleDiagram";
import { EXERCISE_ART_HEIGHT, EXERCISE_ART_WIDTH, exerciseArtUrl } from "@/lib/exercise-art";
import { estimateMinutes, prescribeWithTarget } from "@/lib/routine-prescription";
import type { GuideLinkSlug } from "./ExerciseLink";

export type DayCardItem = { slug: GuideLinkSlug; name: string; sets: number; reps: string };

/** Muscle columns for the slugs a guide lists in meta.dayCardSlugs, read by
 *  the guide route's loader from the cached catalog and provided around the
 *  body. A guide stays a static component tree; only the diagrams need data. */
export const DayCardMusclesContext = createContext<Record<string, DiagramMuscles>>({});

/** Same art rule as ExerciseCard: the Squatch render when the slug has one,
 *  the muscle diagram until it does. */
function DayThumb({ slug }: { slug: string }) {
  const muscles = useContext(DayCardMusclesContext)[slug];
  const art = exerciseArtUrl(slug);
  return (
    <span
      aria-hidden
      className={
        art
          ? "relative block aspect-[16/9] w-[72px] shrink-0 overflow-hidden rounded-md bg-muted"
          : "relative block aspect-[16/9] w-[72px] shrink-0 overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_40%,var(--background),var(--muted))] px-2 py-0.5"
      }
    >
      {art ? (
        <img
          src={art}
          alt=""
          width={EXERCISE_ART_WIDTH}
          height={EXERCISE_ART_HEIGHT}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : muscles ? (
        <MuscleDiagram muscles={muscles} />
      ) : null}
    </span>
  );
}

/** A guide's training day drawn as a routine page day card. Each row links
 *  to the exercise page. Use it for workouts; ExerciseList stays for plain
 *  lists of links. Leave out the title when the guide section's heading
 *  already names the day.
 *
 *  The subtitle carries the same session estimate as the routine pages,
 *  from the same rule: each item's sets and reps, with rest from the
 *  exercise name. */
export function RoutineDayCard({ title, items }: { title?: string; items: DayCardItem[] }) {
  const minutes = estimateMinutes(
    items.map((it) => prescribeWithTarget(it.name, { sets: it.sets, reps: it.reps })),
  );
  return (
    <DayCard
      title={title}
      heading="h3"
      className="mt-6 leading-normal"
      subtitle={`${items.length} exercise${items.length === 1 ? "" : "s"} · ~${minutes} min`}
    >
      {items.map((it, i) => (
        <li key={`${it.slug}-${i}`} className={DAY_ROW_CLASS}>
          <Link
            to="/exercises/$slug"
            params={{ slug: it.slug }}
            className="group flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <DayNumber n={i + 1} />
            <DayThumb slug={it.slug} />
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground underline-offset-4 group-hover:text-primary group-hover:underline">
              {it.name}
            </span>
            <DaySetsReps sets={it.sets} reps={it.reps} />
          </Link>
        </li>
      ))}
    </DayCard>
  );
}
