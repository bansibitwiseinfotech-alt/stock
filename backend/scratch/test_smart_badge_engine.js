const assert = require("assert");
const {
  recommendBadge,
  scoreLowStock,
  scoreClearance,
  scoreProgressiveMarkdown,
  scoreBundle,
  scorePreOrder,
  BADGES,
} = require("../services/smartBadgeRecommendationService");

console.log("==========================================");
console.log("RUNNING SMART BADGE RECOMMENDATION TESTS");
console.log("==========================================");

const baseSettings = {
  clearanceSale: { enabled: true, discountPercentage: 10 },
  bundleOffer: { enabled: true },
  progressiveMarkdown: { enabled: true },
  lowStockBadge: { enabled: true, threshold: 5 },
  preOrder: {
    enabled: true,
    configuredProductIds: new Set(["gid://shopify/Product/999"]),
  },
};

// ----------------------------------------------------
// TEST 1: Low stock + high velocity => LOW_STOCK
// ----------------------------------------------------
{
  const product = { id: "gid://shopify/Product/1", title: "Trending Item", totalInventory: 3 };
  const salesData = { unitsSold30d: 72, salesVelocity: 2.4, daysSinceLastSale: 1 };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 1 Result (Low stock + high velocity):", result.badge, `(Score: ${result.score})`);
  assert.strictEqual(result.badge, BADGES.LOW_STOCK, "Should recommend LOW_STOCK");
  assert.strictEqual(result.confidence, "HIGH", "Confidence should be HIGH");
}

// ----------------------------------------------------
// TEST 2: Low stock + almost no sales => NOT LOW_STOCK
// ----------------------------------------------------
{
  const product = { id: "gid://shopify/Product/2", title: "Forgotten Item", totalInventory: 4 };
  const salesData = { unitsSold30d: 1, salesVelocity: 0.03, daysSinceLastSale: 28 };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 2 Result (Low stock + zero velocity):", result.badge, `(Score: ${result.score})`);
  assert.notStrictEqual(result.badge, BADGES.LOW_STOCK, "Should NOT recommend LOW_STOCK when sales velocity is near zero");
}

// ----------------------------------------------------
// TEST 3: High stock + low sales => CLEARANCE / MARKDOWN
// ----------------------------------------------------
{
  const product = {
    id: "gid://shopify/Product/3",
    title: "Surplus Jacket",
    totalInventory: 65,
    variants: { nodes: [{ price: 45, compareAtPrice: 60 }] },
  };
  const salesData = { unitsSold30d: 3, salesVelocity: 0.1, daysSinceLastSale: 35 };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 3 Result (High stock + stagnant sales):", result.badge, `(Score: ${result.score})`);
  assert.ok(
    result.badge === BADGES.CLEARANCE || result.badge === BADGES.PROGRESSIVE_MARKDOWN,
    "Should recommend CLEARANCE or PROGRESSIVE_MARKDOWN"
  );
  assert.ok(result.score >= 70, "Score should be >= 70");
}

// ----------------------------------------------------
// TEST 4: Strong co-purchase relationship => BUNDLE
// ----------------------------------------------------
{
  const product = {
    id: "gid://shopify/Product/4",
    title: "Wireless Keyboard",
    totalInventory: 25,
  };
  const salesData = { unitsSold30d: 30, salesVelocity: 1.0, daysSinceLastSale: 1 };
  const bundleData = {
    hasBundle: true,
    coPurchaseCount: 12,
    relationshipStrength: 0.75,
    topComplementaryProductId: "gid://shopify/Product/5",
    topComplementaryProductTitle: "Ergonomic Mouse",
  };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 4 Result (Strong co-purchases):", result.badge, `(Score: ${result.score})`);
  assert.strictEqual(result.badge, BADGES.BUNDLE, "Should recommend BUNDLE");
  assert.strictEqual(result.confidence, "HIGH", "Confidence should be HIGH");
}

// ----------------------------------------------------
// TEST 5: Active Pre-Order configuration => PRE_ORDER
// ----------------------------------------------------
{
  const product = {
    id: "gid://shopify/Product/999",
    title: "Next-Gen Smartphone",
    totalInventory: 0,
  };
  const salesData = { unitsSold30d: 0, salesVelocity: 0, daysSinceLastSale: null };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 5 Result (Configured pre-order):", result.badge, `(Score: ${result.score})`);
  assert.strictEqual(result.badge, BADGES.PRE_ORDER, "Should recommend PRE_ORDER");
  assert.ok(result.score >= 90, "Score should be >= 90");
}

// ----------------------------------------------------
// TEST 6: Disabled badge module => NEVER RECOMMENDED
// ----------------------------------------------------
{
  const disabledSettings = {
    ...baseSettings,
    lowStockBadge: { enabled: false, threshold: 5 },
  };

  const product = { id: "gid://shopify/Product/6", title: "Urgent Stock", totalInventory: 2 };
  const salesData = { unitsSold30d: 60, salesVelocity: 2.0, daysSinceLastSale: 1 };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: disabledSettings });
  console.log("Test 6 Result (When module is disabled):", result.badge);
  assert.notStrictEqual(result.badge, BADGES.LOW_STOCK, "Disabled badge must never be recommended");
}

// ----------------------------------------------------
// TEST 7: Normal performance / scores below 50 => NONE
// ----------------------------------------------------
{
  const product = {
    id: "gid://shopify/Product/7",
    title: "Average Product",
    totalInventory: 15,
  };
  const salesData = { unitsSold30d: 30, salesVelocity: 1.0, daysSinceLastSale: 2 };
  const bundleData = { hasBundle: false };

  const result = recommendBadge({ product, salesData, bundleData, settings: baseSettings });
  console.log("Test 7 Result (Healthy product):", result.badge, `(Reason: ${result.reason})`);
  assert.strictEqual(result.badge, BADGES.NONE, "Healthy product should get NONE");
  assert.strictEqual(result.score, 0, "Score should be 0");
  assert.strictEqual(result.confidence, null, "Confidence should be null");
}

console.log("==========================================");
console.log("✓ ALL 7 DECISION ENGINE TESTS PASSED 100%");
console.log("==========================================");
