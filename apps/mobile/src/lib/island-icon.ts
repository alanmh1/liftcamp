/**
 * The Dynamic Island icon's file URL. iOS only (island-icon.ios.ts);
 * elsewhere there is no Live Activity, so there is no icon.
 */
export function islandIconUri(): Promise<string | null> {
  return Promise.resolve(null);
}
