// =====================================================
// SMART STOCK - BILLING PLANS DISPLAY CONFIGURATION
// =====================================================
// Note: This configuration is used for UI rendering and comparison.
// The backend subscription API remains the source of truth.

export const PLAN_PRICES = {
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

export const BILLING_PLANS = [
  {
    id: "free",
    name: "Free",
    tag: "Starter",
    description: "Essential dead-stock discovery and basic clearance sales for small catalogs.",
    products: "10 Products",
    productLimit: 10,
    monthly: {
      price: PLAN_PRICES.free.monthly,
      formattedPrice: `$${PLAN_PRICES.free.monthly}`,
      periodLabel: "Free Forever",
    },
    yearly: {
      price: PLAN_PRICES.free.yearly,
      formattedPrice: `$${PLAN_PRICES.free.yearly}`,
      periodLabel: "Free Forever",
    },
    highlight: false,
    features: [      
      { name: "10 Products Catalog Limit", included: true },
      { name: "3 Clearance Sales", included: true },
      { name: "Clearance Sale Customization", included: true },
                                                                             
    ],
  },
  {
    id: "basic",
    name: "Basic",
    tag: "Growth",
    description: "Expanded inventory clearance and BOGO bundle creation for growing merchants.",
    products: "20 Products",
    productLimit: 20,
    monthly: {  
      price: PLAN_PRICES.basic.monthly,
      formattedPrice: `$${PLAN_PRICES.basic.monthly}`,
      periodLabel: "/ month",
    },
    yearly: {                                                                                                                                                                                                                                                                                                                                    
      price: PLAN_PRICES.basic.yearly,
      formattedPrice: `$${PLAN_PRICES.basic.yearly}`,       
      periodLabel: "/ year",
    },
    highlight: false,
    features: [
      { name: "20 Products Catalog Limit", included: true },
      { name: "10 Clearance Sales", included: true },
      { name: "Clearance Sale Customization", included: true },
      { name: "10 Dead Stock Bundles (BOGO)", included: true },
      { name: "Bundle Customization", included: true },
      { name: "10 Progressive Markdown", included: true },
      { name: "Progressive markdown customize", included: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "Popular",
    description: "Urgency conversion badges with higher catalog and automation capacity.",
    products: "500 Products",
    productLimit: 500,
    monthly: {
      price: PLAN_PRICES.pro.monthly,
      formattedPrice: `$${PLAN_PRICES.pro.monthly}`,
      periodLabel: "/ month",
    },     
    yearly: {
      price: PLAN_PRICES.pro.yearly,
      formattedPrice: `$${PLAN_PRICES.pro.yearly}`,
      periodLabel: "/ year",
    },
    highlight: true,
    features: [
      { name: "500 Products Catalog Limit", included: true },
      { name: "15 Clearance Sales", included: true },
      { name: "15 Dead Stock Bundles(BOGO)", included: true },
      { name: "15 Progressive Markdown", included: true },                                                    
      { name: "15 Low Stock Badge Uses", included: true },
      { name: "Clearance Sale Customization", included: true },
      { name: "Bundle Customization", included: true },
      { name: "Progressive markdown customize", included: true },
      { name: "Low Stock Badge Customization", included: true },

    ],
  },
  {
    id: "premium",
    name: "Premium",
    tag: "All-Inclusive",
    description: "Unlimited automation suite, bulk collection sales, smart badges, and automated email schedules.",
    products: "5,000 Products",
    productLimit: 5000,              
    monthly: {
      price: PLAN_PRICES.premium.monthly,
      formattedPrice: `$${PLAN_PRICES.premium.monthly}`,
      periodLabel: "/ month",
    },
    yearly: {
      price: PLAN_PRICES.premium.yearly,
      formattedPrice: `$${PLAN_PRICES.premium.yearly}`,
      periodLabel: "/ year",
    },
    highlight: false,
    features: [
      { name: "5,000 Products Catalog Limit", included: true },
      { name: " Clearance Sales", included: true },
      { name: " Dead Stock Bundles(BOGO)", included: true },
      { name: " Low Stock Badges", included: true },
      { name: "Progressive Markdown", included: true },
      { name: "Launch Pre-Orders", included: true },
      { name: "All Customization Suite", included: true },
      { name: "Collection Bulk Sale", included: true },
      { name: "Email Schedule (Weekly Digest)", included: true },
      { name: "Smart Badges  recommendations", included: true },
    ],
  },
];

export const PLAN_ORDER = ["free", "basic", "pro", "premium"];

export function getPlanTierIndex(planId) {
  const index = PLAN_ORDER.indexOf(String(planId).toLowerCase());
  return index >= 0 ? index : 0;
}

export function getPlanDetails(planId) {
  return (
    BILLING_PLANS.find((p) => p.id === String(planId).toLowerCase()) ||
    BILLING_PLANS[0]
  );
}

export function getPlanPrice(plan, billingCycle = "monthly") {
  if (!plan) return { formattedPrice: "$0", periodLabel: "" };
  return billingCycle === "yearly" ? plan.yearly : plan.monthly;           
}
                                                                                                                                                                                        