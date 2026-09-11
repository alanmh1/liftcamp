/**
 * TEMPORARY. Perf investigation of Start-routine latency, 11 Sep 2026.
 * Remove this file and every `timing(` / `[timing]` call once the numbers
 * are in. Nothing here should ship.
 */

const marks = new Map<string, number>();

/** Start a named stage. Nested stages are fine; names just need to differ. */
export function timingStart(name: string): void {
  marks.set(name, performance.now());
}

/** End a stage and log its duration. Returns the ms so callers can sum. */
export function timingEnd(name: string, note = ''): number {
  const start = marks.get(name);
  if (start == null) return 0;
  const ms = performance.now() - start;
  marks.delete(name);
  console.log(`[timing] ${name.padEnd(34)} ${ms.toFixed(0).padStart(5)} ms ${note}`);
  return ms;
}

/** Wrap a promise-returning call as one stage. */
export async function timed<T>(name: string, fn: () => PromiseLike<T>, note = ''): Promise<T> {
  timingStart(name);
  try {
    return await fn();
  } finally {
    timingEnd(name, note);
  }
}
