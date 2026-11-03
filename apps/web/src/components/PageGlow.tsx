/** Fades the glow out over the lower part of the header, so a short header
 *  ends in the page background instead of a hard line where it clips. */
const FADE = "linear-gradient(to bottom, black 55%, transparent)";

/**
 * The brand glow behind every public page header: plate blue top right,
 * yellow top left. Render it as the first child of a header (or the block
 * that holds the h1) with `relative overflow-hidden`, and put the header's
 * content in a `relative` wrapper so it sits above the glow.
 *
 * Every public route renders it, directly or through a hero component that
 * does (HubHero, DetailHeader, ContentHero, RoutinesHeader).
 * src/lib/page-glow.test.ts fails when one does not.
 *
 * CTA bands, cards and the homepage hero keep their own glows; those belong
 * to the block, not the page header.
 */
export function PageGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      <div className="absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-pr/25 blur-3xl" />
    </div>
  );
}
