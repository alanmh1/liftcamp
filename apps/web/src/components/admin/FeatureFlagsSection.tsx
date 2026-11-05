import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/components/admin/SortableHeader";

/**
 * Feature flags and app settings. One card per flag with its global switch
 * (admin_set_global_flag) and the per-user grant or revoke list
 * (admin_list_flags, admin_set_flag), then the settings the app reads at
 * runtime (admin_list_settings, admin_set_setting). Every function checks
 * the admin role itself; whatever it raises is shown as is.
 *
 * A flag is on for a user when they are signed up, not revoked, and either
 * the global switch is on or they hold a grant. See docs/social-spec.md
 * (Flag) and docs/custom-exercises.sql.
 */

const FLAGS: { key: string; title: string; blurb: string }[] = [
  {
    key: "custom_exercises",
    title: "Custom exercises",
    blurb:
      "Users can create their own exercises. Free accounts get the limit below; Pro is unlimited.",
  },
  {
    key: "social",
    title: "Social",
    blurb: "Follows, kudos and the feed. Hidden behind this switch until launch.",
  },
  {
    key: "pro_launched",
    title: "Pro launched",
    blurb:
      "iOS paywall and every Pro upsell. The switch reaches guests too. A grant shows it to one account, for testing or App Review. Off never takes Pro from anyone who has it.",
  },
];

type FlagRow = {
  email: string;
  user_id: string;
  state: string;
  granted_at: string;
  granted_by: string | null;
  enabled_for_all: boolean;
};

type SettingRow = {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

const SETTING_LABELS: Record<string, { label: string; hint: string }> = {
  free_custom_exercise_limit: {
    label: "Free custom exercise limit",
    hint: "How many custom exercises a free account can have at once. Pro is unlimited. 0 turns creation off for free accounts.",
  },
};

export function FeatureFlagsSection() {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">Feature flags</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        A flag is on for everyone when its switch is on, or for one account with a grant. A revoke
        wins over both. Guests never get a flag.
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {FLAGS.map((f) => (
          <FlagCard key={f.key} flag={f.key} title={f.title} blurb={f.blurb} />
        ))}
      </div>
      <SettingsCard />
    </section>
  );
}

function FlagCard({ flag, title, blurb }: { flag: string; title: string; blurb: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryKey = ["admin-flag", flag];

  const rows = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_flags", { p_flag: flag });
      if (error) throw error;
      return (data ?? []) as FlagRow[];
    },
  });
  const global = useQuery({
    queryKey: ["admin-flag-global", flag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_flags")
        .select("enabled_for_all")
        .eq("flag", flag)
        .maybeSingle();
      if (error) throw error;
      return data?.enabled_for_all ?? false;
    },
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin-flag-global", flag] }),
    ]);
  }

  async function setGlobal(on: boolean) {
    setBusy("global");
    setError(null);
    const { error } = await supabase.rpc("admin_set_global_flag", { p_flag: flag, p_enabled: on });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
  }

  async function setUser(target: string, state: "granted" | "revoked" | null) {
    setBusy(`${target}:${state ?? "clear"}`);
    setError(null);
    const { error } = await supabase.rpc("admin_set_flag", {
      p_email: target,
      p_flag: flag,
      // Null clears the row. The generated type wants a string, so the cast
      // is the one place the SQL contract and the type disagree.
      p_state: state as unknown as string,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return false;
    }
    await refresh();
    return true;
  }

  async function onGrant(e: React.FormEvent) {
    e.preventDefault();
    const ok = await setUser(email.trim(), "granted");
    if (ok) setEmail("");
  }

  const on = global.data ?? false;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{blurb}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy !== null || global.isLoading}
          onClick={() => void setGlobal(!on)}
          title={on ? "On for everyone. Click to turn off." : "Off. Click to turn on for everyone."}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
            on ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              on ? "left-0.5 translate-x-5" : "left-0.5",
            )}
          />
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {global.isLoading ? "…" : on ? "On for everyone." : "Off. Only the grants below have it."}
      </p>

      <form onSubmit={onGrant} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={busy !== null || email.trim() === ""}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy === `${email.trim()}:granted` ? "Granting…" : "Grant"}
        </button>
        <button
          type="button"
          disabled={busy !== null || email.trim() === ""}
          onClick={() => void setUser(email.trim(), "revoked").then((ok) => ok && setEmail(""))}
          className="rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === `${email.trim()}:revoked` ? "Revoking…" : "Revoke"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-secondary text-left text-[13px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Set</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.isLoading ? (
              <tr className="border-t border-border">
                <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.error ? (
              <tr className="border-t border-border">
                <td colSpan={4} className="px-3 py-2 text-destructive">
                  {(rows.error as Error).message}
                </td>
              </tr>
            ) : (rows.data ?? []).length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                  No per-user grants or revokes.
                </td>
              </tr>
            ) : (
              (rows.data ?? []).map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-3 py-2">{r.email}</td>
                  <td
                    className={cn(
                      "px-3 py-2",
                      r.state === "revoked" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {r.state}
                  </td>
                  <td
                    className="px-3 py-2 text-muted-foreground"
                    title={`${new Date(r.granted_at).toLocaleString()}${r.granted_by ? ` by ${r.granted_by}` : ""}`}
                  >
                    {relativeTime(r.granted_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void setUser(r.email, null)}
                      disabled={busy !== null}
                      title="Remove the per-user row. The global switch then decides."
                      className="rounded-md border border-input px-3 py-1 text-[13px] disabled:opacity-50"
                    >
                      {busy === `${r.email}:clear` ? "Clearing…" : "Clear"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsCard() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_settings");
      if (error) throw error;
      return (data ?? []) as SettingRow[];
    },
  });

  async function save(key: string) {
    const raw = drafts[key];
    if (raw == null || raw.trim() === "") return;
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      setError("Enter a whole number.");
      return;
    }
    setBusy(key);
    setError(null);
    const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: n });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium">Settings</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Values the app reads at runtime. A change takes effect on the next app launch, no build
        needed.
      </p>
      {settings.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : settings.error ? (
        <p className="mt-3 text-sm text-destructive">{(settings.error as Error).message}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {(settings.data ?? []).map((s) => {
            const meta = SETTING_LABELS[s.key] ?? { label: s.key, hint: "" };
            const current = String(s.value ?? "");
            const draft = drafts[s.key] ?? current;
            const dirty = draft !== current;
            return (
              <li key={s.key} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[240px] flex-1">
                  <p className="text-sm">{meta.label}</p>
                  {meta.hint && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{meta.hint}</p>
                  )}
                  <p
                    className="mt-0.5 text-[13px] text-muted-foreground"
                    title={new Date(s.updated_at).toLocaleString()}
                  >
                    Updated {relativeTime(s.updated_at)}
                    {s.updated_by ? ` by ${s.updated_by}` : ""}
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  disabled={busy !== null || !dirty}
                  onClick={() => void save(s.key)}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === s.key ? "Saving…" : "Save"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
