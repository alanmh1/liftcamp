// Rest-timer defaults + per-exercise overrides.
//
// Compounds get a longer default rest than isolation work. The user can pick a
// different preset per exercise; that choice is remembered locally so the same
// movement starts with the same rest next session.

export const REST_PRESETS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180] as const;

export function defaultRestSeconds(ex: { mechanic?: string | null } | null | undefined): number {
  const mech = (ex?.mechanic ?? "").toLowerCase();
  if (mech.includes("compound")) return 120;
  if (mech.includes("isolation")) return 60;
  return 90;
}

function key(exerciseId: string) {
  return `liftcamp:rest:${exerciseId}`;
}

export function readRestPref(exerciseId: string | null | undefined): number | null {
  if (!exerciseId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(exerciseId));
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeRestPref(exerciseId: string | null | undefined, seconds: number): void {
  if (!exerciseId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(exerciseId), String(seconds));
  } catch {
    /* storage unavailable — fall back to session-only behaviour */
  }
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? (s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, "0")}`) : `0:${s.toString().padStart(2, "0")}`;
}

// Short two-tone chime when rest is up. Uses WebAudio so there's no asset to
// ship, and fails silently when the browser blocks audio.
export function playRestChime(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* audio unavailable */
  }
}

// ---------------------------------------------------------------------------
// In-flight timer persistence
// ---------------------------------------------------------------------------
//
// iOS discards backgrounded tabs aggressively. Without this, locking the phone
// during rest and coming back remounts the component with a fresh timer, so the
// user loses their place. Persisting the wall-clock deadline means the timer is
// reconstructed correctly however long the tab was gone.
//
// Deliberately one key, not one per exercise: only one rest timer is ever
// meaningfully running. Restore is guarded on exerciseId so a stale run from a
// different movement can't bleed into the wrong header.

export type RestRun = { exerciseId: string; endsAt: number; duration: number };

const RUN_KEY = "liftcamp:rest:run";

export function readRestRun(): RestRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RestRun>;
    if (typeof v?.exerciseId !== "string") return null;
    if (!Number.isFinite(v.endsAt) || !Number.isFinite(v.duration)) return null;
    // A deadline more than an hour in the past is abandoned, not resumed.
    if (Date.now() - (v.endsAt as number) > 3_600_000) return null;
    return v as RestRun;
  } catch {
    return null;
  }
}

export function writeRestRun(run: RestRun): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* storage unavailable — timer still works, just won't survive a reload */
  }
}

export function clearRestRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}
