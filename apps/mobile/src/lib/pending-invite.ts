import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_INVITE_KEY, pendingInviteValue, readPendingInvite } from '@liftcamp/shared';
import { useEffect, useState } from 'react';

/**
 * An invite link the app was opened with, kept until the user can act on
 * it (docs/social-spec.md, "The code survives the trip"). `+native-intent`
 * saves it on the way in, whatever screen is up: onboarding, sign-in, a
 * guest's Home. PendingInviteHandler opens it once the user is signed up
 * and on the tabs, and the invite screen clears it once it has an answer.
 *
 * Device-level (`liftcamp:pending-invite`), so it survives onboarding,
 * sign-in and guest linking, which can change the user. Dropped after 7
 * days (readPendingInvite in shared). Account deletion and the dev reset
 * clear it with the other `liftcamp:` keys.
 *
 * Listeners hear a save, so a link that arrives while the app is open is
 * picked up without a relaunch.
 */

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function savePendingInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, pendingInviteValue(code, Date.now())).catch(() => {});
  notify();
}

/** The saved code, or null when there is none or it has expired. */
export async function readPendingInviteCode(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY).catch(() => null);
  return readPendingInvite(raw, Date.now());
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
  notify();
}

/**
 * The saved code, read at mount and again after every save or clear.
 * Undefined until the first read.
 */
export function usePendingInvite(): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const read = () =>
      void readPendingInviteCode().then((c) => {
        if (live) setCode(c);
      });
    read();
    listeners.add(read);
    return () => {
      live = false;
      listeners.delete(read);
    };
  }, []);
  return code;
}
