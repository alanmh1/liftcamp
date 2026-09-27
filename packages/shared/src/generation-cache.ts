/**
 * An in-memory cache that goes stale when anything is written.
 *
 * One counter, the generation, stands for "the data may have changed".
 * Every write the app makes to what the cache holds calls `invalidate()`,
 * which bumps it. A cached value is served only while the generation it
 * was loaded at is still the current one and the key matches, so there is
 * no expiry to tune: a value is good exactly until the next write.
 *
 * The generation is read before a load starts. A write that lands while
 * the load is in flight leaves the result already stale, so the next read
 * loads again rather than trusting data that may predate the write.
 *
 * Callers asking for the same key at the same generation share one
 * in-flight load. A loader that returns null (a failed or abandoned read)
 * or throws is never cached, so the next read tries again.
 */
export class GenerationCache<T> {
  private generationValue = 0;
  private entry: { key: string; generation: number; value: T } | null = null;
  private inflight: { key: string; generation: number; promise: Promise<T | null> } | null = null;

  /** Marks everything cached so far as stale. */
  invalidate(): void {
    this.generationValue += 1;
  }

  /** The current generation, for a caller that remembers what its screen was built from. */
  get generation(): number {
    return this.generationValue;
  }

  /** The cached value for `key`, if nothing has been written since it was loaded. */
  peek(key: string): T | undefined {
    const e = this.entry;
    return e && e.key === key && e.generation === this.generationValue ? e.value : undefined;
  }

  /**
   * The value for `key`: the cached one when fresh, else a load, shared
   * with any caller already loading the same key at this generation.
   * `force` skips both and loads again, as pull to refresh does.
   */
  load(key: string, loader: () => Promise<T | null>, { force = false }: { force?: boolean } = {}): Promise<T | null> {
    if (!force) {
      const hit = this.peek(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const f = this.inflight;
      if (f && f.key === key && f.generation === this.generationValue) return f.promise;
    }
    const generation = this.generationValue;
    const promise = loader()
      .then((value) => {
        // Never let an older load overwrite a newer entry.
        if (value !== null && (!this.entry || this.entry.generation <= generation)) {
          this.entry = { key, generation, value };
        }
        return value;
      })
      .finally(() => {
        if (this.inflight?.promise === promise) this.inflight = null;
      });
    this.inflight = { key, generation, promise };
    return promise;
  }
}
