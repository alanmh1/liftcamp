import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { muscleColors } from "@/lib/exercise-visuals";
import { startWorkoutFromTemplate } from "@/lib/templates";
import type { TemplateRow } from "@liftcamp/shared";
import type { TileAccent } from "@/lib/routine-tiles";

/** Built-in routine card: Use starts it now, Duplicate copies it into the
 *  user's own templates. Shared by the home screen and /routines. */
export function SystemTemplateCard({
  template,
  muscles,
  tile,
}: {
  template: TemplateRow;
  muscles?: string[];
  /** Present only on /routines. The home screen passes nothing and renders the
   *  card exactly as before. */
  tile?: {
    accent: TileAccent;
    programLabel: string;
    dayNumber: number;
    coverImageUrl?: string | null;
  };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"use" | "dup" | null>(null);

  async function use() {
    if (!user || busy) return;
    setBusy("use");
    const id = await startWorkoutFromTemplate(user.id, template);
    if (!id) {
      setBusy(null);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
  }

  async function duplicate() {
    if (!user || busy) return;
    setBusy("dup");
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .insert({ user_id: user.id, name: template.name, is_system: false })
      .select("id")
      .single();
    if (tplErr || !tpl) {
      console.error(tplErr);
      setBusy(null);
      return;
    }
    void track(EVENTS.routineChosen, { template: template.name, is_system: !!template.is_system });

    const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
    if (ordered.length > 0) {
      const rows = ordered.map((te, i) => ({
        template_id: tpl.id,
        exercise_id: te.exercise_id,
        user_id: user.id,
        position: i,
      }));
      const { error: teErr } = await supabase.from("template_exercises").insert(rows);
      if (teErr) {
        console.error(teErr);
        setBusy(null);
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["templates", user.id] });
    toast.success(`"${template.name}" copied to your templates.`);
    setBusy(null);
  }

  const count = template.template_exercises.length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-secondary px-4 py-3">
      {tile && (
        <div
          className="relative mb-3 -mx-4 -mt-3 flex h-[112px] shrink-0 flex-col justify-end overflow-hidden bg-cover bg-center px-4 pb-3"
          style={
            tile.coverImageUrl
              ? { backgroundImage: `url(${tile.coverImageUrl})`, backgroundColor: "#FDFCFB" }
              : { backgroundColor: tile.accent.bg, color: tile.accent.fg }
          }
        >
          {/* Solid paper panel on the left so the label and day name stay
              readable whatever the artwork does behind them. */}
          {tile.coverImageUrl && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, #FDFCFB 0%, #FDFCFB 40%, rgba(253,252,251,0) 62%)",
              }}
            />
          )}

          {/* Ghosted day numeral. Decorative, hidden from assistive tech. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-1 -top-6 select-none text-[104px] font-bold leading-none tracking-tight opacity-15"
            style={tile.coverImageUrl ? { color: "#221F1B", opacity: 0.08 } : undefined}
          >
            {tile.dayNumber}
          </span>

          <p
            className="relative text-[13px] font-semibold uppercase tracking-[0.08em] opacity-85"
            style={tile.coverImageUrl ? { color: "#221F1B", opacity: 0.7 } : undefined}
          >
            {tile.programLabel}
          </p>
          <p
            className="relative mt-0.5 text-[17px] font-bold leading-tight tracking-tight"
            style={tile.coverImageUrl ? { color: "#221F1B" } : undefined}
          >
            {template.name}
          </p>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        {!tile && <p className="text-sm font-semibold tracking-tight">{template.name}</p>}
        <p className="text-[13px] text-muted-foreground">
          {count} exercise{count === 1 ? "" : "s"}
        </p>
        {!tile && (
          <span className="ml-auto shrink-0 rounded-full bg-accent px-2.5 py-1 text-[13px] font-semibold uppercase tracking-wide text-accent-foreground">
            Built-in
          </span>
        )}
      </div>
      {muscles && muscles.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {muscles.map((m) => {
            const c = muscleColors(m);
            return (
              <li
                key={m}
                className="rounded-full px-2.5 py-1 text-[13px] font-semibold capitalize"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                {m}
              </li>
            );
          })}
        </ul>
      )}
      {/* Own wrapper so the gap above the action is fixed at 16px however many
          rows the muscle chips wrap to, and mt-auto still pins it to the
          bottom of a stretched card. */}
      {!user ? (
        <div className="mt-auto pt-4">
          <Link
            to="/login"
            search={{ mode: "signup" }}
            className="inline-flex h-11 w-1/2 min-w-[150px] items-center justify-center rounded-md border border-input bg-background text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Use this routine
          </Link>
        </div>
      ) : (
        <div className="mt-auto flex gap-2 pt-4">
          <button
            onClick={use}
            disabled={busy !== null}
            className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy === "use" ? "…" : "Use"}
          </button>
          <button
            onClick={duplicate}
            disabled={busy !== null}
            className="flex-1 h-11 rounded-md border border-input bg-background text-sm font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy === "dup" ? "…" : "Duplicate"}
          </button>
        </div>
      )}
    </div>
  );
}
