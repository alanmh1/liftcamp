import { useEffect, useRef, useState } from "react";
import { Timer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const DEFAULT_SECONDS = 90;

// Rest timer that lives in an exercise header. Tap to start/pause, tap the
// reset icon to zero it. Counts down from 90s and keeps counting up past zero
// so an overrun is visible rather than silently stopping.
export function RestTimer({ autoKey }: { autoKey?: number }) {
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const firedRef = useRef(false);

  // Restart whenever the parent bumps autoKey (i.e. a set was completed).
  useEffect(() => {
    if (autoKey === undefined || autoKey === 0) return;
    setRemaining(DEFAULT_SECONDS);
    firedRef.current = false;
    setRunning(true);
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
    }
  }, [remaining, running]);

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
      {(running || remaining !== DEFAULT_SECONDS) && (
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setRemaining(DEFAULT_SECONDS);
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
