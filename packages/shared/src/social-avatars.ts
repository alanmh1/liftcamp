// Other people's profile photos in social (docs/profile-photos-spec.md).
// The app asks `social_avatars` for the ids a screen shows and keeps the
// answers, misses included, for a while, so scrolling the feed does not ask
// again. Every request in the same tick goes out as one call, and an id
// already on its way is never asked for twice.

/** How long an answer (a photo or no photo) is kept. */
export const AVATAR_CACHE_MS = 10 * 60 * 1000;

/** The server reads at most this many ids per call. */
export const AVATAR_BATCH_MAX = 200;

const GOOGLE_SIZE = /=s\d+(-c)?$/;

/**
 * A Google photo address asking for a 200px square, so the 36 to 80px
 * circles stay sharp on 3x screens. Google addresses end with a size such
 * as `=s96-c`; anything else is left alone.
 */
export function sizedAvatarUrl(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  if (!host.endsWith('googleusercontent.com')) return url;
  return GOOGLE_SIZE.test(url) ? url.replace(GOOGLE_SIZE, '=s200-c') : url;
}

type Entry = { url: string | null; at: number };

export type AvatarFetch = (ids: string[]) => Promise<{ user_id: string; avatar_url: string }[] | null>;

/**
 * The session cache. `fetch` answers the photos the caller may see, or
 * null when the call failed; a failed call caches nothing, so the next
 * screen asks again. `schedule` runs the batched call once the current
 * tick's requests are in.
 */
export function createAvatarCache(opts: {
  fetch: AvatarFetch;
  now?: () => number;
  schedule?: (run: () => void) => void;
  ttlMs?: number;
}) {
  const now = opts.now ?? Date.now;
  const schedule = opts.schedule ?? ((run: () => void) => void Promise.resolve().then(run));
  const ttl = opts.ttlMs ?? AVATAR_CACHE_MS;
  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let queued = new Set<string>();
  let queuedDone: { promise: Promise<void>; resolve: () => void } | null = null;

  function fresh(id: string): Entry | null {
    const e = entries.get(id);
    if (!e) return null;
    if (now() - e.at > ttl) {
      entries.delete(id);
      return null;
    }
    return e;
  }

  function notify() {
    for (const l of listeners) l();
  }

  async function send(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += AVATAR_BATCH_MAX) {
      const chunk = ids.slice(i, i + AVATAR_BATCH_MAX);
      let rows: Awaited<ReturnType<AvatarFetch>>;
      try {
        rows = await opts.fetch(chunk);
      } catch {
        rows = null;
      }
      if (!rows) continue;
      const at = now();
      const found = new Map(rows.map((r) => [r.user_id, r.avatar_url]));
      for (const id of chunk) {
        const url = found.get(id);
        entries.set(id, { url: url ? sizedAvatarUrl(url) : null, at });
      }
    }
    notify();
  }

  function flush() {
    const ids = [...queued];
    const done = queuedDone!;
    queued = new Set();
    queuedDone = null;
    send(ids).finally(() => {
      for (const id of ids) inFlight.delete(id);
      done.resolve();
    });
  }

  return {
    /** The cached photo: a url, null for no photo, undefined when not known yet. */
    peek(id: string): string | null | undefined {
      return fresh(id)?.url;
    },

    /** Asks for every id not cached or on its way. Resolves once they are in. */
    load(ids: Iterable<string>): Promise<void> {
      const waits: Promise<void>[] = [];
      for (const id of ids) {
        if (!id || fresh(id)) continue;
        const pending = inFlight.get(id);
        if (pending) {
          waits.push(pending);
          continue;
        }
        if (!queuedDone) {
          let resolve!: () => void;
          const promise = new Promise<void>((r) => (resolve = r));
          queuedDone = { promise, resolve };
          schedule(flush);
        }
        queued.add(id);
        inFlight.set(id, queuedDone.promise);
        waits.push(queuedDone.promise);
      }
      return Promise.all(waits).then(() => undefined);
    },

    /** Drops one id (or all) so the next load asks again. */
    clear(id?: string) {
      if (id === undefined) entries.clear();
      else entries.delete(id);
      notify();
    },

    /** Called whenever answers arrive or the cache is cleared. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type AvatarCache = ReturnType<typeof createAvatarCache>;
