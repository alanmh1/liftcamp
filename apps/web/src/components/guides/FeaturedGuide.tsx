import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import type { GuideMeta } from "@/content/guides/types";
import { ClayShape } from "./ClayShape";

/** The first guide in display order, as a large card. Shows the article's
 *  hero image (/guides/<slug>.webp) when the guide has one, the same rule the
 *  article header uses; otherwise a clay illustration. */
export function FeaturedGuide({ guide }: { guide: GuideMeta }) {
  return (
    <section aria-labelledby="featured-guide" className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl">
      <article className="group relative grid overflow-hidden rounded-xl border border-border shadow-xl shadow-primary/5 hover:shadow-2xl motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="relative min-h-[280px] overflow-hidden bg-accent md:min-h-[420px]">
          {!guide.hero?.fill && (
            <>
              <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-pr/50 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
            </>
          )}
          {guide.hero ? (
            <img
              src={`/guides/${guide.slug}.webp`}
              alt={guide.hero.alt}
              width={2400}
              height={1260}
              sizes="(min-width: 768px) 640px, 100vw"
              decoding="async"
              className={
                guide.hero.fill
                  ? "absolute inset-0 h-full w-full object-cover"
                  : "absolute inset-0 h-full w-full object-contain p-ds-md"
              }
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center gap-ds-lg">
              <ClayShape shape="stack" tone="programming" className="scale-150" />
              <ClayShape shape="ring" tone="getting-started" className="hidden scale-125 sm:flex" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center p-ds-xl lg:p-ds-2xl">
          <p className="flex flex-wrap items-center gap-ds-sm">
            <span className="rounded-full bg-pr px-ds-sm py-ds-xs font-label text-sm text-pr-foreground">
              Start here
            </span>
            <span className="font-label text-label uppercase tracking-widest text-primary">
              {guide.category}
            </span>
          </p>
          <h2
            id="featured-guide"
            className="mt-ds-md font-heading text-4xl font-extrabold leading-tight tracking-tight text-foreground lg:text-5xl"
          >
            <Link
              to="/guides/$slug"
              params={{ slug: guide.slug }}
              className="after:absolute after:inset-0 group-hover:text-primary"
            >
              {guide.title}
            </Link>
          </h2>
          <p className="mt-ds-md font-body text-xl leading-relaxed text-muted-foreground">
            {guide.dek}
          </p>
          <div className="mt-ds-lg flex flex-wrap items-center justify-between gap-ds-md">
            <span className="inline-flex items-center gap-ds-xs font-caption text-caption tabular-nums text-muted-foreground">
              <Clock className="h-4 w-4" />
              {guide.readMinutes} min read
            </span>
            <span className="inline-flex items-center gap-ds-xs font-label text-label text-primary">
              Read the guide
              <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}
