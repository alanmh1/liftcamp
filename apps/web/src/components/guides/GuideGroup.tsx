import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import type { GuideMeta } from "@/content/guides/types";
import { ClayShape, guideTone, type ClayShapeKind, type GuideTone } from "./ClayShape";

export type GroupedGuide = GuideMeta & { shape: ClayShapeKind };

export function GuideGroup({
  id,
  heading,
  intro,
  guides,
}: {
  id: GuideTone;
  heading: string;
  intro: string;
  guides: GroupedGuide[];
}) {
  if (guides.length === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="mx-auto max-w-7xl scroll-mt-28 px-ds-lg pb-ds-2xl"
    >
      <div className="flex flex-wrap items-end justify-between gap-ds-sm border-b border-border pb-ds-md">
        <h2
          id={headingId}
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          {heading}
        </h2>
        <p className="max-w-xl font-body text-body text-muted-foreground md:text-right">{intro}</p>
      </div>

      <ul className="mt-ds-lg grid gap-ds-md p-0 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => {
          const tone = guideTone(guide.category);
          return (
            <li
              key={guide.slug}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border shadow-sm hover:shadow-lg motion-safe:transition-[translate,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
            >
              {/* Same rule as the article header and FeaturedGuide: the clay
                  render at /guides/<slug>.webp when the guide has one, the
                  ClayShape placeholder until it does. */}
              <div
                data-tone={tone}
                className="relative flex h-44 items-center justify-center overflow-hidden bg-accent data-[tone=getting-started]:bg-pr/25 data-[tone=technique]:bg-tip/15"
              >
                {guide.hero ? (
                  <img
                    src={`/guides/${guide.slug}.webp`}
                    alt=""
                    width={2400}
                    height={1260}
                    sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full ${guide.hero.fill ? "object-cover" : "object-contain p-ds-sm"} motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:scale-[1.03]`}
                  />
                ) : (
                  <ClayShape shape={guide.shape} tone={tone} />
                )}
              </div>
              <div className="flex flex-1 flex-col p-ds-lg">
                <p
                  data-tone={tone}
                  className="font-label text-sm uppercase tracking-widest text-primary data-[tone=getting-started]:text-pr-foreground data-[tone=technique]:text-foreground"
                >
                  {guide.category}
                </p>
                <h3 className="mt-ds-xs font-heading text-2xl font-bold leading-snug text-foreground">
                  <Link
                    to="/guides/$slug"
                    params={{ slug: guide.slug }}
                    className="after:absolute after:inset-0 group-hover:text-primary"
                  >
                    {guide.title}
                  </Link>
                </h3>
                <p className="mt-ds-sm font-body text-body text-muted-foreground">{guide.dek}</p>
                <p className="mt-auto inline-flex items-center gap-ds-xs pt-ds-md font-caption text-caption tabular-nums text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {guide.readMinutes} min read
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
