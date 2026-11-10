import { describe, expect, it } from "vitest";

import { isTikTokShareCallback, TIKTOK_SHARE_CALLBACK_URL, tikTokShareOn } from "./share-targets";

describe("isTikTokShareCallback", () => {
  it("matches the callback, with or without a query", () => {
    expect(isTikTokShareCallback(TIKTOK_SHARE_CALLBACK_URL)).toBe(true);
    expect(isTikTokShareCallback(`${TIKTOK_SHARE_CALLBACK_URL}?error_code=0`)).toBe(true);
  });

  it("matches the bare path", () => {
    expect(isTikTokShareCallback("/tiktok/share-callback?error_code=0")).toBe(true);
    expect(isTikTokShareCallback("tiktok/share-callback")).toBe(true);
  });

  it("leaves other links alone", () => {
    expect(isTikTokShareCallback("/invite/ABC123")).toBe(false);
    expect(isTikTokShareCallback("/tiktok/share-callback-old")).toBe(false);
    expect(isTikTokShareCallback("https://example.com/tiktok/share-callback")).toBe(false);
  });
});

describe("tikTokShareOn", () => {
  const off = { isDev: false, isGuest: false, enabledForAll: false, userState: null };

  it("is off by default", () => {
    expect(tikTokShareOn(off)).toBe(false);
  });

  it("is on in a dev build whatever the flag says", () => {
    expect(tikTokShareOn({ ...off, isDev: true })).toBe(true);
    expect(tikTokShareOn({ ...off, isDev: true, isGuest: true, userState: "revoked" })).toBe(true);
  });

  it("follows the global switch and the grant", () => {
    expect(tikTokShareOn({ ...off, enabledForAll: true })).toBe(true);
    expect(tikTokShareOn({ ...off, userState: "granted" })).toBe(true);
  });

  it("lets a revoke win over the global switch", () => {
    expect(tikTokShareOn({ ...off, enabledForAll: true, userState: "revoked" })).toBe(false);
  });

  it("never turns on for a guest", () => {
    expect(tikTokShareOn({ ...off, isGuest: true, enabledForAll: true })).toBe(false);
  });
});
