import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * Taps on a notification (docs/onboarding-fork-spec.md, Reminders on
 * planned days). A `planned` reminder opens Home and, on it, the Up next
 * routine, the way Next up does before the first finish. Every other kind
 * opens the app and nothing more.
 *
 * Home may not be mounted yet (a cold start) or may already be showing, so
 * the request is a flag Home takes once it knows its Up next, plus a
 * listener for a Home that is already up. In memory only, like
 * lib/import-prompt.
 */
let pending = false;
const listeners = new Set<() => void>();

function requestUpNextOnHome(): void {
  pending = true;
  for (const l of listeners) l();
}

/** True once per request, for Home once its Up next is known. */
export function takeUpNextOnHome(): boolean {
  const was = pending;
  pending = false;
  return was;
}

/** Whether a request is waiting, without taking it. */
export function upNextRequested(): boolean {
  return pending;
}

/** Calls `fn` on each new request. Returns the unsubscribe. */
export function subscribeUpNextRequests(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The identifiers already handled, so the cold-start read and the listener never act twice. */
const handled = new Set<string>();

function kindOf(response: Notifications.NotificationResponse): unknown {
  return response.notification.request.content.data?.kind;
}

/**
 * Mounted once with the signed-in, onboarded stack. Handles the response
 * that launched the app (cold start) and every tap after.
 *
 * TODO(android-notifications): Android has no nudges yet; this already
 * handles its taps once that branch schedules them.
 */
export function useNotificationOpens(): void {
  const router = useRouter();
  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null, live: boolean) => {
      if (!response) return;
      const id = `${response.notification.request.identifier}@${response.notification.date}`;
      if (handled.has(id)) return;
      handled.add(id);
      if (kindOf(response) !== 'planned') return;
      requestUpNextOnHome();
      // A cold start lands on Home already; a tap while the app runs may
      // find it on another tab or screen.
      if (live) router.navigate('/');
    };
    try {
      handle(Notifications.getLastNotificationResponse(), false);
      Notifications.clearLastNotificationResponse();
    } catch {
      // No native module in an old build: nothing to read.
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r, true));
    return () => sub.remove();
  }, [router]);
}
