/** The iPhone app's App Store page, behind the web's App Store badges. */
export const APP_STORE_ID = "6815821010";
export const APP_STORE_URL = `https://apps.apple.com/app/liftcamp/id${APP_STORE_ID}`;

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

/**
 * LiftCamp on the App Store, for the /i invite page. Null until the app is
 * approved; the page says it is coming to the App Store until then.
 */
export const APP_STORE_URL: string | null = null;
