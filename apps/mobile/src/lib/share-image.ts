import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/** The link every shared card carries in its text. */
export const SHARE_URL = 'https://liftcamp.app';

/**
 * Opens the system share sheet for a captured card image.
 *
 * iOS takes the image and a line of text together through the system
 * sheet, so the share carries the app name even if the image is
 * stripped. Android's sheet takes one or the other, so it gets the image.
 */
export async function shareImage(uri: string, message: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await Share.share({ url: uri, message });
  } else {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: message });
  }
}
