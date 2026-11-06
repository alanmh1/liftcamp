import { describe, expect, it } from "vitest";
import { appleAppSiteAssociation } from "./apple-app-site-association";

describe("appleAppSiteAssociation", () => {
  it("names the app by team and bundle ID", () => {
    const [detail] = appleAppSiteAssociation().applinks.details;
    expect(detail.appIDs).toEqual(["YT3J428K94.app.liftcamp.mobile"]);
  });

  it("claims the TikTok callback and nothing else", () => {
    const [detail] = appleAppSiteAssociation().applinks.details;
    expect(detail.components.map((c) => c["/"])).toEqual(["/tiktok/share-callback"]);
  });
});
