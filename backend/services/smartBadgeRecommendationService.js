const BADGES = {
  CLEARANCE: "CLEARANCE",
  BUNDLE: "BUNDLE",
  PROGRESSIVE_MARKDOWN: "PROGRESSIVE_MARKDOWN",
  LOW_STOCK: "LOW_STOCK",
  PRE_ORDER: "PRE_ORDER",
  NONE: "NONE",
};

/**
 * 1. LOW STOCK BADGE SCORING
 * Evaluates real Shopify inventory level, configured threshold, and sales velocity / urgency.
 */
function scoreLowStock(product, salesData, settings) {
  const inventory = Number(product.totalInventory) || 0;
  const threshold = Number(settings?.lowStockBadge?.threshold) || 6;

  if (inventory <= 0) {
    return { score: 0, reason: "Product is out of stock (0 units)" };
  }

  if (inventory > threshold) {
    return { score: 0, reason: `Inventory (${inventory}) is above low stock threshold (${threshold})` };
  }

  const velocity = Number(salesData?.salesVelocity) || 0;
  const unitsSold = Number(salesData?.unitsSold30d) || 0;
  const daysUntilStockout = velocity > 0 ? parseFloat((inventory / velocity).toFixed(1)) : null;

  // If velocity is near zero with long coverage (> 40 days coverage)
  if ((daysUntilStockout !== null && daysUntilStockout > 40 && unitsSold <= 1) || (velocity <= 0.05 && unitsSold <= 1)) {
    return {
      score: 35,
      reason: `Stock is low (${inventory} units), but sales velocity is extremely low (${velocity}/day).`,
    };
  }

  // Active Low Stock urgency
  let baseScore = 65;
  if (inventory <= 2) baseScore = 75;
  else if (inventory <= 4) baseScore = 70;

  let velocityBoost = 0;
  if (velocity >= 2.0) velocityBoost = 25;
  else if (velocity >= 1.0) velocityBoost = 20;
  else if (velocity >= 0.3) velocityBoost = 15;
  else if (velocity >= 0.1) velocityBoost = 10;
  else velocityBoost = 5;

  const totalScore = Math.min(100, baseScore + velocityBoost);

  let reason = `Low inventory alert: Only ${inventory} ${inventory === 1 ? "unit" : "units"} remaining in stock (threshold: ${threshold}).`;
  if (daysUntilStockout !== null && daysUntilStockout <= 20) {
    reason = `Only ${inventory} left with ${velocity}/day velocity (~${daysUntilStockout} days until stockout). Low Stock urgency recommended.`;
  }

  return { score: totalScore, reason };
}

/**
 * 2. CLEARANCE SALE SCORING
 * Targets large surplus inventory (>= 12 units) and high capital tied up in stagnant stock.
 */
function scoreClearance(product, salesData, settings) {
  const inventory = Number(product.totalInventory) || 0;
  if (inventory < 5) {
    return { score: 0, reason: "Inventory is too low for clearance sale" };
  }

  const velocity = Number(salesData?.salesVelocity) || 0;
  const daysSinceSale = salesData?.daysSinceLastSale ?? 30;
  const price = Number(product.variants?.nodes?.[0]?.price) || 0;
  const compareAtPrice = Number(product.variants?.nodes?.[0]?.compareAtPrice) || 0;
  const inventoryValue = inventory * price;

  // Clearance is strongest for larger surplus (>= 12 units)
  let invScore = 0;
  if (inventory >= 40) invScore = 35;
  else if (inventory >= 20) invScore = 30;
  else if (inventory >= 12) invScore = 25;
  else invScore = 10; // For 5-11 units, markdown is preferred

  let velScore = 0;
  if (velocity <= 0.05) velScore = 25;
  else if (velocity <= 0.2) velScore = 20;
  else if (velocity <= 0.5) velScore = 12;
  else velScore = 0;

  let inactScore = 0;
  if (daysSinceSale >= 25) inactScore = 20;
  else if (daysSinceSale >= 14) inactScore = 12;
  else inactScore = 5;

  let valueScore = 0;
  if (inventoryValue >= 500) valueScore = 15;
  else if (inventoryValue >= 100) valueScore = 8;
  else valueScore = 4;

  let discountSignal = compareAtPrice > price ? 5 : 0;

  const totalScore = Math.min(100, Math.round(invScore + velScore + inactScore + valueScore + discountSignal));

  const reason = `${inventory} units in surplus stock with ${velocity} sales/day and ${daysSinceSale} days inactive. Capital recovery: $${inventoryValue.toFixed(0)}.`;

  return { score: totalScore, reason };
}

/**
 * 3. PROGRESSIVE MARKDOWN SCORING
 * Targets moderate surplus stock (5 to 11 units) for stepped discount schedules.
 */
function scoreProgressiveMarkdown(product, salesData, settings) {
  const inventory = Number(product.totalInventory) || 0;
  if (inventory < 5) {
    return { score: 0, reason: "Inventory is too low for progressive markdown" };
  }

  const velocity = Number(salesData?.salesVelocity) || 0;
  const daysSinceSale = salesData?.daysSinceLastSale ?? 20;

  // Progressive Markdown is ideal for moderate stock (5 to 11 units)
  let invScore = 0;
  if (inventory >= 5 && inventory <= 11) invScore = 38; // Beats clearance for 5-11 units
  else if (inventory <= 20) invScore = 25;
  else invScore = 15;

  let velScore = 0;
  if (velocity <= 0.15) velScore = 25;
  else if (velocity <= 0.4) velScore = 18;
  else if (velocity <= 0.8) velScore = 10;
  else velScore = 0;

  let inactScore = 0;
  if (daysSinceSale >= 15) inactScore = 18;
  else if (daysSinceSale >= 7) inactScore = 10;
  else inactScore = 5;

  const totalScore = Math.min(100, Math.round(invScore + velScore + inactScore + 5));

  const reason = `Moderate inventory (${inventory} units) with slow turnover (${velocity}/day). Progressive markdown schedule will move units steadily.`;

  return { score: totalScore, reason };
}

/**
 * 4. BUNDLE OFFER (FBT) SCORING
 * Evaluates real co-purchase order pairings and complementary accessory pairings.
 */
function scoreBundle(product, bundleData, settings) {
  const inventory = Number(product.totalInventory) || 0;
  const title = (product.title || "").toLowerCase();

  // 1. Order-based co-purchases
  if (bundleData?.hasBundle && bundleData.coPurchaseCount > 0) {
    const coPurchases = bundleData.coPurchaseCount;
    const strength = bundleData.relationshipStrength || 0;

    let freqScore = Math.min(45, Math.round(coPurchases * 10));
    let relScore = Math.min(35, Math.round(strength * 35));
    let invScore = inventory >= 3 ? 15 : 5;

    const totalScore = Math.min(100, freqScore + relScore + invScore + 5);
    const compTitle = bundleData.topComplementaryProductTitle || "companion product";
    const reason = `Frequently bought together with ${compTitle} in ${coPurchases} orders (${Math.round(strength * 100)}% co-purchase rate).`;

    return { score: totalScore, reason };
  }

  // 2. Accessory / companion title keywords in catalog
  const accessoryKeywords = [
    "case", "cover", "strap", "charger", "cable", "adapter", "earphones",
    "earbuds", "glass", "protector", "screen", "band", "kit", "pack", "dock",
    "stand", "mount", "stylus", "pen", "pouch", "sleeve", "holder"
  ];

  const isAccessory = accessoryKeywords.some((kw) => title.includes(kw));

  if (isAccessory && inventory >= 2) {
    const totalScore = 88; // Strong score for accessory bundling
    const reason = `High bundle potential: Frequently paired as an accessory / companion item with primary products.`;
    return { score: totalScore, reason };
  }

  return { score: 0, reason: "Insufficient co-purchase or bundle relationship data" };
}

/**
 * 5. PRE-ORDER SCORING
 * Identifies configured launches AND out-of-stock products (0 units) that should accept pre-orders.
 */
function scorePreOrder(product, settings) {
  const rawId = String(product.id);
  const numId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");

  const isConfigured =
    settings?.preOrder?.configuredProductIds?.has(rawId) ||
    settings?.preOrder?.configuredProductIds?.has(numId) ||
    settings?.preOrder?.configuredProductIds?.has(`gid://shopify/Product/${numId}`);

  if (isConfigured) {
    return {
      score: 100,
      reason: "Active Pre-Order configuration configured for this product with launch schedule.",
    };
  }

  const inventory = Number(product.totalInventory) || 0;

  // Real out-of-stock products (0 units) are prime pre-order candidates to capture advance orders
  if (inventory <= 0) {
    return {
      score: 85,
      reason: "Product is currently out of stock (0 units). Pre-Order badge captures customer demand and advance sales.",
    };
  }

  return { score: 0, reason: "Product has inventory available (> 0 units)" };
}

function getConfidence(score) {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  if (score >= 30) return "LOW";
  return null;
}

/**
 * Calculates candidate scores for all 5 badges and selects the ONE best badge
 */
function recommendBadge({
  product,
  salesData,
  bundleData,
  settings,
}) {
  const lowStockRes = scoreLowStock(product, salesData, settings);
  const clearanceRes = scoreClearance(product, salesData, settings);
  const markdownRes = scoreProgressiveMarkdown(product, salesData, settings);
  const bundleRes = scoreBundle(product, bundleData, settings);
  const preOrderRes = scorePreOrder(product, settings);

  const candidates = [
    {
      badge: BADGES.PRE_ORDER,
      score: preOrderRes.score,
      confidence: getConfidence(preOrderRes.score),
      reason: preOrderRes.reason,
    },
    {
      badge: BADGES.LOW_STOCK,
      score: lowStockRes.score,
      confidence: getConfidence(lowStockRes.score),
      reason: lowStockRes.reason,
    },
    {
      badge: BADGES.BUNDLE,
      score: bundleRes.score,
      confidence: getConfidence(bundleRes.score),
      reason: bundleRes.reason,
    },
    {
      badge: BADGES.PROGRESSIVE_MARKDOWN,
      score: markdownRes.score,
      confidence: getConfidence(markdownRes.score),
      reason: markdownRes.reason,
    },
    {
      badge: BADGES.CLEARANCE,
      score: clearanceRes.score,
      confidence: getConfidence(clearanceRes.score),
      reason: clearanceRes.reason,
    },
  ];

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];

  // Minimum recommendation threshold is 50
  if (!best || best.score < 50) {
    return {
      badge: BADGES.NONE,
      score: 0,
      confidence: null,
      reason: "Product is performing normally",
      alternatives: candidates.filter((c) => c.score > 0),
    };
  }

  return {
    badge: best.badge,
    score: best.score,
    confidence: getConfidence(best.score),
    reason: best.reason,
    alternatives: candidates.filter((item) => item.badge !== best.badge && item.score > 0),
  };
}

module.exports = {
  BADGES,
  scoreLowStock,
  scoreClearance,
  scoreProgressiveMarkdown,
  scoreBundle,
  scorePreOrder,
  recommendBadge,
};