import { useEffect, useRef, useState } from "react";
import { Timer, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import {
  REST_PRESETS,
  formatRest,
  playRestChime,
  readRestPref,
  writeRestPref,
} from "@/lib/rest-timer-prefs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Rest timer that lives in an exercise header. Tap to start/pause, tap the
// reset icon to zero it, and pick a preset duration from the chevron. The
// chosen duration is remembered per exercise. It keeps counting up past zero
// so an overrun is visible rather than silently stopping.
export function RestTimer({
  autoKey,
  exerciseId,
  defaultSeconds = 90,
}: {
  autoKey?: number;
  exerciseId?: string;
  defaultSeconds?: number;
}) {
  const [duration, setDuration] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const firedRef = useRef(false);

  // Restore a saved per-exercise preference on mount.
  useEffect(() => {
    const saved = readRestPref(exerciseId);
    const next = saved ?? defaultSeconds;
    setDuration(next);
    setRemaining(next);
  }, [exerciseId, defaultSeconds]);

  // Restart whenever the parent bumps autoKey (i.e. a set was completed).
  useEffect(() => {
    if (autoKey === undefined || autoKey === 0) return;
    setRemaining(duration);
    firedRef.current = false;
    setRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && running && !firedRef.current) {
      firedRef.current = true;
      haptic([30, 60, 30]);
      playRestChime();
    }
  }, [remaining, running]);

  function choose(seconds: number) {
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(false);
    firedRef.current = false;
    writeRestPref(exerciseId, seconds);
  }

  const over = remaining < 0;
  const abs = Math.abs(remaining);
  const text = `${over ? "+" : ""}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, "0")}`;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? "Pause rest timer" : "Start rest timer"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums transition-colors",
          running
            ? over
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-muted",
        )}
      >
        <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="num">{text}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Change rest duration"
            className="inline-flex h-8 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {REST_PRESETS.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => choose(s)}
              className={cn("num text-sm", s === duration && "font-semibold text-primary")}
            >
              {formatRest(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {(running || remaining !== duration) && (
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setRemaining(duration);
            firedRef.current = false;
          }}
          aria-label="Reset rest timer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
