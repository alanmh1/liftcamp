import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { appVersion } from '@/data/workouts';
import { isDevBuild } from '@/lib/dev-build';
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
 * A dev build (lib/dev-build) writes its row with `props.env = 'dev'`.
 * Install rows have no user, so there is no `dev_user` row to leave them
 * out by; admin_funnel() skips them by that tag instead
 * (docs/dev-traffic-filter.sql). Writing them, rather than skipping, lets a
 * Simulator run prove the write path end to end. The insert failed
 * silently in every build until docs/install-events-fix.sql granted
 * INSERT; a dev build now logs the error.
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
  try {
    if ((await AsyncStorage.getItem(OPENED_KEY)) != null) return;
    if (await readStoredSession()) {
      await AsyncStorage.setItem(OPENED_KEY, '1');
      return;
    }
    const deviceId = await getInstallId();
    // A plain insert, not an upsert: ON CONFLICT needs SELECT on the table
    // and a SELECT policy, which anon and authenticated do not have. A
    // second row for the same (device_id, name) fails with 23505, which
    // means the first open is already recorded.
    const { error } = await supabase.from('install_events').insert({
      device_id: deviceId,
      name: 'app_opened',
      props: {
        platform: Platform.OS,
        app_version: appVersion(),
        ...(isDevBuild() ? { env: 'dev' } : {}),
      },
    });
    if (!error || error.code === UNIQUE_VIOLATION) {
      await AsyncStorage.setItem(OPENED_KEY, '1');
      return;
    }
    // Any other error (offline, mostly) leaves the flag unset, so the next
    // launch tries again.
    if (__DEV__) console.warn(`[install] app_opened not recorded: ${error.code} ${error.message}`);
  } catch (e) {
    // Best effort, like every other analytics write.
    if (__DEV__) console.warn('[install] app_opened threw', e);
  }
}
