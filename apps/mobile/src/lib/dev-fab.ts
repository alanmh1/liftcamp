import { requireOptionalNativeModule } from 'expo';

/**
 * The Expo dev client's floating tools button (the gear) sits over the
 * bottom of the screen and covers a sheet's buttons. It belongs to
 * expo-dev-menu, which is `debugOnly` on iOS, so it never exists in a
 * Release, preview or production build; nothing in the app draws it.
 *
 * While any sheet is open this turns its preference off, and back on when
 * the last one closes, but only if it was on to begin with, so a gear the
 * developer hid in the dev menu stays hidden. iOS only: Android's
 * expo-dev-menu does not register the preferences module, so there it is
 * a no-op.
 */

type DevMenuPreferences = {
  getPreferencesAsync(): Promise<{ showFloatingActionButton?: boolean }>;
  setPreferencesAsync(settings: { showFloatingActionButton: boolean }): Promise<void>;
};

const prefs = __DEV__ ? requireOptionalNativeModule<DevMenuPreferences>('DevMenuPreferences') : null;

let openSheets = 0;
let hiddenByUs = false;

export function devFabSheetOpened(): void {
  if (!prefs) return;
  openSheets += 1;
  if (openSheets !== 1) return;
  prefs
    .getPreferencesAsync()
    .then((p) => {
      // The sheet may already have closed while this was out.
      if (openSheets === 0 || hiddenByUs || !p.showFloatingActionButton) return;
      hiddenByUs = true;
      return prefs.setPreferencesAsync({ showFloatingActionButton: false });
    })
    .catch(() => {
      // Dev only; the gear just stays.
    });
}

export function devFabSheetClosed(): void {
  if (!prefs) return;
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets !== 0 || !hiddenByUs) return;
  hiddenByUs = false;
  prefs.setPreferencesAsync({ showFloatingActionButton: true }).catch(() => {
    // Dev only; it can be turned back on from the dev menu.
  });
}
