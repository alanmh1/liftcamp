import { useSyncExternalStore } from 'react';

/**
 * The cold-start handoff between the launch overlay and the screen the app
 * lands on, when that screen shows the same wordmark: the onboarding
 * welcome page or the signed-out sign-in screen (`LaunchWordmark`).
 *
 * The screen registers a way to measure its wordmark's window frame and
 * keeps the wordmark hidden until the overlay says it may show. When the
 * overlay is ready to leave it asks for that frame: with one, it moves its
 * own wordmark onto it, reveals the screen's in the same place, and fades
 * only its background; without one (the app landed on Home, or on a
 * returning user's first question), it fades as a whole, as before.
 *
 * Module state rather than context: the overlay sits beside the router,
 * not above the screens, and there is only ever one of each.
 */

export type WindowFrame = { x: number; y: number; width: number; height: number };

// Most recent last. Only the top one is measured; a screen mounted over
// another (the sign-in modal over the welcome page) takes over while it is
// up and hands back when it goes.
const targets: (() => Promise<WindowFrame | null>)[] = [];
let revealed = false;
const listeners = new Set<() => void>();

/**
 * Called by `LaunchWordmark` while it is mounted. Returns the unregister
 * function, for its effect cleanup.
 */
export function registerHandoffTarget(measure: () => Promise<WindowFrame | null>): () => void {
  targets.push(measure);
  return () => {
    const i = targets.lastIndexOf(measure);
    if (i >= 0) targets.splice(i, 1);
  };
}

/** The landing wordmark's frame, or null when there is none on screen. */
export async function measureHandoffTarget(): Promise<WindowFrame | null> {
  const top = targets[targets.length - 1];
  return top ? top() : null;
}

/**
 * A view's frame in window coordinates, or null if it has no size or does
 * not answer within `MEASURE_TIMEOUT_MS`. The timeout matters: the overlay
 * waits on this before it leaves, and must never wait forever.
 */
export function measureViewInWindow(
  view: { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void } | null,
): Promise<WindowFrame | null> {
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    view.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

const MEASURE_TIMEOUT_MS = 150;

/**
 * Lets the landing wordmark show. Called when the overlay's wordmark has
 * landed on it, when the overlay starts a plain fade, and when the overlay
 * is gone. Once set it stays set, so a screen mounted later (the welcome
 * page after an account deletion, the sign-in screen after a sign-out)
 * shows its wordmark straight away.
 */
export function revealHandoffTarget(): void {
  if (revealed) return;
  revealed = true;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the landing wordmark may show yet. */
export function useHandoffRevealed(): boolean {
  return useSyncExternalStore(subscribe, () => revealed);
}
