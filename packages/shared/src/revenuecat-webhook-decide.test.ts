import { describe, expect, it } from "vitest";

import { authorized, leaveRowAlone, rowFor, usersToSync } from "../../../supabase/functions/revenuecat-webhook/decide";

// The revenuecat-webhook Edge Function's decisions. The function deploys
// with verify_jwt off, so `authorized` is the only check on a request.

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-01T12:00:00Z");

describe("authorized", () => {
  it("accepts the exact bearer value", () => {
    expect(authorized("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("refuses anything else", () => {
    expect(authorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(authorized("Bearer s3cretx", "s3cret")).toBe(false);
    expect(authorized("s3cret", "s3cret")).toBe(false);
    expect(authorized(null, "s3cret")).toBe(false);
  });
  it("refuses everything when the secret is unset or empty", () => {
    expect(authorized("Bearer ", "")).toBe(false);
    expect(authorized("Bearer undefined", undefined)).toBe(false);
  });
});

describe("usersToSync", () => {
  it("takes the app user id", () => {
    expect(usersToSync({ type: "RENEWAL", app_user_id: A })).toEqual([A]);
  });
  it("skips ids that are not Supabase user ids", () => {
    expect(usersToSync({ type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" })).toEqual([]);
    expect(usersToSync({ type: "INITIAL_PURCHASE", app_user_id: 42 })).toEqual([]);
  });
  it("takes both sides of a transfer, once each", () => {
    expect(
      usersToSync({ type: "TRANSFER", app_user_id: B, transferred_from: [A, "$RCAnonymousID:x"], transferred_to: [B] }),
    ).toEqual([B, A]);
  });
  it("ignores transfer fields on other events", () => {
    expect(usersToSync({ type: "RENEWAL", app_user_id: A, transferred_from: [B] })).toEqual([A]);
  });
  it("lower-cases ids", () => {
    expect(usersToSync({ type: "RENEWAL", app_user_id: A.toUpperCase() })).toEqual([A]);
  });
});

describe("rowFor", () => {
  it("is null for a subscriber who never had Pro", () => {
    expect(rowFor({ entitlements: {} }, NOW)).toBeNull();
    expect(rowFor({}, NOW)).toBeNull();
  });

  it("is Pro for an active yearly subscription", () => {
    expect(
      rowFor(
        {
          entitlements: { pro: { expires_date: "2027-10-01T12:00:00Z", product_identifier: "pro_yearly" } },
          subscriptions: { pro_yearly: { store: "app_store" } },
        },
        NOW,
      ),
    ).toEqual({ is_pro: true, source: "app_store", product_id: "pro_yearly", expires_at: "2027-10-01T12:00:00.000Z" });
  });

  it("is not Pro once expired, and keeps the row", () => {
    const row = rowFor(
      {
        entitlements: { pro: { expires_date: "2026-09-30T12:00:00Z", product_identifier: "pro_monthly" } },
        subscriptions: { pro_monthly: { store: "app_store" } },
      },
      NOW,
    );
    expect(row?.is_pro).toBe(false);
    expect(row?.product_id).toBe("pro_monthly");
  });

  it("stays Pro through the billing grace period, which sets the end", () => {
    expect(
      rowFor(
        {
          entitlements: {
            pro: {
              expires_date: "2026-09-30T12:00:00Z",
              grace_period_expires_date: "2026-10-14T12:00:00Z",
              product_identifier: "pro_monthly",
            },
          },
        },
        NOW,
      ),
    ).toMatchObject({ is_pro: true, expires_at: "2026-10-14T12:00:00.000Z" });
  });

  it("is Pro with no expiry for lifetime", () => {
    expect(
      rowFor(
        {
          entitlements: { pro: { expires_date: null, product_identifier: "pro_lifetime" } },
          non_subscriptions: { pro_lifetime: [{ store: "app_store" }] },
        },
        NOW,
      ),
    ).toEqual({ is_pro: true, source: "app_store", product_id: "pro_lifetime", expires_at: null });
  });

  it("names a dashboard grant promotional", () => {
    expect(
      rowFor(
        { entitlements: { pro: { expires_date: "2027-10-01T00:00:00Z", product_identifier: "rc_promo_pro_yearly" } } },
        NOW,
      )?.source,
    ).toBe("promotional");
  });

  it("ignores other entitlements", () => {
    expect(rowFor({ entitlements: { other: { expires_date: null } } }, NOW)).toBeNull();
  });
});

describe("leaveRowAlone", () => {
  it("keeps tester rows and nothing else", () => {
    expect(leaveRowAlone("tester")).toBe(true);
    expect(leaveRowAlone("app_store")).toBe(false);
    expect(leaveRowAlone("promotional")).toBe(false);
    expect(leaveRowAlone(null)).toBe(false);
    expect(leaveRowAlone(undefined)).toBe(false);
  });
});
