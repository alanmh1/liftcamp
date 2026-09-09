import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../../lib/supabase';

type AuthState = {
  /** The active session, or null when signed out. Check `loading` first. */
  session: Session | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // getSession reads the persisted session from AsyncStorage, so a signed-in
    // user does not see the gate again on relaunch.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInAnonymously() {
    setError(null);
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) setError(signInError.message);
  }

  async function signOut() {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInAnonymously, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}
