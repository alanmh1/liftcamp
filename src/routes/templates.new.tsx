import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ExercisePicker, type PickerExercise } from "@/components/ExercisePicker";

export const Route = createFileRoute("/templates/new")({
  component: NewTemplate,
});

function NewTemplate() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<PickerExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  function addExercise(ex: PickerExercise) {
    setPicked((cur) => [...cur, ex]);
  }

  function removeAt(idx: number) {
    setPicked((cur) => cur.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed || picked.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .insert({ user_id: user.id, name: trimmed })
      .select("id")
      .single();
    if (tplErr || !tpl) {
      setSaving(false);
      setError(tplErr?.message ?? "Failed to save template.");
      return;
    }
    const rows = picked.map((ex, i) => ({
      template_id: tpl.id,
      exercise_id: ex.id,
      user_id: user.id,
      position: i,
    }));
    const { error: teErr } = await supabase.from("template_exercises").insert(rows);
    if (teErr) {
      setSaving(false);
      setError(teErr.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  const canSave = name.trim().length > 0 && picked.length > 0 && !saving;

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate({ to: "/" })}
          className="-ml-2 inline-flex items-center text-sm text-muted-foreground"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <h1 className="text-base font-semibold tracking-tight">New Template</h1>
        <button
          onClick={save}
          disabled={!canSave}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "…" : "Save"}
        </button>
      </header>

      <main className="flex-1 px-5 flex flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {picked.length > 0 && (
          <ol className="rounded-md border border-border bg-card divide-y divide-border">
            {picked.map((ex, i) => (
              <li key={`${ex.id}-${i}`} className="flex items-center px-3 py-2 gap-2">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1 truncate text-sm">{ex.name}</span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="Remove"
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
        )}

        <ExercisePicker onPick={addExercise} />

        {error && <p className="text-[13px] text-destructive">{error}</p>}
      </main>
    </div>
  );
}
