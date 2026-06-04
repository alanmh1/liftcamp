import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Dumbbell, History, TrendingUp } from "lucide-react";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/", label: "Home", icon: Home, active: pathname === "/" },
    { to: "/exercises", label: "Exercises", icon: Dumbbell, active: pathname.startsWith("/exercises") },
    { to: "/history", label: "History", icon: History, active: pathname.startsWith("/history") },
    { to: "/progress", label: "Progress", icon: TrendingUp, active: pathname.startsWith("/progress") },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-[480px]">
        <ul className="flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.to} className="flex-1">
                <Link
                  to={t.to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                    t.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
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
