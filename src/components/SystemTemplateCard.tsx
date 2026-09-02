import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { muscleColors } from "@/lib/exercise-visuals";
import { startWorkoutFromTemplate, type TemplateRow } from "@/lib/templates";

/** Built-in routine card: Use starts it now, Duplicate copies it into the
 *  user's own templates. Shared by the home screen and /routines. */
export function SystemTemplateCard({
  template,
  muscles,
}: {
  template: TemplateRow;
  muscles?: string[];
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
    <div className="rounded-lg bg-secondary px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight">{template.name}</p>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-accent-foreground">
          Built-in
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {count} exercise{count === 1 ? "" : "s"}
      </p>
      {muscles && muscles.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {muscles.map((m) => {
            const c = muscleColors(m);
            return (
              <li
                key={m}
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold capitalize"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                {m}
              </li>
            );
          })}
        </ul>
      )}
      {/* Signed-out visitors on the public /routines page have no session to
          start a workout with, so the button pair becomes one link into
          sign-up. */}
      {!user ? (
        <Link
          to="/login"
          search={{ mode: "signup" }}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Use this routine
        </Link>
      ) : (
        <div className="mt-3 flex gap-2">
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
