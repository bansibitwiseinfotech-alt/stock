// =====================================================
// SMART STOCK - BILLING PLANS DISPLAY CONFIGURATION
// =====================================================
// Note: This configuration is used for UI rendering and comparison.
// The backend subscription API remains the source of truth.

export const BILLING_PLANS = [
  {
    id: "free",
    name: "Free",
    tag: "Starter",
    description: "Essential dead-stock discovery and basic clearance sales for small catalogs.",
    products: "10 Products",
    productLimit: 10,
    monthly: {
      price: 0,
      formattedPrice: "$0",
      periodLabel: "Free Forever",
    },
    yearly: {
      price: 0,
      formattedPrice: "$0",
      periodLabel: "Free Forever",
    },
    highlight: false,
    features: [
      { name: "10 Products Catalog Limit", included: true },
      { name: "3 Clearance Sales", included: true },
      { name: "Clearance Sale Customization", included: true },
      { name: "Dead Stock Bundle", included: false, lockedIn: "Basic" },
      { name: "Low Stock Badge", included: false, lockedIn: "Pro" },
      { name: "Progressive Markdown", included: false, lockedIn: "Premium" },
      { name: "Launch Pre-Order", included: false, lockedIn: "Premium" },
      { name: "Collection Bulk Sale", included: false, lockedIn: "Premium" },
      { name: "Email Schedule (Weekly Digest)", included: false, lockedIn: "Premium" },
      { name: "Smart Badges Auto-Assignment", included: false, lockedIn: "Premium" },
    ],
  },
  {
    id: "basic",
    name: "Basic",
    tag: "Growth",
    description: "Expanded inventory clearance and BOGO bundle creation for growing merchants.",
    products: "25 Products",
    productLimit: 25,
    monthly: {
      price: 19,
      formattedPrice: "$19",
      periodLabel: "/ month",
    },
    yearly: {
      price: 190,
      formattedPrice: "$190",
      periodLabel: "/ year",
      discountNotice: "Save $38 (2 months free)",
    },
    highlight: false,
    features: [
      { name: "25 Products Catalog Limit", included: true },
      { name: "10 Clearance Sales", included: true },
      { name: "10 Dead Stock Bundles (BOGO)", included: true },
      { name: "Clearance Sale Customization", included: true },
      { name: "Bundle Customization", included: true },
      { name: "Low Stock Badge", included: false, lockedIn: "Pro" },
      { name: "Progressive Markdown", included: false, lockedIn: "Premium" },
      { name: "Launch Pre-Order", included: false, lockedIn: "Premium" },
      { name: "Collection Bulk Sale", included: false, lockedIn: "Premium" },
      { name: "Email Schedule (Weekly Digest)", included: false, lockedIn: "Premium" },
      { name: "Smart Badges Auto-Assignment", included: false, lockedIn: "Premium" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "Popular",
    description: "Urgency conversion badges with higher catalog and automation capacity.",
    products: "50 Products",
    productLimit: 50,
    monthly: {
      price: 49,
      formattedPrice: "$49",
      periodLabel: "/ month",
    },
    yearly: {
      price: 490,
      formattedPrice: "$490",
      periodLabel: "/ year",
      discountNotice: "Save $98 (2 months free)",
    },
    highlight: true,
    features: [
      { name: "50 Products Catalog Limit", included: true },
      { name: "15 Clearance Sales", included: true },
      { name: "15 Dead Stock Bundles", included: true },
      { name: "15 Low Stock Badge Uses", included: true },
      { name: "Clearance Sale Customization", included: true },
      { name: "Bundle Customization", included: true },
      { name: "Low Stock Badge Customization", included: true },
      { name: "Progressive Markdown", included: false, lockedIn: "Premium" },
      { name: "Launch Pre-Order", included: false, lockedIn: "Premium" },
      { name: "Collection Bulk Sale", included: false, lockedIn: "Premium" },
      { name: "Email Schedule (Weekly Digest)", included: false, lockedIn: "Premium" },
      { name: "Smart Badges Auto-Assignment", included: false, lockedIn: "Premium" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tag: "All-Inclusive",
    description: "Unlimited automation suite, bulk collection sales, smart badges, and automated email schedules.",
    products: "Unlimited Products",
    productLimit: Infinity,
    monthly: {
      price: 99,
      formattedPrice: "$99",
      periodLabel: "/ month",
    },
    yearly: {
      price: 990,
      formattedPrice: "$990",
      periodLabel: "/ year",
      discountNotice: "Save $198 (2 months free)",
    },
    highlight: false,
    features: [
      { name: "Unlimited Products Catalog", included: true },
      { name: "Unlimited Clearance Sales", included: true },
      { name: "Unlimited Dead Stock Bundles", included: true },
      { name: "Unlimited Low Stock Badges", included: true },
      { name: "Unlimited Progressive Markdown", included: true },
      { name: "Unlimited Launch Pre-Orders", included: true },
      { name: "Full Customization Suite", included: true },
      { name: "Collection Bulk Sale", included: true },
      { name: "Email Schedule (Weekly Digest)", included: true },
      { name: "Smart Badges Auto-Assignment", included: true },
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
