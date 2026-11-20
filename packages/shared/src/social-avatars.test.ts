import { describe, expect, it, vi } from 'vitest';

import { AVATAR_BATCH_MAX, createAvatarCache, sizedAvatarUrl } from './social-avatars';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const C = 'aaaaaaaa-0000-4000-8000-000000000003';
const PHOTO = 'https://lh3.googleusercontent.com/a/ACg8abc=s96-c';

describe('sizedAvatarUrl', () => {
  it('asks Google for 200px', () => {
    expect(sizedAvatarUrl(PHOTO)).toBe('https://lh3.googleusercontent.com/a/ACg8abc=s200-c');
    expect(sizedAvatarUrl('https://lh3.googleusercontent.com/a/x=s96')).toBe('https://lh3.googleusercontent.com/a/x=s200-c');
  });
  it('leaves other addresses alone', () => {
    expect(sizedAvatarUrl('https://lh3.googleusercontent.com/a/x')).toBe('https://lh3.googleusercontent.com/a/x');
    expect(sizedAvatarUrl('https://example.com/p=s96-c')).toBe('https://example.com/p=s96-c');
    expect(sizedAvatarUrl('not a url')).toBe('not a url');
  });
});

function setup(rows: { user_id: string; avatar_url: string }[] | null = [{ user_id: A, avatar_url: PHOTO }]) {
  let t = 0;
  const fetch = vi.fn(async (_ids: string[]) => rows);
  const cache = createAvatarCache({ fetch, now: () => t });
  return { cache, fetch, advance: (ms: number) => (t += ms) };
}

describe('createAvatarCache', () => {
  it('batches one tick of requests into one call', async () => {
    const { cache, fetch } = setup();
    await Promise.all([cache.load([A]), cache.load([B, A]), cache.load([C])]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].sort()).toEqual([A, B, C]);
    expect(cache.peek(A)).toBe('https://lh3.googleusercontent.com/a/ACg8abc=s200-c');
    expect(cache.peek(B)).toBeNull();
  });

  it('caches misses and does not ask again', async () => {
    const { cache, fetch } = setup();
    await cache.load([A, B]);
    await cache.load([A, B]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('asks again once an answer is older than ten minutes', async () => {
    const { cache, fetch, advance } = setup();
    await cache.load([B]);
    advance(10 * 60 * 1000 + 1);
    expect(cache.peek(B)).toBeUndefined();
    await cache.load([B]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not ask twice for an id on its way', async () => {
    const { cache, fetch } = setup();
    const first = cache.load([A]);
    await Promise.resolve();
    const second = cache.load([A]);
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('caches nothing when the call fails', async () => {
    const { cache, fetch } = setup(null);
    await cache.load([A]);
    expect(cache.peek(A)).toBeUndefined();
    await cache.load([A]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('splits more than 200 ids', async () => {
    const { cache, fetch } = setup([]);
    const ids = Array.from({ length: AVATAR_BATCH_MAX + 5 }, (_, i) => `id-${i}`);
    await cache.load(ids);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toHaveLength(AVATAR_BATCH_MAX);
  });

  it('clear drops one id and tells listeners', async () => {
    const { cache, fetch } = setup();
    const listener = vi.fn();
    cache.subscribe(listener);
    await cache.load([A]);
    expect(listener).toHaveBeenCalledTimes(1);
    cache.clear(A);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(cache.peek(A)).toBeUndefined();
    await cache.load([A]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
