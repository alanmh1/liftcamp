/**
 * Rules for sharing a card straight to another app. The native side is in
 * apps/mobile/modules/share-targets.
 */

/** Where TikTok returns after a share. Registered in the TikTok portal. */
export const TIKTOK_SHARE_CALLBACK_URL = "https://liftcamp.app/tiktok/share-callback";

/** True for TikTok's return link, whole or as the bare path a router may pass. */
export function isTikTokShareCallback(path: string): boolean {
  return /^(?:https:\/\/liftcamp\.app)?\/?tiktok\/share-callback(?:[/?#]|$)/i.test(path);
}

/**
 * Whether the TikTok button may show, install check aside. Always in a dev
 * build, for recording TikTok's sandbox demo. Otherwise the admin flag's
 * usual rule: never a guest, a revoke wins, then the grant or the global
 * switch. A read that failed arrives here as off.
 */
export function tikTokShareOn(input: {
  isDev: boolean;
  isGuest: boolean;
  enabledForAll: boolean;
  userState: string | null;
}): boolean {
  if (input.isDev) return true;
  if (input.isGuest || input.userState === "revoked") return false;
  return input.enabledForAll || input.userState === "granted";
}
