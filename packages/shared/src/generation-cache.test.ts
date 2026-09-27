import { describe, expect, it, vi } from "vitest";

import { GenerationCache } from "./generation-cache";

/** A loader that resolves when told to, and counts its calls. */
function deferredLoader<T>() {
  const pending: ((v: T | null) => void)[] = [];
  const loader = vi.fn(() => new Promise<T | null>((resolve) => pending.push(resolve)));
  return { loader, resolveNext: (v: T | null) => pending.shift()?.(v) };
}

describe("GenerationCache", () => {
  it("serves a loaded value until something is written", async () => {
    const cache = new GenerationCache<string>();
    const loader = vi.fn(async () => "rows v1");
    expect(await cache.load("user|lb", loader)).toBe("rows v1");
    expect(await cache.load("user|lb", loader)).toBe("rows v1");
    expect(loader).toHaveBeenCalledTimes(1);

    cache.invalidate();
    expect(cache.peek("user|lb")).toBeUndefined();
    await cache.load("user|lb", loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("a read after Finish sees the finished workout", async () => {
    // The workout screen awaits finishWorkout, which invalidates, before it
    // routes to the summary. So the summary's read always starts after the
    // invalidation and never gets the pre-finish scan.
    const cache = new GenerationCache<string>();
    await cache.load("user|lb", async () => "before finish");
    cache.invalidate(); // finishWorkout
    expect(await cache.load("user|lb", async () => "after finish")).toBe("after finish");
  });

  it("treats a load that a write overtook as already stale", async () => {
    const cache = new GenerationCache<string>();
    const { loader, resolveNext } = deferredLoader<string>();
    const first = cache.load("user|lb", loader);
    cache.invalidate(); // a set is logged while the scan is in flight
    resolveNext("rows from before the set");
    expect(await first).toBe("rows from before the set");
    expect(cache.peek("user|lb")).toBeUndefined();

    const second = cache.load("user|lb", loader);
    resolveNext("rows with the set");
    expect(await second).toBe("rows with the set");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between callers", async () => {
    const cache = new GenerationCache<string>();
    const { loader, resolveNext } = deferredLoader<string>();
    const a = cache.load("user|lb", loader);
    const b = cache.load("user|lb", loader);
    resolveNext("rows");
    expect(await a).toBe("rows");
    expect(await b).toBe("rows");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not share an in-flight load across a write", async () => {
    const cache = new GenerationCache<string>();
    const { loader, resolveNext } = deferredLoader<string>();
    const a = cache.load("user|lb", loader);
    cache.invalidate();
    const b = cache.load("user|lb", loader);
    expect(loader).toHaveBeenCalledTimes(2);
    resolveNext("old");
    resolveNext("new");
    expect(await a).toBe("old");
    expect(await b).toBe("new");
    expect(cache.peek("user|lb")).toBe("new");
  });

  it("keys by user and unit", async () => {
    const cache = new GenerationCache<string>();
    await cache.load("user|lb", async () => "in lb");
    expect(cache.peek("user|kg")).toBeUndefined();
    expect(await cache.load("user|kg", async () => "in kg")).toBe("in kg");
  });

  it("reloads when forced, as pull to refresh does", async () => {
    const cache = new GenerationCache<string>();
    await cache.load("user|lb", async () => "old");
    expect(await cache.load("user|lb", async () => "new", { force: true })).toBe("new");
    expect(cache.peek("user|lb")).toBe("new");
  });

  it("never caches a failed load", async () => {
    const cache = new GenerationCache<string>();
    expect(await cache.load("user|lb", async () => null)).toBeNull();
    expect(cache.peek("user|lb")).toBeUndefined();
    await expect(cache.load("user|lb", async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(cache.peek("user|lb")).toBeUndefined();
    expect(await cache.load("user|lb", async () => "rows")).toBe("rows");
  });

  it("caches a boxed empty answer, such as no bodyweight set", async () => {
    // A bare null means the read failed; an answer that is legitimately
    // empty is boxed so it is kept.
    const cache = new GenerationCache<{ value: number | null }>();
    const loader = vi.fn(async () => ({ value: null }));
    expect(await cache.load("user", loader)).toEqual({ value: null });
    expect(await cache.load("user", loader)).toEqual({ value: null });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not let an older load overwrite a newer entry", async () => {
    const cache = new GenerationCache<string>();
    const { loader, resolveNext } = deferredLoader<string>();
    const old = cache.load("user|lb", loader);
    cache.invalidate();
    await cache.load("user|lb", async () => "new");
    resolveNext("old");
    await old;
    expect(cache.peek("user|lb")).toBe("new");
  });

  it("exposes the generation so a screen can tell whether it is stale", () => {
    const cache = new GenerationCache<string>();
    const shownAt = cache.generation;
    expect(cache.generation).toBe(shownAt);
    cache.invalidate();
    expect(cache.generation).not.toBe(shownAt);
  });
});
