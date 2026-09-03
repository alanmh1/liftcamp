import { useCallback, useEffect, useRef, useState } from "react";
import { Timer, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWakeLock } from "@/lib/use-wake-lock";
import { haptic } from "@/lib/haptics";
import {
  REST_PRESETS,
  clearRestRun,
  formatRest,
  playRestChime,
  readRestPref,
  readRestRun,
  writeRestPref,
  writeRestRun,
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
//
// WHY A DEADLINE, NOT A COUNTDOWN
// -------------------------------
// This used to hold `remaining` in state and decrement it once a second with
// setInterval. That is wrong on a phone: iOS and Android throttle or suspend
// timers in backgrounded tabs, and locking the screen during a 90-second rest
// is the single most common thing a user does with this component. The counter
// drifted behind real time, or froze entirely, and the chime never fired.
//
// The source of truth is now `endsAt` -- a wall-clock epoch-millisecond
// deadline. `remaining` is derived from Date.now() on every repaint, so the
// display is correct no matter how long the interval was starved. The interval
// carries no state; it only triggers a repaint.
//
// This fixes accuracy. It does NOT alert you while the screen is off -- the web
// has no reliable scheduled local notification. That needs a screen wake lock
// held for the duration of a workout, which is separate work.

const TICK_MS = 250;

// Crossing zero while the tab was hidden must not chime on return: the user is
// looking at a "+2:14" overrun, and a chime two minutes late reads as a bug.
const STALE_CHIME_MS = 2_000;

export function RestTimer({
  autoKey,
  stopKey = 0,
  exerciseId,
  defaultSeconds = 90,
}: {
  autoKey?: number;
  stopKey?: number;
  exerciseId?: string;
  defaultSeconds?: number;
}) {
  const [duration, setDuration] = useState(defaultSeconds);
  // Wall-clock deadline while running; null when paused or stopped.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  // Seconds remaining while paused. May be negative if paused during overrun.
  const [pausedRemaining, setPausedRemaining] = useState(defaultSeconds);
  // Bumped purely to force a repaint from the derived clock.
  const [, setTick] = useState(0);
  const firedRef = useRef(false);


  const running = endsAt !== null;

  // Hold the screen awake only while resting, not for the whole workout. Rest is
  // 60-180s; a session is an hour or more, and pinning the display on for that
  // long is a real battery cost for a benefit that only applies during rest.
  // This is also the only moment the lock does anything useful -- it is what
  // lets the chime actually reach someone whose phone is sitting on the bench.
  useWakeLock(running);

  const secondsLeft = (deadline: number) => Math.ceil((deadline - Date.now()) / 1000);
  const remaining = running ? secondsLeft(endsAt) : pausedRemaining;

  const persist = useCallback(
    (deadline: number | null, secs: number) => {
      if (!exerciseId) return;
      if (deadline === null) clearRestRun();
      else writeRestRun({ exerciseId, endsAt: deadline, duration: secs });
    },
    [exerciseId],
  );

  // Restore the saved per-exercise duration, and any timer that was still
  // running when the tab was discarded.
  useEffect(() => {
    const saved = readRestPref(exerciseId) ?? defaultSeconds;
    setDuration(saved);

    const run = readRestRun();
    if (run && exerciseId && run.exerciseId === exerciseId) {
      setDuration(run.duration);
      setEndsAt(run.endsAt);
      // Already expired while we were away: restore in the fired state so it
      // shows the overrun instead of chiming on arrival.
      firedRef.current = secondsLeft(run.endsAt) <= 0;
      return;
    }
    setEndsAt(null);
    setPausedRemaining(saved);
    firedRef.current = false;
  }, [exerciseId, defaultSeconds]);

  // Restart whenever the parent bumps autoKey (i.e. a set was completed).
  useEffect(() => {
    if (autoKey === undefined || autoKey === 0) return;
    const deadline = Date.now() + duration * 1000;
    firedRef.current = false;
    setEndsAt(deadline);
    persist(deadline, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  // Parent bumped stopKey (exercise marked done): stop and zero out.
  useEffect(() => {
    if (!stopKey) return;
    setEndsAt(null);
    setPausedRemaining(duration);
    firedRef.current = false;
    persist(null, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopKey]);



  // Repaint loop. Sub-second so the display lands on the correct second rather
  // than up to a full second late.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // Returning from a locked screen: the interval above may have been starved
  // for minutes. Repaint immediately rather than waiting for the next tick.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Fire once when the deadline passes.
  useEffect(() => {
    if (!running || firedRef.current || remaining > 0) return;
    firedRef.current = true;
    const late = Date.now() - (endsAt ?? 0);
    const visible = typeof document === "undefined" || document.visibilityState === "visible";
    if (visible && late < STALE_CHIME_MS) {
      haptic([30, 60, 30]);
      playRestChime();
    }
  }, [running, remaining, endsAt]);

  function choose(seconds: number) {
    setDuration(seconds);
    setPausedRemaining(seconds);
    setEndsAt(null);
    firedRef.current = false;
    writeRestPref(exerciseId, seconds);
    persist(null, seconds);
  }

  function toggle() {
    if (running) {
      setPausedRemaining(secondsLeft(endsAt));
      setEndsAt(null);
      persist(null, duration);
      return;
    }
    // Resuming from an overrun keeps counting up: a deadline in the past yields
    // a negative remaining, which is exactly what should display.
    const deadline = Date.now() + pausedRemaining * 1000;
    setEndsAt(deadline);
    persist(deadline, duration);
  }

  function reset() {
    setEndsAt(null);
    setPausedRemaining(duration);
    firedRef.current = false;
    persist(null, duration);
  }

  const over = remaining < 0;
  const abs = Math.abs(remaining);
  const text = `${over ? "+" : ""}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, "0")}`;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={running ? "Pause rest timer" : "Start rest timer"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold tabular-nums transition-colors",
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
          onClick={reset}
          aria-label="Reset rest timer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
