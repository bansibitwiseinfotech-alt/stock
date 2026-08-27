// =====================================================
// SMART STOCK - SHOPIFY BILLING PLANS (BACKEND CONFIG)
// =====================================================
// Source of truth for real Shopify AppSubscription charges.

const SHOPIFY_BILLING_PLANS = {
  basic: {
    id: "basic",
    name: "Smart Stock Basic",
    planName: "Basic",
    monthly: {
      price: 19.0,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: "$19",
      periodLabel: "/ month",
    },
    yearly: {
      price: 190.0,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: "$190",
      periodLabel: "/ year",
      discountNotice: "Save $38 (2 months free)",
    },
  },

  pro: {
    id: "pro",
    name: "Smart Stock Pro",
    planName: "Pro",
    monthly: {
      price: 49.0,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: "$49",
      periodLabel: "/ month",
    },
    yearly: {
      price: 490.0,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: "$490",
      periodLabel: "/ year",
      discountNotice: "Save $98 (2 months free)",
    },
  },

  premium: {
    id: "premium",
    name: "Smart Stock Premium",
    planName: "Premium",
    monthly: {
      price: 99.0,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      formattedPrice: "$99",
      periodLabel: "/ month",
    },
    yearly: {
      price: 990.0,
      currencyCode: "USD",
      interval: "ANNUAL",
      formattedPrice: "$990",
      periodLabel: "/ year",
      discountNotice: "Save $198 (2 months free)",
    },
  },
};

module.exports = SHOPIFY_BILLING_PLANS;
