import { isDevBuildFrom } from '@liftcamp/shared';
import * as Device from 'expo-device';

/**
 * True in a debug build and in any build on a Simulator or emulator,
 * Release config included (packages/shared/src/dev-traffic.ts). Read once:
 * neither input changes while the app runs.
 *
 * expo-device has been in every binary since the 9 Sep 2026 scaffold, so
 * this ships in an OTA update.
 */
const DEV_BUILD = isDevBuildFrom({ dev: __DEV__, isDevice: Device.isDevice });

export function isDevBuild(): boolean {
  return DEV_BUILD;
}
