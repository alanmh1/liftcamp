import { Link, useRouterState } from "@tanstack/react-router";
import { User, History, Dumbbell, TrendingUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/profile", label: "Profile", icon: User, active: pathname.startsWith("/profile") },
    { to: "/history", label: "History", icon: History, active: pathname.startsWith("/history") },
    { to: "/", label: "Start", icon: Flame, active: pathname === "/", primary: true },
    { to: "/exercises", label: "Exercises", icon: Dumbbell, active: pathname.startsWith("/exercises") },
    { to: "/progress", label: "Progress", icon: TrendingUp, active: pathname.startsWith("/progress") },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-[480px]">
        <ul className="flex items-end">
          {tabs.map((t) => {
            const Icon = t.icon;
            if ("primary" in t && t.primary) {
              return (
                <li key={t.to} className="flex-1 flex justify-center">
                  <Link
                    to={t.to}
                    aria-label={t.label}
                    className={cn(
                      "-mt-5 flex flex-col items-center justify-center gap-0.5 rounded-full h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95",
                      t.active && "ring-primary/30",
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </Link>
                </li>
              );
            }
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
