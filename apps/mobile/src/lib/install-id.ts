import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { appVersion } from '@/data/workouts';
import { readStoredSession, supabase } from '../../lib/supabase';

/**
 * One id per install, and the install's first open (docs/funnel-admin-spec.md).
 *
 * The keys sit outside the `liftcamp:` prefix on purpose: dev Start fresh
 * clears that prefix, and an install is still the same install after it.
 */
const ID_KEY = 'liftcamp-install:id';
const OPENED_KEY = 'liftcamp-install:opened';

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * A version 4 UUID from Math.random. Good enough for an analytics id, and
 * it keeps this file JS only, so it ships in an OTA update.
 */
function uuid4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let pending: Promise<string> | null = null;

/** The install's id, made and stored on first call. */
export function getInstallId(): Promise<string> {
  pending ??= (async () => {
    const stored = await AsyncStorage.getItem(ID_KEY).catch(() => null);
    if (stored) return stored;
    const id = uuid4();
    await AsyncStorage.setItem(ID_KEY, id).catch(() => {});
    return id;
  })();
  return pending;
}

/**
 * Records this install's first open as one `app_opened` row in
 * install_events. Never throws.
 *
 * Writes nothing in a dev build: install rows have no user, so there is no
 * `dev_user` row to leave them out by (see dev-user.ts).
 *
 * A phone that already holds a session is an existing user updating to
 * this build, not a new install, so it sets the flag without a row.
 * Without that, the first OTA would log one first open per existing
 * device on the same day. A fresh install, or a reinstall, has no stored
 * session on its first open and is counted. The check reads the stored
 * session rather than `getSession()`, which with an expired token and no
 * signal answers null and would count an existing user.
 */
export async function logFirstOpen(): Promise<void> {
  if (__DEV__) return;
  try {
    if ((await AsyncStorage.getItem(OPENED_KEY)) != null) return;
    if (await readStoredSession()) {
      await AsyncStorage.setItem(OPENED_KEY, '1');
      return;
    }
    const deviceId = await getInstallId();
    const { error } = await supabase.from('install_events').upsert(
      {
        device_id: deviceId,
        name: 'app_opened',
        props: { platform: Platform.OS, app_version: appVersion() },
      },
      { onConflict: 'device_id,name', ignoreDuplicates: true },
    );
    // Any other error (offline, mostly) leaves the flag unset, so the next
    // launch tries again.
    if (!error || error.code === UNIQUE_VIOLATION) await AsyncStorage.setItem(OPENED_KEY, '1');
  } catch {
    // Best effort, like every other analytics write.
  }
}
