/**
 * Cold-start and screen-load timestamps, for measuring how long things wait.
 *
 * Off unless the bundle was built with EXPO_PUBLIC_LAUNCH_TIMING=1, which
 * Metro inlines at build time. With it on, each mark logs once as
 * `[launch] <name> +<ms since JS start> @<epoch ms>`. React Native keeps
 * console.log in Release builds, so the lines reach the device log:
 *
 *   xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "[launch]"'
 *
 * "JS start" is when this module is first evaluated, which the root
 * layout does before its other imports.
 */

const ENABLED = process.env.EXPO_PUBLIC_LAUNCH_TIMING === '1';
const JS_START = Date.now();
const seen = new Set<string>();

export function markLaunch(name: string): void {
  if (!ENABLED || seen.has(name)) return;
  seen.add(name);
  const now = Date.now();
  console.log(`[launch] ${name} +${now - JS_START}ms @${now}`);
}

/**
 * A screen's load, logged as `[screen] <screen> <phase> @<epoch ms>`, every
 * time (not once), so a second open in the same session logs again. The
 * phases a screen uses:
 *
 * - `open`: mounted, or focused again for a tab.
 * - `first`: the first data on screen (Home, which fills in by section).
 * - `content`: the screen's main content is showing.
 * - `fresh`: a background refresh behind content already shown finished.
 */
export function markScreen(screen: string, phase: 'open' | 'first' | 'content' | 'fresh'): void {
  if (!ENABLED) return;
  console.log(`[screen] ${screen} ${phase} @${Date.now()}`);
}

markLaunch('js start');
