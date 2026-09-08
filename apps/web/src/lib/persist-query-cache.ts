// Persists the React Query cache to localStorage so an offline cold launch can
// still render the current workout, history and exercise data from the last
// online session. Without this, "offline logging" would open to empty screens.
//
// Client-only, and deliberately imperative rather than PersistQueryClientProvider:
// the QueryClient is created per request in src/router.tsx (SSR), so the
// provider tree must not change shape between server and client.

import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const CACHE_KEY = "liftcamp.query-cache.v1";
const MAX_AGE = 1000 * 60 * 60 * 24 * 14;

export function startQueryPersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  // Persisted entries are useless if the in-memory cache garbage-collects them
  // first; two weeks matches the persister's max age.
  queryClient.setDefaultOptions({
    queries: { gcTime: MAX_AGE, networkMode: "offlineFirst", retry: 1 },
    mutations: { networkMode: "offlineFirst" },
  });

  try {
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: createSyncStoragePersister({ storage: window.localStorage, key: CACHE_KEY }),
      maxAge: MAX_AGE,
      buster: "v1",
      dehydrateOptions: {
        // Never persist anything that could leak one account's data into
        // another session; auth-scoped keys carry the user id and are dropped
        // wholesale on sign-out (see clearPersistedQueryCache).
        shouldDehydrateQuery: (q) => q.state.status === "success",
      },
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

export function clearPersistedQueryCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}
