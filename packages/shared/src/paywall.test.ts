import { describe, expect, it } from "vitest";
import {
  PAYWALL_DEFAULTS,
  billedLine,
  paywallCopy,
  paywallCta,
  paywallSubtitle,
  perMonthPrice,
  planRowCopy,
  preselectedPlan,
  trialDays,
  type PaywallPlan,
} from "./paywall";

const annual: PaywallPlan = { kind: "annual", productId: "pro_yearly", priceString: "$9.99", price: 9.99, currencyCode: "USD", trialDays: 7 };
const monthly: PaywallPlan = { kind: "monthly", productId: "pro_monthly", priceString: "$1.99", price: 1.99, currencyCode: "USD", trialDays: null };
const lifetime: PaywallPlan = { kind: "lifetime", productId: "pro_lifetime", priceString: "$29.99", price: 29.99, currencyCode: "USD", trialDays: null };

describe("perMonthPrice", () => {
  it("USD 9.99 is 83 cents, rounded down", () => {
    const p = perMonthPrice(9.99, "USD", "en-US");
    expect(p.amount).toBe(0.83);
    expect(p.formatted).toBe("$0.83");
    expect(p.display).toBe("83¢");
  });
  it("EUR 9.99 keeps the currency's own format", () => {
    expect(perMonthPrice(9.99, "EUR", "en-US").display).toBe("€0.83");
    expect(perMonthPrice(9.99, "EUR", "de-DE").formatted.replace(/\s/g, " ")).toBe("0,83 €");
  });
  it("JPY has no decimals and still rounds down", () => {
    const p = perMonthPrice(1000, "JPY", "en-US");
    expect(p.amount).toBe(83);
    expect(p.formatted).toBe("¥83");
    expect(perMonthPrice(1199, "JPY", "en-US").amount).toBe(99);
  });
  it("does not lose a cent to floating point", () => {
    expect(perMonthPrice(11.88, "USD", "en-US").amount).toBe(0.99);
  });
  it("shows dollars from a dollar up", () => {
    expect(perMonthPrice(23.99, "USD", "en-US").display).toBe("$1.99");
  });
});

describe("paywallCopy", () => {
  it("falls back to the defaults", () => {
    const copy = paywallCopy({});
    expect(copy.title).toBe("LiftCamp Pro");
    expect(copy.subtitle).toBeNull();
    expect(copy.bullets).toEqual(PAYWALL_DEFAULTS.bullets);
    expect(copy.preselected).toBe("annual");
    expect(paywallCopy(null).cta).toBe("Start free trial");
  });
  it("takes each metadata key", () => {
    const copy = paywallCopy({ title: "T", subtitle: "S", bullets: ["a", 3, ""], cta: "Go", preselected: "$rc_monthly" });
    expect(copy).toEqual({ title: "T", subtitle: "S", bullets: ["a"], cta: "Go", preselected: "monthly" });
  });
  it("ignores bullets that are not a string array", () => {
    expect(paywallCopy({ bullets: "one" }).bullets).toEqual(PAYWALL_DEFAULTS.bullets);
  });
  it("reads a product id as a plan", () => {
    expect(paywallCopy({ preselected: "pro_lifetime" }).preselected).toBe("lifetime");
  });
});

describe("paywallSubtitle", () => {
  const usd = perMonthPrice(9.99, "USD", "en-US");
  it("says less than the next whole unit under 1", () => {
    expect(paywallSubtitle(null, usd)).toBe("Less than $1 a month, billed yearly.");
    expect(paywallSubtitle(null, perMonthPrice(9.99, "EUR", "en-US"))).toBe("Less than €1 a month, billed yearly.");
  });
  it("states the figure from 1 up in dollars too", () => {
    expect(paywallSubtitle(null, perMonthPrice(14.99, "USD", "en-US"))).toBe("$1.24 a month, billed yearly.");
  });
  it("states the figure from 1 up", () => {
    expect(paywallSubtitle(null, perMonthPrice(1000, "JPY", "en-US"))).toBe("¥83 a month, billed yearly.");
  });
  it("fills a metadata template", () => {
    expect(paywallSubtitle("Just {perMonth} a month.", usd)).toBe("Just 83¢ a month.");
  });
  it("uses a template with no placeholder as it is", () => {
    expect(paywallSubtitle("Less than $1 a month.", usd)).toBe("Less than $1 a month.");
  });
  it("shows no unfilled placeholder", () => {
    expect(paywallSubtitle("Just {perMonth}", null)).toBe("");
  });
});

describe("planRowCopy", () => {
  it("annual leads with the monthly figure, the yearly price under it", () => {
    expect(planRowCopy(annual, "en-US")).toEqual({
      label: "Yearly",
      figure: "83¢ a month",
      detail: "$9.99 a year",
      tag: "7 days free",
    });
  });
  it("shows no trial tag when not eligible", () => {
    expect(planRowCopy({ ...annual, trialDays: null }, "en-US").tag).toBeNull();
  });
  it("monthly and lifetime", () => {
    expect(planRowCopy(monthly).figure).toBe("$1.99 a month");
    expect(planRowCopy(lifetime)).toMatchObject({ figure: "$29.99", detail: "One payment" });
  });
});

describe("billedLine", () => {
  it("says the charge and the renewal for each plan", () => {
    expect(billedLine(annual)).toBe("7 days free, then $9.99 a year. Renews automatically until you cancel.");
    expect(billedLine({ ...annual, trialDays: null })).toBe("$9.99 a year. Renews automatically until you cancel.");
    expect(billedLine(monthly)).toBe("$1.99 a month. Renews automatically until you cancel.");
    expect(billedLine(lifetime)).toBe("$29.99 once. Yours for good.");
  });
});

describe("paywallCta", () => {
  const copy = paywallCopy({});
  it("offers the trial only on Annual when eligible", () => {
    expect(paywallCta(annual, copy)).toBe("Start free trial");
    expect(paywallCta({ ...annual, trialDays: null }, copy)).toBe("Continue");
    expect(paywallCta(monthly, copy)).toBe("Continue");
    expect(paywallCta(lifetime, paywallCopy({ cta: "Start now" }))).toBe("Continue");
  });
});

describe("preselectedPlan", () => {
  it("takes the metadata's plan, then the first on offer", () => {
    expect(preselectedPlan([annual, monthly], paywallCopy({ preselected: "monthly" }))).toBe(monthly);
    expect(preselectedPlan([monthly, lifetime], paywallCopy({}))).toBe(monthly);
    expect(preselectedPlan([], paywallCopy({}))).toBeNull();
  });
});

describe("trialDays", () => {
  it("reads StoreKit's period", () => {
    expect(trialDays({ periodUnit: "DAY", periodNumberOfUnits: 7 })).toBe(7);
    expect(trialDays({ periodUnit: "WEEK", periodNumberOfUnits: 1 })).toBe(7);
    expect(trialDays(null)).toBeNull();
  });
});
