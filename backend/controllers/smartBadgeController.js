const Store = require("../models/Store");
const SmartBadgeRecommendation = require("../models/SmartBadgeRecommendation");
const { getAllActiveProducts, getProductById } = require("../services/shopifyProductService");
const { getProductSalesAndCoPurchases } = require("../services/shopifySalesService");
const { analyzeBundleOpportunity } = require("../services/smartBadgeBundleService");
const { getStoreBadgeSettings, normalizeShop } = require("../services/badgeConfiguration.service");
const {
  getAppliedBadgesMap,
  getBadgeAssignment,
  getActiveAssignmentsCount,
  removeBadgeAssignment,
} = require("../services/badgeAssignment.service");
const { recommendBadge, BADGES } = require("../services/smartBadgeRecommendationService");
const {
  applyProductRecommendation,
  bulkApplyRecommendations,
} = require("../services/smartBadgeApply.service");

/**
 * Resolves shop domain and access token from request / Store session
 */
async function resolveShopCredentials(req) {
  const shop =
    req.query.shop ||
    req.headers["x-shopify-shop-domain"] ||
    req.body?.shop ||
    req.shopId ||
    req.shop;

  let accessToken =
    req.headers["x-shopify-access-token"] ||
    req.body?.accessToken ||
    req.shopifyAccessToken;

  if (!shop) {
    return { shop: null, accessToken: null };
  }

  const cleanShop = normalizeShop(shop);

  if (!accessToken) {
    const store = await Store.findOne({
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    }).lean();

    if (store?.accessToken) {
      accessToken = store.accessToken;
    } else if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
      accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    }
  }

  return { shop: cleanShop, accessToken };
}

/**
 * Core engine runner for analyzing products and computing real recommendations
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

    const firstVariant = product.variants?.nodes?.[0];
    const sku = firstVariant?.sku || "";
    const chosenBadge = appliedBadgeType || recommendation.badge;
    const finalScore = recommendation.score ?? 0;
    const finalConfidence = recommendation.confidence || "MEDIUM";
    const finalReason = appliedBadgeType
      ? `Active ${appliedBadgeType.toLowerCase().replace(/_/g, " ")} strategy active in database.`
      : recommendation.reason;
    const isActive = Boolean(appliedBadgeType);

    recommendations.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      image: product.featuredImage?.url || null,
      sku,
      inventory,
      salesVelocity: rawSales.salesVelocity,
      stockRisk,
      suggestedBadge: chosenBadge,
      score: finalScore,
      confidence: finalConfidence,
      reason: finalReason,
      active: isActive,

      variants: product.variants?.nodes || [],
      unitsSold30d: rawSales.unitsSold30d,
      lastSaleDate: rawSales.lastSaleDate,
      daysSinceLastSale: rawSales.daysSinceLastSale,
      daysUntilStockout,

      recommendation: {
        badge: chosenBadge,
        score: finalScore,
        confidence: finalConfidence,
        reason: finalReason,
      },

      appliedBadge: appliedBadgeType,
      isApplied: isActive,

      alternatives: recommendation.alternatives || [],
    });
  }

  // Calculate summary counts
  const recommendedCount = recommendations.filter(
    (r) => (r.suggestedBadge || r.recommendation.badge) !== BADGES.NONE
  ).length;
  const appliedCount = realAppliedCount || recommendations.filter((r) => r.active || r.isApplied).length;

  const summary = {
    productsScanned: recommendations.length,
    scanned: recommendations.length,
    recommendations: recommendedCount,
    recommended: recommendedCount,
    applied: appliedCount,
    badges: {
      [BADGES.LOW_STOCK]: recommendations.filter((r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.LOW_STOCK).length,
      [BADGES.CLEARANCE]: recommendations.filter((r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.CLEARANCE).length,
      [BADGES.BUNDLE]: recommendations.filter((r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.BUNDLE).length,
      [BADGES.PROGRESSIVE_MARKDOWN]: recommendations.filter(
        (r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.PROGRESSIVE_MARKDOWN
      ).length,
      [BADGES.PRE_ORDER]: recommendations.filter((r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.PRE_ORDER).length,
      [BADGES.NONE]: recommendations.filter((r) => (r.suggestedBadge || r.recommendation.badge) === BADGES.NONE).length,
    },
  };

  // Cache recommendation snapshot
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

/**
 * POST /api/smart-badges/scan
 */
async function scanProducts(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    const result = await runSmartBadgeAnalysis({ shop, accessToken });

    return res.json({
      success: true,
      scanned: result.summary.scanned,
      recommended: result.summary.recommended,
      applied: result.summary.applied,
      summary: result.summary,
      products: result.products,
      settings: result.settings,
      failedProducts: [],
    });
  } catch (error) {
    console.error("[SmartBadge Scan Error]:", error.message);

    if (error.status === 401 || error.code === "SHOPIFY_AUTH_REQUIRED") {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required: invalid or expired access token.",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      error: "SMART_BADGE_SCAN_FAILED",
      message: error.message || "Unable to scan Shopify products.",
    });
  }
}

/**
 * GET /api/smart-badges/recommendations
 */
async function getRecommendations(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    const forceRefresh = req.query.refresh === "true" || req.query.scan === "true";

    // 1. Instant Cache Check from MongoDB (< 30ms response time)
    if (!forceRefresh) {
      const cached = await SmartBadgeRecommendation.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      })
        .sort({ scannedAt: -1 })
        .lean()
        .catch(() => null);

      if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
        return res.json({
          success: true,
          scanned: cached.summary?.scanned || cached.summary?.productsScanned || cached.products.length,
          recommended: cached.summary?.recommended ?? cached.summary?.recommendations ?? 0,
          applied: cached.summary?.applied ?? 0,
          summary: cached.summary,
          products: cached.products,
          settings: cached.settings || {},
          cached: true,
          scannedAt: cached.scannedAt,
        });
      }
    }

    // 2. Fallback to live scan if forceRefresh or no snapshot exists in DB
    const result = await runSmartBadgeAnalysis({ shop, accessToken });

    return res.json({
      success: true,
      scanned: result.summary.scanned,
      recommended: result.summary.recommended,
      applied: result.summary.applied,
      summary: result.summary,
      products: result.products,
      settings: result.settings,
      cached: false,
    });
  } catch (error) {
    console.error("[SmartBadge Recommendations Error]:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || "SMART_BADGE_RECOMMENDATIONS_FAILED",
      message: error.message || "Failed to load smart badge recommendations.",
    });
  }
}

/**
 * GET /api/smart-badges/summary
 */
async function getSummary(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    const result = await runSmartBadgeAnalysis({ shop, accessToken });

    return res.json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    console.error("[SmartBadge Summary Error]:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || "SMART_BADGE_SUMMARY_FAILED",
      message: error.message || "Failed to load summary.",
    });
  }
}

/**
 * PATCH /api/smart-badges/:productId/apply
 */
async function applyBadge(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);
    const { productId } = req.params;
    const badgeType = req.body?.badge || req.body?.badgeType;
    const variantId = req.body?.variantId || null;
    const score = req.body?.score || 0;
    const confidence = req.body?.confidence || "MEDIUM";
    const reason = req.body?.reason || "";

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    if (!productId) {
      return res.status(404).json({
        success: false,
        error: "PRODUCT_NOT_FOUND",
        message: "Product ID is required.",
      });
    }

    if (!badgeType) {
      return res.status(400).json({
        success: false,
        error: "INVALID_BADGE_TYPE",
        message: "Badge type is required.",
      });
    }

    const result = await applyProductRecommendation({
      shop,
      accessToken,
      productId,
      variantId,
      badgeType,
      score,
      confidence,
      reason,
    });

    return res.json(result);
  } catch (error) {
    console.error("[SmartBadge Apply Error]:", error.message);
    return res.status(400).json({
      success: false,
      error: "APPLY_FAILED",
      message: error.message || "Failed to apply badge to product.",
    });
  }
}

/**
 * PATCH /api/smart-badges/:productId/disable
 */
async function disableBadge(req, res) {
  try {
    const { shop } = await resolveShopCredentials(req);
    const { productId } = req.params;

    if (!shop) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    const result = await removeBadgeAssignment(shop, productId);
    return res.json(result);
  } catch (error) {
    console.error("[SmartBadge Disable Error]:", error.message);
    return res.status(400).json({
      success: false,
      error: "DISABLE_FAILED",
      message: error.message || "Failed to disable badge for product.",
    });
  }
}

/**
 * POST /api/smart-badges/bulk-apply
 */
async function bulkApply(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);
    const items = req.body?.items || [];

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "Items array is required for bulk apply.",
      });
    }

    const result = await bulkApplyRecommendations({
      shop,
      accessToken,
      items,
    });

    return res.json(result);
  } catch (error) {
    console.error("[SmartBadge Bulk Apply Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "BULK_APPLY_FAILED",
      message: error.message || "Failed to bulk apply recommendations.",
    });
  }
}

/**
 * POST /api/smart-badges/apply-all
 */
async function applyAll(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop || !accessToken) {
      return res.status(401).json({
        success: false,
        error: "SHOPIFY_AUTH_REQUIRED",
        message: "Shopify authentication required",
      });
    }

    // 1. Run fresh analysis to get all recommended products
    const analysis = await runSmartBadgeAnalysis({ shop, accessToken });
    const eligibleProducts = analysis.products.filter(
      (p) => p.recommendation?.badge && p.recommendation.badge !== BADGES.NONE
    );

    const items = eligibleProducts.map((p) => ({
      productId: p.productId,
      badge: p.recommendation.badge,
      score: p.recommendation.score,
      confidence: p.recommendation.confidence,
      reason: p.recommendation.reason,
    }));

    const productMap = {};
    for (const p of analysis.products) {
      productMap[p.productId] = p;
    }

    // 2. Bulk apply using saved store configuration
    const result = await bulkApplyRecommendations({
      shop,
      accessToken,
      items,
      productMap,
    });

    return res.json({
      ...result,
      settings: analysis.settings,
    });
  } catch (error) {
    console.error("[SmartBadge Apply All Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "APPLY_ALL_FAILED",
      message: error.message || "Failed to apply all recommendations.",
    });
  }
}

/**
 * GET /api/smart-badges/:productId
 */
async function getProductAssignment(req, res) {
  try {
    const { shop } = await resolveShopCredentials(req);
    const { productId } = req.params;

    if (!shop || !productId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "Shop and Product ID are required.",
      });
    }

    const assignment = await getBadgeAssignment(shop, productId);
    return res.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error("[SmartBadge getProductAssignment Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "FETCH_ASSIGNMENT_FAILED",
      message: error.message || "Failed to fetch badge assignment.",
    });
  }
}

module.exports = {
  runSmartBadgeAnalysis,
  scanProducts,
  getRecommendations,
  getSummary,
  applyBadge,
  disableBadge,
  bulkApply,
  applyAll,
  getProductAssignment,
};