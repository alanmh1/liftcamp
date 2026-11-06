const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

/**
 * The native config app.json cannot hold.
 *
 * - TikTok's client key goes in Info.plist twice, as `TikTokClientKey` and as
 *   a URL scheme. It is read from EXPO_PUBLIC_TIKTOK_CLIENT_KEY at prebuild,
 *   so each EAS environment can carry its own key. A build with no key leaves
 *   both out, and the app hides the TikTok button (modules/share-targets).
 * - Android 11 and up answer canOpenURL('mailto:') only with a queries entry.
 */
function withTikTokClientKey(config) {
  return withInfoPlist(config, (next) => {
    const key = process.env.EXPO_PUBLIC_TIKTOK_CLIENT_KEY;
    if (!key) return next;
    next.modResults.TikTokClientKey = key;
    const types = next.modResults.CFBundleURLTypes ?? [];
    if (!types.some((t) => t.CFBundleURLSchemes?.includes(key))) {
      types.push({ CFBundleURLSchemes: [key] });
    }
    next.modResults.CFBundleURLTypes = types;
    return next;
  });
}

function withMailtoQuery(config) {
  return withAndroidManifest(config, (next) => {
    const manifest = next.modResults.manifest;
    manifest.queries = [
      ...(manifest.queries ?? []),
      {
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.SENDTO' } }],
            data: [{ $: { 'android:scheme': 'mailto' } }],
          },
        ],
      },
    ];
    return next;
  });
}

module.exports = (config) => withMailtoQuery(withTikTokClientKey(config));
