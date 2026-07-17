import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/components/WorkoutCalendar";

// Inline-editable workout name. Used by both the active-workout header and the
// history detail header, so a workout can be renamed during the session or any
// time after it's been logged.
//
// `className` carries all typography and margins from the caller — the two
// surfaces use different sizes (xl vs 2xl) and spacing, so nothing is baked in.
// `date`, when supplied, is appended to the display label; the history detail
// screen renders its own date line instead and omits this.
export function WorkoutName({
  workoutId,
  name,
  date,
  className = "",
}: {
  workoutId: string;
  name: string;
  date?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(name);
      setEditing(false);
      return;
    }
    if (trimmed !== name) {
      const { error } = await supabase
        .from("workouts")
        .update({ name: trimmed })
        .eq("id", workoutId);
      if (error) {
        console.error(error);
        setValue(name);
        setEditing(false);
        return;
      }
      // Without these the header re-renders the stale `name` prop the moment the
      // input closes, so a successful rename looks like it silently failed.
      // ["history"] is a prefix match covering both the history list
      // (["history", userId]) and the history detail (["history", workoutId]).
      qc.invalidateQueries({ queryKey: ["workout", workoutId] });
      qc.invalidateQueries({ queryKey: ["history"] });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setValue(name);
            setEditing(false);
          }
        }}
        className={`w-full bg-transparent border-b border-primary outline-none ${className}`}
      />
    );
  }

  // parseLocalDate, not new Date(workout_date): "2026-07-12" parses as UTC
  // midnight, which renders as July 11 in Pacific.
  const d = date ? parseLocalDate(date) : null;
  const formattedDate = d
    ? d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <button
      onClick={() => setEditing(true)}
      className={`block text-left hover:text-primary transition-colors ${className}`}
      title="Tap to rename"
    >
      {name || "Workout"}
      {formattedDate ? ` · ${formattedDate}` : ""}
    </button>
  );
}
