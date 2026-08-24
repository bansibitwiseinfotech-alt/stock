const Store = require("../models/Store");
const SmartBadgeRecommendation = require("../models/SmartBadgeRecommendation");
const { getAllActiveProducts, getProductById } = require("./shopifyProductService");
const { getProductSalesAndCoPurchases } = require("./shopifySalesService");
const { analyzeBundleOpportunity } = require("./smartBadgeBundleService");
const { getStoreBadgeSettings, normalizeShop } = require("./badgeConfiguration.service");
const {
  getAppliedBadgesMap,
  getActiveAssignmentsCount,
} = require("./badgeAssignment.service");
const {
  recommendBadge,
  BADGES,
  scoreLowStock,
  scoreProgressiveMarkdown,
  scoreClearanceSale,
  scoreBundle,
  scorePreOrder,
} = require("./smartBadgeRecommendationService");

/**
 * Core engine runner for analyzing products and computing real recommendations.
 * Reuses the existing recommendation engine completely.
 */
async function runSmartBadgeAnalysis({ shop, accessToken, specificProducts = null }) {
  const cleanShop = normalizeShop(shop);
  const settings = await getStoreBadgeSettings(cleanShop);

  let products = [];
  if (Array.isArray(specificProducts) && specificProducts.length > 0) {
    products = specificProducts;
  } else {
    products = await getAllActiveProducts({ shop: cleanShop, accessToken });
  }

  // Deduplicate products by id
  const uniqueProductsMap = {};
  for (const p of products) {
    if (p && p.id) {
      uniqueProductsMap[p.id] = p;
    }
  }
  const uniqueProducts = Object.values(uniqueProductsMap);

  // Fetch real order sales & co-purchase data
  const { productSales, coPurchasesMap, totalOrdersWithProduct } =
    await getProductSalesAndCoPurchases({
      shop: cleanShop,
      accessToken,
      days: 30,
    });

  // Fetch active applied badges from centralized assignment service
  const appliedBadgesMap = await getAppliedBadgesMap(cleanShop);
  const realAppliedCount = await getActiveAssignmentsCount(cleanShop);

  const recommendations = [];

  for (const product of uniqueProducts) {
    const pId = product.id;
    const cleanPId = String(pId).replace(/^gid:\/\/shopify\/Product\//, "");
    const rawSales = productSales[pId] || {
      unitsSold30d: 0,
      salesVelocity: 0,
      averageUnitsPerDay: 0,
      lastSaleDate: null,
      daysSinceLastSale: null,
    };

    const bundleAnalysis = analyzeBundleOpportunity({
      productId: pId,
      coPurchasesMap,
      totalOrdersWithProduct,
      productMap: uniqueProductsMap,
    });

    const recommendation = recommendBadge({
      product,
      salesData: rawSales,
      bundleData: bundleAnalysis,
      settings,
    });

    const inventory = Number(product.totalInventory) || 0;
    const velocity = Number(rawSales.salesVelocity) || 0;

    let daysUntilStockout = null;
    if (inventory > 0 && velocity > 0) {
      daysUntilStockout = parseFloat((inventory / velocity).toFixed(1));
    }

    let stockRisk = "SAFE";
    if (inventory <= 2 && velocity > 0.4) {
      stockRisk = "CRITICAL";
    } else if (inventory <= 5 && velocity > 0.2) {
      stockRisk = "HIGH";
    } else if (inventory <= 10 && velocity > 0.1) {
      stockRisk = "MEDIUM";
    }

    const appliedBadgeType = appliedBadgesMap[pId] || appliedBadgesMap[cleanPId] || null;

    recommendations.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      image: product.featuredImage?.url || null,
      inventory,
      variants: product.variants?.nodes || [],

      unitsSold30d: rawSales.unitsSold30d,
      salesVelocity: rawSales.salesVelocity,
      lastSaleDate: rawSales.lastSaleDate,
      daysSinceLastSale: rawSales.daysSinceLastSale,
      daysUntilStockout,
      stockRisk,

      recommendation: {
        badge: recommendation.badge,
        score: recommendation.score,
        confidence: recommendation.confidence,
        reason: recommendation.reason,
      },

      appliedBadge: appliedBadgeType,
      isApplied: Boolean(appliedBadgeType),

      alternatives: recommendation.alternatives || [],
    });
  }

  // Calculate summary counts
  const summary = {
    productsScanned: recommendations.length,
    scanned: recommendations.length,
    recommendations: recommendations.filter((r) => r.recommendation.badge !== BADGES.NONE).length,
    applied: realAppliedCount || recommendations.filter((r) => r.isApplied).length,
    badges: {
      [BADGES.LOW_STOCK]: recommendations.filter((r) => r.recommendation.badge === BADGES.LOW_STOCK).length,
      [BADGES.CLEARANCE]: recommendations.filter((r) => r.recommendation.badge === BADGES.CLEARANCE).length,
      [BADGES.BUNDLE]: recommendations.filter((r) => r.recommendation.badge === BADGES.BUNDLE).length,
      [BADGES.PROGRESSIVE_MARKDOWN]: recommendations.filter(
        (r) => r.recommendation.badge === BADGES.PROGRESSIVE_MARKDOWN
      ).length,
      [BADGES.PRE_ORDER]: recommendations.filter((r) => r.recommendation.badge === BADGES.PRE_ORDER).length,
      [BADGES.NONE]: recommendations.filter((r) => r.recommendation.badge === BADGES.NONE).length,
    },
  };

  // Cache recommendation snapshot in MongoDB
  try {
    await SmartBadgeRecommendation.create({
      shop: cleanShop,
      scannedAt: new Date(),
      summary,
      products: recommendations,
    });
  } catch (_) {}

  return {
    scanned: recommendations.length,
    summary,
    products: recommendations,
    settings,
  };
}

module.exports = {
  runSmartBadgeAnalysis,
  recommendBadge,
  BADGES,
  scoreLowStock,
  scoreProgressiveMarkdown,
  scoreClearanceSale,
  scoreBundle,
  scorePreOrder,
};
