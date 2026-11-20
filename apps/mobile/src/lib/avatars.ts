import { createAvatarCache, type AvatarCache } from '@liftcamp/shared';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getAvatars } from '@/data/social';

/**
 * Other people's profile photos in social, cached for the session
 * (docs/profile-photos-spec.md; rules in packages/shared
 * social-avatars.ts). Every avatar on a screen asks in the same tick, so a
 * feed page or a Following list is one `social_avatars` call. Answers,
 * misses included, are kept about 10 minutes.
 *
 * One cache per signed-in user: what one account may see never shows for
 * the next one on the same phone.
 */

let owner: string | null = null;
let cache: AvatarCache | null = null;
let version = 0;
const listeners = new Set<() => void>();

function cacheFor(userId: string): AvatarCache {
  if (owner !== userId || !cache) {
    owner = userId;
    cache = createAvatarCache({
      fetch: async (ids) => {
        const found = await getAvatars(ids);
        return found ? [...found].map(([user_id, avatar_url]) => ({ user_id, avatar_url })) : null;
      },
    });
    cache.subscribe(() => {
      version++;
      for (const l of listeners) l();
    });
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forgets `userId`'s photo, so the next screen asks again. Used by the Settings switch. */
export function clearAvatar(userId: string) {
  if (owner && cache) cache.clear(userId);
}

/**
 * The photos for `ids` the caller may see: a map of user id to address,
 * filled in as answers arrive. An id not in the map shows initials.
 */
export function useAvatars(ids: readonly (string | null | undefined)[]): Map<string, string> {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const key = ids.filter(Boolean).join(',');
  const v = useSyncExternalStore(subscribe, () => version);

  useEffect(() => {
    if (!me || !key) return;
    void cacheFor(me).load(key.split(','));
  }, [me, key]);

  return useMemo(() => {
    const map = new Map<string, string>();
    if (!me || !key) return map;
    const c = cacheFor(me);
    for (const id of key.split(',')) {
      const url = c.peek(id);
      if (url) map.set(id, url);
    }
    return map;
    // v re-reads the cache when answers arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, key, v]);
}

/** One person's photo, or null for initials. */
export function useAvatar(userId: string | null | undefined): string | null {
  return useAvatars([userId]).get(userId ?? '') ?? null;
}
