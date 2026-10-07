import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

/**
 * The app icon for the Dynamic Island, as a file URL in the app group
 * container the widget extension reads (expo-widgets' widgetsDirectory).
 *
 * The PNG ships in the JS bundle, so a new icon can go out over the air: it
 * is copied in under its content hash, and a changed image lands under a
 * new name. The extension reads it by path at render time (the island's
 * Image `uiImage`), so nothing is bundled in the extension.
 *
 * 66 × 66 px: 22 pt at 3x for the expanded island, and enough for 18 pt at
 * 3x in the compact one. Null when it cannot be written, and the island
 * then draws without it; the next call tries again.
 */
let pending: Promise<string | null> | null = null;

export function islandIconUri(): Promise<string | null> {
  pending ??= write().then((uri) => {
    if (uri == null) pending = null;
    return uri;
  });
  return pending;
}

async function write(): Promise<string | null> {
  try {
    if (!widgetsDirectory) return null;
    const asset = Asset.fromModule(require('../../assets/images/island-icon.png'));
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    const target = new File(widgetsDirectory, `island-icon-${asset.hash ?? 'v1'}.png`);
    if (!target.exists) await new File(asset.localUri).copy(target);
    return target.uri;
  } catch {
    return null;
  }
}
