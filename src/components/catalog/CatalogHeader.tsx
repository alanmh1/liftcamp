import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LOGO_MARK_SRC } from "@/lib/brand";

/**
 * Brand bar for the public catalog.
 *
 * The catalog is the part of the site strangers land on from search, and until
 * now it carried no mark, no wordmark and no way back to the marketing page —
 * a reader arriving on /exercises/back had no idea whose site they were on.
 * This is the landing page's header rebuilt with the app's tokens so the two
 * read as one product.
 *
 * Signed-in users get the same bar minus the Log in / Sign up pair; they
 * already have an account and the bottom nav handles their navigation.
 */
export function CatalogHeader() {
  const { session } = useAuth();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
        <Link to="/" className="mr-auto flex items-center gap-2.5">
          <img
            src={LOGO_MARK_SRC}
            alt=""
            width={32}
            height={32}
            className="block size-8 rounded-[9px]"
          />
          <span className="text-lg font-bold tracking-tight">LiftCamp</span>
        </Link>

        <nav className="flex items-center gap-5 text-[15px] font-medium text-muted-foreground">
          <Link to="/exercises" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Exercises
          </Link>
          <Link to="/routines" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Routines
          </Link>
          <Link to="/guides" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Guides
          </Link>
          <Link to="/about" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            About
          </Link>
        </nav>

        {!session && (
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-[15px] font-semibold text-primary hover:underline">
              Log in
            </Link>
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="rounded-[10px] bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
