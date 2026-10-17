import { Link } from "@tanstack/react-router";
import { appStoreUrl } from "@liftcamp/shared";
import { LOGO_MARK_SRC } from "@/lib/brand";
import { AppleGlyph } from "@/components/AppleGlyph";

const navLink =
  "font-label text-label text-muted-foreground decoration-2 underline-offset-[6px] hover:text-foreground hover:underline aria-[current=page]:text-primary";

/**
 * Site nav for every public page: the landing page, the catalog, the guides
 * and About. On the homepage (`home`) it adds the in-page "How it works" and
 * "FAQ" anchors. Below md the centre links collapse and the logo and Download
 * stay.
 */
export function CatalogHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-ds-md px-ds-lg py-ds-md">
        <Link to="/" className="flex items-center gap-ds-sm">
          <img
            src={LOGO_MARK_SRC}
            alt=""
            width={32}
            height={32}
            className="block size-8 rounded-[9px]"
          />
          <span className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            LiftCamp
          </span>
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-ds-xl md:flex">
          {home && (
            <a href="#how" className={navLink}>
              How it works
            </a>
          )}
          <Link to="/routines" className={navLink}>
            Routines
          </Link>
          <Link to="/exercises" className={navLink}>
            Exercises
          </Link>
          <Link to="/guides" className={navLink}>
            Guides
          </Link>
          <Link to="/about" className={navLink}>
            About
          </Link>
          {home && (
            <a href="#faq" className={navLink}>
              FAQ
            </a>
          )}
        </nav>

        <a
          href={appStoreUrl("nav")}
          className="inline-flex min-h-[38px] items-center justify-center gap-ds-xs whitespace-nowrap rounded-lg bg-primary px-ds-lg py-ds-xs font-label text-label font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <AppleGlyph className="h-4 w-4" /> Download
        </a>
      </div>
    </header>
  );
}
