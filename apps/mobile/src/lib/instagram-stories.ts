import { Linking } from 'react-native';

/**
 * Sharing a card straight to an Instagram story.
 *
 * Empty until the Meta App ID exists. The summary screen hides the Stories
 * button while it is empty, so nothing below is reachable yet.
 */
export const INSTAGRAM_APP_ID = '';

export function canShareToStories(): boolean {
  return INSTAGRAM_APP_ID.length > 0;
}

/**
 * Deferred until the App ID arrives. Instagram's iOS API does not take the
 * image on the URL: it reads `com.instagram.sharedSticker.backgroundImage`
 * and `com.instagram.sharedSticker.appID` off the general pasteboard, and
 * writing a pasteboard item with those keys needs a few lines of native
 * code (a local Expo module) that neither expo-sharing nor expo-clipboard
 * covers. That module comes with the App ID, so it can be tested the day
 * it is written. Until then this only opens the scheme.
 */
export async function shareToStories(_imageUri: string): Promise<boolean> {
  if (!canShareToStories()) return false;
  const url = `instagram-stories://share?source_application=${INSTAGRAM_APP_ID}`;
  if (!(await Linking.canOpenURL(url))) return false;
  await Linking.openURL(url);
  return true;
}
