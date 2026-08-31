// =====================================================
// SMART STOCK - SHOPIFY BILLING PLANS (BACKEND CONFIG)
// =====================================================
// Source of truth for real Shopify AppSubscription charges.

const PLAN_PRICES = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  basic: {
    monthly: 19,
    yearly: 99,
  },
  pro: {
    monthly: 49,
    yearly: 249,
  },
  premium: {
    monthly: 99,
    yearly: 499,
  },
};

const SHOPIFY_BILLING_PLANS = {
  basic: {
    id: "basic",
    name: "Smart Stock Basic",
    planName: "Basic",
    monthly: {
      price: PLAN_PRICES.basic.monthly,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: `$${PLAN_PRICES.basic.monthly}`,
      periodLabel: "/ month",
    },
    yearly: {
      price: PLAN_PRICES.basic.yearly,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: `$${PLAN_PRICES.basic.yearly}`,
      periodLabel: "/ year",
    },
  },

  pro: {
    id: "pro",
    name: "Smart Stock Pro",
    planName: "Pro",
    monthly: {
      price: PLAN_PRICES.pro.monthly,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: `$${PLAN_PRICES.pro.monthly}`,
      periodLabel: "/ month",
    },
    yearly: {
      price: PLAN_PRICES.pro.yearly,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: `$${PLAN_PRICES.pro.yearly}`,
      periodLabel: "/ year",
    },
  },

  premium: {
    id: "premium",
    name: "Smart Stock Premium",
    planName: "Premium",
    monthly: {
      price: PLAN_PRICES.premium.monthly,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: `$${PLAN_PRICES.premium.monthly}`,
      periodLabel: "/ month",
    },
    yearly: {
      price: PLAN_PRICES.premium.yearly,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: `$${PLAN_PRICES.premium.yearly}`,
      periodLabel: "/ year",
    },
  },
};

SHOPIFY_BILLING_PLANS.PLAN_PRICES = PLAN_PRICES;

module.exports = SHOPIFY_BILLING_PLANS;

