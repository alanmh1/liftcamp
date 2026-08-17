import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunnelCard } from "@/components/FunnelCard";
import { BottomNav } from "@/components/BottomNav";
import { BackLink } from "@/components/BackLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useWeightUnit } from "@/lib/weight-unit";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useWeeklyTarget, WEEKLY_TARGET_OPTIONS } from "@/lib/weekly-target";


export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · LiftCamp" },
      { name: "description", content: "Manage your LiftCamp profile: bodyweight, kg/lb units, weekly training target and theme." },
      { property: "og:title", content: "Profile · LiftCamp" },
      { property: "og:description", content: "Manage your LiftCamp profile: bodyweight, kg/lb units, weekly training target and theme." },
      { property: "og:url", content: "https://liftcamp.app/profile" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/profile" }],
  }),
  component: ProfilePage,
});

function UnitToggle() {
  const { unit, setUnit } = useWeightUnit();
  return (
    <div className="inline-flex rounded-md border border-input overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setUnit("lb")}
        className={cn("px-3 py-1.5", unit === "lb" ? "bg-accent font-semibold" : "text-muted-foreground")}
        aria-pressed={unit === "lb"}
      >
        lb
      </button>
      <button
        type="button"
        onClick={() => setUnit("kg")}
        className={cn("px-3 py-1.5 border-l border-input", unit === "kg" ? "bg-accent font-semibold" : "text-muted-foreground")}
        aria-pressed={unit === "kg"}
      >
        kg
      </button>
    </div>
  );
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const options: Array<{ v: ThemeMode; label: string }> = [
    { v: "light", label: "Light" },
    { v: "dark", label: "Dark" },
    { v: "system", label: "Auto" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
      {options.map((o, i) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setMode(o.v)}
          aria-pressed={mode === o.v}
          className={cn(
            "px-3 py-1.5",
            i > 0 && "border-l border-input",
            mode === o.v ? "bg-accent font-semibold" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WeeklyTargetPicker() {
  const { target, setTarget } = useWeeklyTarget();
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
      {WEEKLY_TARGET_OPTIONS.map((n, i) => (
        <button
          key={n}
          type="button"
          onClick={() => setTarget(n)}
          aria-pressed={target === n}
          className={cn(
            "num px-3 py-1.5",
            i > 0 && "border-l border-input",
            target === n ? "bg-accent font-semibold" : "text-muted-foreground",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ProfilePage() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unit } = useWeightUnit();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  // Cancel in-flight queries and clear cached protected data before the session
  // goes away, so nothing 401s or flashes stale data on the way out.
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }


  const userId = user?.id;

  // Surfaces the admin dashboard link only for accounts with the admin role.
  // The dashboard itself re-checks server-side, so this is presentation only.
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_is_admin");
      if (error) throw error;
      return data === true;
    },
  });


  const { data: profile } = useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("bodyweight, weight_unit")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const [bw, setBw] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.bodyweight != null) setBw(String(profile.bodyweight));
    else setBw("");
  }, [profile?.bodyweight]);

  async function saveBodyweight() {
    if (!userId) return;
    const trimmed = bw.trim();
    if (trimmed === "") {
      setError(null);
      await supabase
        .from("user_profiles")
        .upsert({ user_id: userId, bodyweight: null }, { onConflict: "user_id" });
      qc.invalidateQueries({ queryKey: ["user-profile", userId] });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number");
      return;
    }
    setError(null);
    await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, bodyweight: n }, { onConflict: "user_id" });
    qc.invalidateQueries({ queryKey: ["user-profile", userId] });
  }

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (user?.email ? user.email.split("@")[0] : "Lifter");
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <header className="px-5 pt-4 pb-4">
        <BackLink to="/" label="Start workout" />
        <h1 className="mt-1 font-display text-2xl">Profile</h1>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">
        <section className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-secondary text-foreground font-display text-lg">
              {initials || "·"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </section>

        <section className="flex items-center justify-between gap-3">
          <div>
            <p className="micro text-muted-foreground">Weekly target</p>
            <p className="text-sm text-muted-foreground">Workouts per week</p>
          </div>
          <WeeklyTargetPicker />
        </section>

        <section className="flex flex-col gap-2">
          <label htmlFor="bodyweight" className="micro text-muted-foreground">
            Bodyweight
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="—"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              onBlur={saveBodyweight}
              className="font-mono"
            />
            <span className="text-sm text-muted-foreground w-8">{unit}</span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </section>

        <section className="flex items-center justify-between">
          <div>
            <p className="micro text-muted-foreground">Units</p>
            <p className="text-sm mt-1">Weight preference</p>
          </div>
          <UnitToggle />
        </section>

        <section className="flex items-center justify-between">
          <div>
            <p className="micro text-muted-foreground">Appearance</p>
            <p className="text-sm mt-1">Theme</p>
          </div>
          <ThemeToggle />
        </section>

        <FunnelCard />

        {isAdmin && (
          <div className="mt-2">
            <Link
              to="/admin"
              className="flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Admin dashboard
            </Link>
          </div>
        )}

        <div className="mt-2">
          <button
            onClick={signOut}
            className="h-11 w-full rounded-md border border-input bg-background text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign out
          </button>
        </div>


      </main>
      <BottomNav />
    </div>
  );
}
