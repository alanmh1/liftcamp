/** The iPhone app's App Store page, behind the web's App Store badges. */
export const APP_STORE_ID = "6815821010";

/**
 * App Store Connect provider ID for campaign links (Analytics, Acquisition,
 * Campaigns, Generate Campaign Link; the pt= value). Blank means no tracking
 * and every badge links to the plain store page.
 */
export const APP_STORE_PROVIDER_ID = "129436125";

/** Plain store page, no campaign token. */
export const APP_STORE_URL = `https://apps.apple.com/app/liftcamp/id${APP_STORE_ID}`;

/**
 * Store page tagged for App Store Connect's campaign report, so installs
 * from the site show up separately from search. `campaign` is the ct value
 * and names the surface the badge sits on (hero, footer, login).
 */
export function appStoreUrl(campaign?: string): string {
  if (!campaign || !APP_STORE_PROVIDER_ID) {
    return APP_STORE_URL;
  }
  const params = new URLSearchParams({ pt: APP_STORE_PROVIDER_ID, ct: campaign, mt: "8" });
  return `${APP_STORE_URL}?${params.toString()}`;
}

/**
 * Where "Invite a friend" sends people, in the share sheet's link and at
 * the end of its message. The site, since it serves both platforms: the
 * App Store badge and Smart App Banner on iPhone, the web app on Android.
 */
export const INVITE_URL = "https://liftcamp.app";

/**
 * The Progressive Overload guide on the site, opened from the app's
 * progression guide and the exercise screen's How to tab. Tagged so the
 * site's analytics can count visits from the iOS app.
 */
export const PROGRESSIVE_OVERLOAD_GUIDE_URL = "https://liftcamp.app/guides/progressive-overload?utm_source=ios_app";
