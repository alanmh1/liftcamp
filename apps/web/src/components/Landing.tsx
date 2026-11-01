import { useRef } from "react";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroSection } from "@/components/landing/HeroSection";
import { RoutinesSection } from "@/components/landing/RoutinesSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { StreakSection } from "@/components/landing/StreakSection";
import { LibrarySection } from "@/components/landing/LibrarySection";
import { ProgressSection } from "@/components/landing/ProgressSection";
import { FeatureList } from "@/components/landing/FeatureList";
import { FaqSection } from "@/components/landing/FaqSection";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import type { AppStoreRating } from "@/lib/app-store-rating.functions";
import { FinalCta } from "@/components/landing/FinalCta";
import { FeaturedLinks } from "@/components/landing/FeaturedLinks";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import type { GuideMeta } from "@/content/guides/types";
import { useRevealOnScroll } from "@/lib/use-reveal-on-scroll";

/** The signed-out homepage. Sections fade in on scroll (motion.css); with
 *  Reduce Motion on, nothing is hidden and nothing moves. */
export function Landing({
  routineCount,
  rating,
  featuredRoutines,
  featuredGuides,
}: {
  routineCount: number;
  rating: AppStoreRating | null;
  featuredRoutines: (PublicRoutineSummary & { tint: string })[];
  featuredGuides: Pick<GuideMeta, "slug" | "title" | "dek">[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-x-clip bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader home />
      <main>
        <HeroSection routineCount={routineCount} />
        <RoutinesSection />
        <FeaturedLinks routines={featuredRoutines} guides={featuredGuides} />
        <HowItWorks />
        <StreakSection />
        <LibrarySection />
        <ProgressSection />
        <FeatureList />
        <ReviewsSection rating={rating} />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
