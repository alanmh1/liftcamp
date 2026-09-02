import { Link } from "@tanstack/react-router";
import { AuthCta } from "@/components/AuthCta";

/**
 * Marketing footer for the landing page.
 *
 * Deliberately one row, not a four-column template — a large footer on a
 * single-page beta reads as scaffolding for a company that doesn't exist yet.
 *
 * The Resources column is the part that matters later: when the per-exercise
 * SEO pages ship, footer links are how hub pages accumulate internal link
 * equity on every request. Hevy footer-links its six split guides sitewide for
 * exactly this reason. Add them here rather than restructuring then.
 *
 * No social links until the accounts exist and have posts on them — an empty
 * Instagram is worse than no Instagram.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[rgba(31,29,26,.1)] px-[clamp(18px,4vw,56px)] py-8">
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link to="/exercises" className="text-[#544D44] underline-offset-4 hover:underline">
            Exercises
          </Link>
          <Link to="/routines" className="text-[#544D44] underline-offset-4 hover:underline">
            Routines
          </Link>
          <Link to="/guides" className="text-[#544D44] underline-offset-4 hover:underline">
            Guides
          </Link>
          <Link to="/privacy" className="text-[#544D44] underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="text-[#544D44] underline-offset-4 hover:underline">
            Terms
          </Link>
          <a
            href="mailto:hello@liftcamp.app"
            className="text-[#544D44] underline-offset-4 hover:underline"
          >
            Contact
          </a>
          <AuthCta
            signedOutLabel="Log in"
            signedInLabel="Open app"
            className="text-[#544D44] underline-offset-4 hover:underline"
          />
        </nav>

        <p className="m-0 text-[13.5px] text-[#8A8378]">© 2026 LiftCamp</p>
      </div>
    </footer>
  );
}
