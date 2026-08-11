import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useWeightUnit } from "@/lib/weight-unit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile · RepLog" }],
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

function ProfilePage() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unit } = useWeightUnit();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const userId = user?.id;

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
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4">
        <h1 className="font-display text-2xl">Profile</h1>
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

        <section className="flex flex-col gap-2">
          <label htmlFor="bodyweight" className="text-xs uppercase tracking-wide text-muted-foreground">
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
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Units</p>
            <p className="text-sm mt-1">Weight preference</p>
          </div>
          <UnitToggle />
        </section>

        <section className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Appearance</p>
            <p className="text-sm mt-1">Theme</p>
          </div>
          <ThemeToggle />
        </section>

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
