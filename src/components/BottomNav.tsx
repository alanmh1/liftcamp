import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Clock, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom navigation.
//
// The bar is a solid plate-blue surface rather than another white panel: it is
// the one piece of persistent chrome on every screen, so it carries the brand
// colour instead of a hairline border.
//
// The gold "Start Workout" pill straddles the top edge of the bar so the blue
// band itself can stay shallow — the bar was carrying too much visual weight
// when the pill sat inside it.
//
// Progress no longer has its own tab: it lives as a section of History, which
// keeps the bar down to three destinations.
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/profile", label: "Home", icon: Home, active: pathname.startsWith("/profile") },
    { to: "/history", label: "History", icon: Clock, active: pathname.startsWith("/history") },
    { to: "/exercises", label: "Exercises", icon: Dumbbell, active: pathname.startsWith("/exercises") },
  ] as const;

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
            "flex h-12 w-auto min-w-[150px] px-7 items-center justify-center gap-1.5 rounded-2xl",
            "bg-pr text-pr-foreground text-base font-semibold tracking-tight shadow-lg",
            "transition-transform active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-foreground",
          )}
        >
          Start Workout
        </Link>

        <ul className="mt-6 flex items-stretch">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.to} className="flex-1">
                <Link
                  to={t.to}
                  aria-current={t.active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[12px] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-foreground",
                    t.active
                      ? "text-nav-foreground font-bold"
                      : "text-nav-muted font-semibold hover:text-nav-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden strokeWidth={t.active ? 2.5 : 1.8} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
