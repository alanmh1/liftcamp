import { Link, useRouterState } from "@tanstack/react-router";
import { User, History, Dumbbell, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom navigation.
//
// The bar is a solid plate-blue surface rather than another white panel: it is
// the one piece of persistent chrome on every screen, so it carries the brand
// colour instead of a hairline border.
//
// The centre action is a gold pill reading "Start" rather than a bare plus
// icon. A plus is ambiguous on a screen that also lists templates and a
// generator, and forces the primary action to rely on an icon convention a
// first-time gym-goer has no reason to know.
//
// The pill is deliberately NOT full width. Full width made it read as a second
// bar stacked on the nav rather than a control sitting in it, and on the home
// route it duplicated the page's own full-width "Start workout" button. At
// roughly two-thirds width with a shorter label it reads as a shortcut.
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/profile", label: "Profile", icon: User, active: pathname.startsWith("/profile") },
    { to: "/history", label: "History", icon: History, active: pathname.startsWith("/history") },
    { to: "/exercises", label: "Exercises", icon: Dumbbell, active: pathname.startsWith("/exercises") },
    { to: "/progress", label: "Progress", icon: TrendingUp, active: pathname.startsWith("/progress") },
  ] as const;

  const onHome = pathname === "/";

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-nav text-nav-foreground pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto w-full max-w-[480px] px-3 pt-3 pb-2">
        {/* The gold pill straddles the top edge of the blue bar: half of it
            sits above the surface so the bar itself can stay shallow. */}
        <Link
          to="/"
          aria-label="Start a workout"
          className={cn(
            "absolute left-1/2 -translate-x-1/2 -top-6 z-10",
            "flex h-12 w-[56%] min-w-[168px] items-center justify-center gap-1.5 rounded-2xl",
            "bg-pr text-pr-foreground text-base font-semibold tracking-tight shadow-lg",
            "transition-transform active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-foreground",
          )}
        >
          Start Workout

        </Link>

        <ul className="mt-6 flex items-stretch">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                aria-current={t.active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-9 items-center justify-center rounded-md px-1 text-[13px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-foreground",
                  t.active
                    ? "text-nav-foreground font-bold"
                    : "text-nav-muted font-semibold hover:text-nav-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

