/**
 * The origin that og:image and twitter:image resolve against, so a preview
 * deploy's link cards show that preview's images. Set at build time in
 * vite.config.ts from Vercel's system variables, the same value in the
 * server and client bundles:
 *   VERCEL_ENV=production -> https://liftcamp.app
 *   otherwise             -> https://$VERCEL_BRANCH_URL, then https://$VERCEL_URL,
 *                            then http://localhost:3000
 *
 * Canonical URLs, the sitemap and JSON-LD stay on https://liftcamp.app.
 */
declare const __LC_METADATA_BASE__: string;

export const METADATA_BASE: string = __LC_METADATA_BASE__;

/** `path` ("/og-ios-launch.png") as an absolute URL on METADATA_BASE. */
export function metadataUrl(path: string): string {
  return new URL(path, METADATA_BASE).toString();
}

/** The default link-card image for the site and the homepage. */
export const OG_IMAGE_URL = metadataUrl("/og-ios-launch.png");
