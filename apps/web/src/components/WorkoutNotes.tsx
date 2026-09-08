import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";

/**
 * Per-workout notes ("slept badly, felt strong"). Saves on blur so the user
 * never has to think about a save button mid-session.
 */
export function WorkoutNotes({
  workoutId,
  value,
  editable = true,
  invalidateKeys = [],
}: {
  workoutId: string;
  value: string | null | undefined;
  editable?: boolean;
  invalidateKeys?: unknown[][];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(value ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  if (!editable) {
    if (!value?.trim()) return null;
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-3">
        <p className="micro text-muted-foreground">Notes</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
      </section>
    );
  }

  async function save() {
    const next = text.trim();
    if (next === (value ?? "").trim()) return;
    await supabase
      .from("workouts")
      .update({ notes: next === "" ? null : next })
      .eq("id", workoutId);
    for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor="workout-notes" className="micro text-muted-foreground">
          Notes
        </label>
        {saved && <span className="text-[13px] text-muted-foreground">Saved</span>}
      </div>
      <Textarea
        id="workout-notes"
        rows={2}
        placeholder="How did it feel? Sleep, energy, aches…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        className="resize-y text-sm"
      />
    </section>
  );
}
