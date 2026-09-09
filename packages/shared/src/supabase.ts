import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * The storage contract Supabase auth needs to persist a session.
 *
 * Declared structurally rather than imported, because the library's own
 * `SupportedStorage` is built on the DOM `Storage` type and this package
 * compiles without the DOM lib. React Native's AsyncStorage satisfies it, and
 * so does `window.localStorage`.
 */
export type AuthStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};

export type LiftCampClient = SupabaseClient<Database>;

/**
 * Builds a typed Supabase client. This is a factory rather than a client
 * instance, because web and mobile persist sessions differently: the browser
 * has localStorage, React Native has AsyncStorage, and a server render has
 * neither. Each app supplies its own adapter and owns the resulting instance.
 *
 * `detectSessionInUrl` is off. It reads the URL fragment after an OAuth
 * redirect, which is browser behaviour that misfires in a native app.
 */
export function createLiftCampClient(
  url: string,
  key: string,
  storage: AuthStorage,
): LiftCampClient {
  if (!url) {
    throw new Error("createLiftCampClient: missing Supabase URL.");
  }
  if (!key) {
    throw new Error("createLiftCampClient: missing Supabase publishable key.");
  }

  return createClient<Database>(url, key, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
