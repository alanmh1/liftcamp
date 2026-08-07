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
      <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-1">
        <div className="flex justify-center">
          <Link
            to="/"
            aria-label="Start a workout"
            className={cn(
              "flex h-11 w-[62%] min-w-[168px] items-center justify-center gap-1.5 rounded-lg",
              "bg-pr text-pr-foreground text-sm font-semibold tracking-tight",
              "transition-transform active:scale-[0.98]",
              onHome && "ring-2 ring-nav-foreground/40",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Start
          </Link>
        </div>

        <ul className="mt-1 flex items-stretch">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.to} className="flex-1">
                <Link
                  to={t.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                    t.active ? "text-nav-foreground" : "text-nav-muted hover:text-nav-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
