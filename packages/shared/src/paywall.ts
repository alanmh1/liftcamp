// The paywall's words and figures. Pure: prices come in from StoreKit
// (package.product.price, priceString, currencyCode) and copy from the
// default offering's metadata, with the defaults here for a missing key.
// App copy has no colons and no em dashes.

export type PaywallPlanKind = "annual" | "monthly" | "lifetime";

/** Where a paywall was opened from, logged on paywall_viewed. */
export type PaywallSource =
  | "progression_chip"
  | "starting_weight"
  | "next_time"
  | "warmups"
  | "plate_calculator"
  | "custom_exercise_cap"
  | "routine_cap"
  | "settings";

export type PerMonthPrice = {
  /** Rounded down to the currency's minor unit. */
  amount: number;
  /** Intl.NumberFormat's output: "$0.83", "€0.83", "¥125". */
  formatted: string;
  /** What the screen shows: `formatted`, except US cents, "83¢". */
  display: string;
  /** The amount rounded up to a whole currency unit: "$1". */
  ceilUnit: string;
};

/**
 * The yearly price as a monthly figure: divided by 12, rounded down to two
 * decimals (or to none, for a currency with none) and formatted for the
 * product's currency. Works in whole minor units, so 11.88 is 99 cents and
 * never 98 from floating point.
 */
export function perMonthPrice(yearlyPrice: number, currencyCode: string, locale?: string): PerMonthPrice {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits;
  const minor = Math.floor(Math.round(yearlyPrice * scale) / 12);
  const amount = minor / scale;
  const formatted = format.format(amount);
  const whole = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return {
    amount,
    formatted,
    display: currencyCode === "USD" && amount < 1 ? `${minor}¢` : formatted,
    ceilUnit: whole.format(Math.ceil(yearlyPrice / 12)),
  };
}

export const PAYWALL_DEFAULTS = {
  title: "LiftCamp Pro",
  bullets: [
    "Know exactly what to lift next time",
    "Starting weights for every exercise",
    "Warm-up sets and a plate calculator",
    "Unlimited custom exercises and routines",
  ],
  cta: "Start free trial",
  footnote: "Logging, history, PRs and every routine stay free.",
} as const;

const CONTINUE = "Continue";

export type PaywallCopy = {
  title: string;
  /** Null: build it from the Annual package. May hold {perMonth}. */
  subtitle: string | null;
  bullets: readonly string[];
  /** The label for a selected plan with a trial. Without one it is "Continue". */
  cta: string;
  preselected: PaywallPlanKind;
};

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** "annual", "$rc_annual" or a product id, as the offering's metadata may name it. */
function planKind(v: unknown): PaywallPlanKind {
  const s = text(v)?.toLowerCase() ?? "";
  if (s.includes("month")) return "monthly";
  if (s.includes("lifetime")) return "lifetime";
  return "annual";
}

/** Copy from offering metadata (title, subtitle, bullets, cta, preselected). */
export function paywallCopy(metadata: Record<string, unknown> | null | undefined): PaywallCopy {
  const m = metadata ?? {};
  const bullets = Array.isArray(m.bullets) ? m.bullets.filter((b): b is string => text(b) !== null) : [];
  return {
    title: text(m.title) ?? PAYWALL_DEFAULTS.title,
    subtitle: text(m.subtitle),
    bullets: bullets.length > 0 ? bullets : PAYWALL_DEFAULTS.bullets,
    cta: text(m.cta) ?? PAYWALL_DEFAULTS.cta,
    preselected: planKind(m.preselected),
  };
}

/**
 * The line under the title. `template` is the metadata's, if any. Under 1
 * in the store's currency it names the next whole unit, because the figure
 * is rounded down: $9.99 a year is 83.25¢ a month, more than 83¢ and less
 * than $1.
 */
export function paywallSubtitle(template: string | null, perMonth: PerMonthPrice | null): string {
  if (template) return perMonth ? template.split("{perMonth}").join(perMonth.display) : template.includes("{perMonth}") ? "" : template;
  if (!perMonth) return "";
  return perMonth.amount < 1
    ? `Less than ${perMonth.ceilUnit} a month, billed yearly.`
    : `${perMonth.display} a month, billed yearly.`;
}

/** The trial's length in days from StoreKit's intro price, or null with none. */
export function trialDays(intro: { periodUnit: string; periodNumberOfUnits: number } | null | undefined): number | null {
  if (!intro || intro.periodNumberOfUnits <= 0) return null;
  const perUnit: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
  const days = perUnit[intro.periodUnit];
  return days ? days * intro.periodNumberOfUnits : null;
}

export type PaywallPlan = {
  kind: PaywallPlanKind;
  productId: string;
  priceString: string;
  price: number;
  currencyCode: string;
  /** Set only when the user is eligible for the trial. */
  trialDays: number | null;
};

export type PlanRowCopy = { label: string; figure: string; detail: string | null; tag: string | null };

/** One plan row. Annual leads with its monthly figure; the yearly price sits right under it. */
export function planRowCopy(plan: PaywallPlan, locale?: string): PlanRowCopy {
  if (plan.kind === "annual") {
    const perMonth = perMonthPrice(plan.price, plan.currencyCode, locale);
    return {
      label: "Yearly",
      figure: `${perMonth.display} a month`,
      detail: `${plan.priceString} a year`,
      tag: plan.trialDays ? `${plan.trialDays} days free` : null,
    };
  }
  if (plan.kind === "monthly") {
    return { label: "Monthly", figure: `${plan.priceString} a month`, detail: null, tag: null };
  }
  return { label: "Lifetime", figure: plan.priceString, detail: "One payment", tag: null };
}

const RENEWS = "Renews automatically until you cancel.";

/** The full charge and renewal terms for the selected plan, in plain words. */
export function billedLine(plan: PaywallPlan): string {
  if (plan.kind === "lifetime") return `${plan.priceString} once. Yours for good.`;
  if (plan.kind === "monthly") return `${plan.priceString} a month. ${RENEWS}`;
  return plan.trialDays
    ? `${plan.trialDays} days free, then ${plan.priceString} a year. ${RENEWS}`
    : `${plan.priceString} a year. ${RENEWS}`;
}

/** The button. A trial's label never shows on a plan with no trial. */
export function paywallCta(plan: PaywallPlan, copy: PaywallCopy): string {
  return plan.kind === "annual" && plan.trialDays ? copy.cta : CONTINUE;
}

/** The plan to select first: the metadata's, or the first on offer. */
export function preselectedPlan(plans: readonly PaywallPlan[], copy: PaywallCopy): PaywallPlan | null {
  return plans.find((p) => p.kind === copy.preselected) ?? plans[0] ?? null;
}
