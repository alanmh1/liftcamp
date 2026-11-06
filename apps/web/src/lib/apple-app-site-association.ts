/** The app the universal links below open: team ID, then bundle ID. */
export const APPLE_APP_ID = "YT3J428K94.app.liftcamp.mobile";

/** Where TikTok returns to after a share. Registered in the TikTok portal. */
export const TIKTOK_SHARE_CALLBACK_PATH = "/tiktok/share-callback";

/**
 * Served at /.well-known/apple-app-site-association. Lists one path on
 * purpose: every other link on liftcamp.app stays in the browser, including
 * /i/<code>, whose page has its own Open in LiftCamp button.
 */
export function appleAppSiteAssociation() {
  return {
    applinks: {
      details: [
        {
          appIDs: [APPLE_APP_ID],
          components: [{ "/": TIKTOK_SHARE_CALLBACK_PATH, comment: "TikTok Share Kit callback" }],
        },
      ],
    },
  };
}
