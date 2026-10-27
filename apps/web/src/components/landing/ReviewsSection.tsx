import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import { APP_STORE_URL } from "@liftcamp/shared";
import type { AppStoreRating } from "@/lib/app-store-rating.functions";

/**
 * REVIEWS_TODO: paste the three App Store reviews here, verbatim, trimmed
 * only at sentence edges, with the reviewer's first name. An entry with an
 * empty quote is not rendered, so the section shows only the rating line
 * until these are filled in.
 */
const REVIEWS_TODO: { quote: string; name: string }[] = [
  { quote: "", name: "" },
  { quote: "", name: "" },
  { quote: "", name: "" },
];

const REVIEWS_URL = `${APP_STORE_URL}?see-all=reviews`;

/** The App Store rating and reviews. Renders nothing without a rating, which
 *  is also when the homepage leaves aggregateRating out of its JSON-LD: the
 *  markup may only claim a rating the page shows. */
export function ReviewsSection({ rating }: { rating: AppStoreRating | null }) {
  if (!rating) return null;
  const reviews = REVIEWS_TODO.filter((r) => r.quote.trim() !== "");

  return (
    <section
      id="reviews"
      data-reveal-section
      aria-labelledby="reviews-heading"
      className="scroll-mt-24 mx-auto max-w-7xl px-ds-lg py-ds-3xl"
    >
      <p
        data-reveal="text"
        className="font-label text-label uppercase tracking-widest text-primary"
      >
        Reviews
      </p>
      <h2
        id="reviews-heading"
        data-reveal="text"
        className="mt-ds-sm flex flex-wrap items-center gap-x-ds-md gap-y-ds-xs font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
      >
        <span className="tabular-nums">{rating.average.toFixed(1)} on the App Store</span>
        <span aria-hidden className="flex gap-1 text-pr">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-7 w-7 ${i < Math.round(rating.average) ? "fill-current" : ""}`}
            />
          ))}
        </span>
      </h2>
      <p data-reveal="text" className="mt-ds-md font-body text-body text-muted-foreground">
        <span className="tabular-nums">{rating.count}</span>{" "}
        {rating.count === 1 ? "rating" : "ratings"}.{" "}
        <a href={REVIEWS_URL} className="font-medium text-primary hover:underline">
          Read the reviews on the App Store
        </a>
      </p>

      {reviews.length > 0 && (
        <ul className="mt-ds-xl grid gap-ds-md p-0 lg:grid-cols-3">
          {reviews.map((r, index) => (
            <li
              key={index}
              data-reveal="item"
              style={{ "--i": index } as CSSProperties}
              className="rounded-lg border border-border bg-card px-ds-lg py-ds-md"
            >
              <figure className="m-0">
                <blockquote className="m-0 font-body text-body text-card-foreground">
                  {r.quote}
                </blockquote>
                <figcaption className="mt-ds-sm font-label text-label text-muted-foreground">
                  {r.name}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
