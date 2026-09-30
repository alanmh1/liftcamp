import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GUEST_SESSION_KEY,
  OFFLINE_SIGN_IN_MESSAGE,
  guestFlagFor,
  isRetryableAuthError,
  parseStoredSession,
  sessionToKeep,
  shouldRecoverGuest,
} from '@liftcamp/shared';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { SESSION_STORAGE_KEY, supabase } from '../../lib/supabase';

/** The session as supabase-js last saved it, read straight from storage with no network. */
async function readStoredSession(): Promise<Session | null> {
  try {
    return parseStoredSession<Session & { refresh_token: string; user: { id: string } }>(
      await AsyncStorage.getItem(SESSION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

type AuthState = {
  /** The active session, or null when signed out. Check `loading` first. */
  session: Session | null;
  /** True until the stored session is read, and while a lost guest is replaced. */
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return value;
}

/**
 * The session, from the stored one at launch and every auth event after.
 *
 * A guest that loses its session gets a new guest in its place. A guest
 * account cannot be signed back into, so when its refresh token is
 * rejected (the empty-guest cleanup removed the account, most often) the
 * sign-in screen would be a dead end. Instead the root holds on its
 * spinner, a fresh guest is signed in, and the onboarding check sends it
 * through onboarding like any new account. The device flag
 * `GUEST_SESSION_KEY` is how a lost session is known to have been a
 * guest's; the app's own sign-outs (account deletion, Start fresh) clear
 * it first, so they never trigger this. A real account's sign-out behaves
 * as before.
 *
 * Launch never waits on the network. The stored session is read straight
 * from AsyncStorage and the app renders from it at once, even with its
 * access token expired. Then getSession(), which refreshes an expired
 * token, decides (sessionToKeep in shared): a refresh that failed for want
 * of a network keeps the stored session, and never starts a guest
 * recovery; only a refusal from the auth server, which auth-js follows
 * with SIGNED_OUT, or an empty store signs out. Auto-refresh (lib/
 * supabase.ts) swaps in a fresh token once the phone is back online.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacingGuest, setReplacingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The most recent session seen, so a check that awaited storage can tell
  // a newer sign-in landed meanwhile.
  const latest = useRef<Session | null>(null);
  const recovering = useRef(false);

  useEffect(() => {
    async function settle(next: Session | null) {
      latest.current = next;
      const flag = guestFlagFor(next);
      if (flag === 'set') void AsyncStorage.setItem(GUEST_SESSION_KEY, '1').catch(() => {});
      if (flag === 'clear') void AsyncStorage.removeItem(GUEST_SESSION_KEY).catch(() => {});
      if (next) {
        setSession(next);
        setLoading(false);
        return;
      }

      const lastWasGuest = await AsyncStorage.getItem(GUEST_SESSION_KEY).then(
        (v) => v === '1',
        () => false,
      );
      if (latest.current) return;
      if (!shouldRecoverGuest({ hasSession: false, lastWasGuest, recovering: recovering.current })) {
        if (!recovering.current) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      recovering.current = true;
      setReplacingGuest(true);
      setSession(null);
      if (__DEV__) console.log('[auth] guest session lost; signing in a new guest');
      // On success the SIGNED_IN event has already set the new session by
      // the time this resolves. On failure (offline, rate limited) the
      // sign-in screen shows and the flag stays, so the next launch tries
      // again.
      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError && __DEV__) console.log(`[auth] new guest failed: ${signInError.message}`);
      recovering.current = false;
      setReplacingGuest(false);
      setLoading(false);
    }

    // Set by any event after launch (a sign-in, a refreshed token, a
    // sign-out). It is newer than whatever getSession answers, so it wins.
    let eventSeen = false;
    void (async () => {
      const stored = await readStoredSession();
      if (stored && !eventSeen) void settle(stored);
      const { data, error: loadError } = await supabase.auth.getSession();
      if (eventSeen) return;
      if (__DEV__ && !data.session && stored && isRetryableAuthError(loadError)) {
        console.log('[auth] refresh failed offline; keeping the stored session');
      }
      const keep = sessionToKeep({ session: data.session, error: loadError }, stored);
      // Already settled on this one from storage.
      if (keep && keep === stored && latest.current === stored) return;
      void settle(keep);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // The launch read above covers it, with the error auth-js drops here:
      // an INITIAL_SESSION of null is also an expired token with no signal.
      if (event === 'INITIAL_SESSION') return;
      eventSeen = true;
      void settle(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInAnonymously() {
    setError(null);
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) setError(isRetryableAuthError(signInError) ? OFFLINE_SIGN_IN_MESSAGE : signInError.message);
  }

  async function signOut() {
    setError(null);
    // A chosen sign-out is never a lost guest session. Settings hides Sign
    // out for guests, but clear the flag first in case one gets here.
    await AsyncStorage.removeItem(GUEST_SESSION_KEY).catch(() => {});
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  return (
    <AuthContext.Provider
      value={{ session, loading: loading || replacingGuest, signInAnonymously, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}
