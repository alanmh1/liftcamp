import { PROGRESSIVE_OVERLOAD_GUIDE_URL } from '@liftcamp/shared';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

/**
 * Opens the site's Progressive Overload guide in an in-app Safari sheet,
 * so closing it lands back where the person was. Falls back to Safari
 * itself if the sheet cannot open.
 */
export function openProgressiveOverloadGuide(): void {
  WebBrowser.openBrowserAsync(PROGRESSIVE_OVERLOAD_GUIDE_URL).catch(() => {
    Linking.openURL(PROGRESSIVE_OVERLOAD_GUIDE_URL).catch(() => {});
  });
}
