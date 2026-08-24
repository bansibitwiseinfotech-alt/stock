const { getStoreBadgeSettings, validateBadgeConfig, normalizeShop } = require("./badgeConfiguration.service");
const { saveBadgeAssignment, removeBadgeAssignment, normalizeProductId } = require("./badgeAssignment.service");
const MarkdownRule = require("../models/MarkdownRule");
const LaunchPreOrder = require("../models/LaunchPreOrder");
const { BADGES } = require("./smartBadgeRecommendationService");

const VALID_BADGE_TYPES = [
  BADGES.CLEARANCE,
  BADGES.BUNDLE,
  BADGES.PROGRESSIVE_MARKDOWN,
  BADGES.LOW_STOCK,
  BADGES.PRE_ORDER,
  "PREORDER",
];

/**
 * Standardize badge name string
 */
function normalizeBadgeType(type) {
  const upper = String(type || "").trim().toUpperCase();
  if (upper === "PREORDER") return BADGES.PRE_ORDER;
  return upper;
}

/**
 * Apply a recommended badge to an individual product using saved store configuration
 */
async function applyProductRecommendation({
  shop,
  accessToken,
  productId,
  variantId = null,
  badgeType,
  score = 0,
  confidence = "MEDIUM",
  reason = "",
  productData = null,
}) {
  const cleanShop = normalizeShop(shop);
  const normalizedBadge = normalizeBadgeType(badgeType);
  const { cleanId, gid } = normalizeProductId(productId);

  if (!VALID_BADGE_TYPES.includes(normalizedBadge)) {
    throw new Error(`Invalid badge type: ${badgeType}`);
  }

  // 1. Load saved merchant-level store badge settings
  const settings = await getStoreBadgeSettings(cleanShop);

  // 2. Validate configuration
  const validation = validateBadgeConfig(settings, normalizedBadge);
  if (!validation.valid) {
    throw new Error(`Configuration invalid for ${normalizedBadge}: ${validation.reason}`);
  }

  let configurationSnapshot = {};

  // 3. Execute badge-specific underlying actions & build snapshot
  switch (normalizedBadge) {
    case BADGES.PROGRESSIVE_MARKDOWN: {
      const cfg = settings.progressiveMarkdown;
      configurationSnapshot = {
        badgeType: BADGES.PROGRESSIVE_MARKDOWN,
        startingDiscount: cfg.startingDiscount,
        increasePercent: cfg.increasePercent,
        decreasePercent: cfg.decreasePercent,
        minimumDiscount: cfg.minimumDiscount,
        maximumDiscount: cfg.maximumDiscount,
        evaluationIntervalHours: cfg.evaluationIntervalHours,
        badgeText: cfg.badgeText,
      };

      // Determine price from productData if present
      let rawPrice = 100;
      let effectiveVariantId = variantId;
      if (productData?.variants?.nodes?.[0]) {
        const v = productData.variants.nodes[0];
        effectiveVariantId = v.id || effectiveVariantId;
        rawPrice = Number(v.price) || 100;
      }

      const cleanVarId = String(effectiveVariantId || cleanId).replace(/^gid:\/\/shopify\/ProductVariant\//, "");
      const calculatedCurrentPrice = Number((rawPrice * (1 - cfg.startingDiscount / 100)).toFixed(2));

      // Upsert MarkdownRule for automation
      await MarkdownRule.findOneAndUpdate(
        { shop: cleanShop, productId: gid },
        {
          $set: {
            shop: cleanShop,
            productId: gid,
            variantId: `gid://shopify/ProductVariant/${cleanVarId}`,
            actionType: "PROGRESSIVE_MARKDOWN",
            originalPrice: rawPrice,
            currentPrice: calculatedCurrentPrice,
            startingDiscount: cfg.startingDiscount,
            increasePercent: cfg.increasePercent,
            incrementPercent: cfg.increasePercent,
            decreasePercent: cfg.decreasePercent,
            decrementPercent: cfg.decreasePercent,
            minimumDiscount: cfg.minimumDiscount,
            minDiscountPercent: cfg.minimumDiscount,
            maximumDiscount: cfg.maximumDiscount,
            maxDiscountPercent: cfg.maximumDiscount,
            evaluationIntervalHours: cfg.evaluationIntervalHours,
            intervalHours: cfg.evaluationIntervalHours,
            status: "ACTIVE",
            ruleStatus: "ACTIVE",
            active: true,
            currentDiscount: cfg.startingDiscount,
            lastEvaluatedAt: new Date(),
            nextEvaluationAt: new Date(Date.now() + (cfg.evaluationIntervalHours || 24) * 3600000),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      break;
    }

    case BADGES.CLEARANCE: {
      const cfg = settings.clearance;
      configurationSnapshot = {
        badgeType: BADGES.CLEARANCE,
        discountType: cfg.discountType || "PERCENTAGE",
        discountValue: cfg.discountValue,
        badgeText: cfg.badgeText,
        applyToStorefront: cfg.applyToStorefront,
      };
      break;
    }

    case BADGES.PRE_ORDER: {
      const cfg = settings.preorder;
      const defaultLaunch = cfg.launchDate ? new Date(cfg.launchDate) : new Date(Date.now() + 30 * 86400000);
      configurationSnapshot = {
        badgeType: BADGES.PRE_ORDER,
        depositPercentage: cfg.depositPercentage,
        launchDate: defaultLaunch,
        badgeText: cfg.badgeText,
        buttonText: cfg.buttonText,
      };

      // Upsert LaunchPreOrder configuration
      await LaunchPreOrder.findOneAndUpdate(
        { shop: cleanShop, productId: cleanId },
        {
          $set: {
            shop: cleanShop,
            productId: cleanId,
            productTitle: productData?.title || "",
            productHandle: productData?.handle || "",
            productImage: productData?.image || "",
            preOrderEnabled: true,
            launchDate: defaultLaunch,
            badgeText: cfg.badgeText || "🛒 PRE-ORDER",
            buttonText: cfg.buttonText || "PRE-ORDER NOW",
            launchLabel: cfg.launchLabel || "NEW LAUNCH",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      break;
    }

    case BADGES.LOW_STOCK: {
      const cfg = settings.lowStock;
      configurationSnapshot = {
        badgeType: BADGES.LOW_STOCK,
        threshold: cfg.threshold,
        badgeText: cfg.badgeText,
        backgroundColor: cfg.backgroundColor,
        textColor: cfg.textColor,
      };
      break;
    }

    case BADGES.BUNDLE: {
      const cfg = settings.bundle;
      configurationSnapshot = {
        badgeType: BADGES.BUNDLE,
        discountType: cfg.discountType || "PERCENTAGE",
        discountValue: cfg.discountValue,
        badgeText: cfg.badgeText,
        headerTitle: cfg.headerTitle,
        buttonText: cfg.buttonText,
      };
      break;
    }

    default:
      break;
  }

  // 4. Save centralized product-level badge assignment
  const assignment = await saveBadgeAssignment({
    shop: cleanShop,
    productId: gid,
    variantId,
    badgeType: normalizedBadge,
    score,
    confidence,
    reason,
    configurationSnapshot,
  });

  return {
    success: true,
    badge: normalizedBadge,
    assignment,
    configurationSnapshot,
    message: `${normalizedBadge} badge successfully applied with saved merchant defaults.`,
  };
}

/**
 * Bulk apply recommendations using saved merchant settings with partial-success tolerance
 */
async function bulkApplyRecommendations({
  shop,
  accessToken,
  items = [],
  productMap = {},
}) {
  const cleanShop = normalizeShop(shop);
  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: true,
      summary: { total: 0, applied: 0, skipped: 0, failed: 0 },
      results: [],
    };
  }

  // Load store settings once for the bulk run
  const settings = await getStoreBadgeSettings(cleanShop);

  const results = [];
  let appliedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const { productId, badge, score, confidence, reason } = item;
    const { gid } = normalizeProductId(productId);

    if (!productId || !badge) {
      skippedCount++;
      results.push({
        productId: gid,
        badge,
        status: "SKIPPED",
        reason: "Missing product ID or badge recommendation.",
      });
      continue;
    }

    const normalizedBadge = normalizeBadgeType(badge);
    if (normalizedBadge === BADGES.NONE) {
      skippedCount++;
      results.push({
        productId: gid,
        badge: BADGES.NONE,
        status: "SKIPPED",
        reason: "No badge recommendation.",
      });
      continue;
    }

    // Validate badge configuration
    const validation = validateBadgeConfig(settings, normalizedBadge);
    if (!validation.valid) {
      skippedCount++;
      results.push({
        productId: gid,
        badge: normalizedBadge,
        status: "SKIPPED",
        reason: validation.reason,
      });
      continue;
    }

    try {
      const pData = productMap[productId] || productMap[gid] || null;
      await applyProductRecommendation({
        shop: cleanShop,
        accessToken,
        productId: gid,
        badgeType: normalizedBadge,
        score: score || 0,
        confidence: confidence || "MEDIUM",
        reason: reason || "",
        productData: pData,
      });

      appliedCount++;
      results.push({
        productId: gid,
        badge: normalizedBadge,
        status: "APPLIED",
        success: true,
      });
    } catch (err) {
      failedCount++;
      results.push({
        productId: gid,
        badge: normalizedBadge,
        status: "FAILED",
        reason: err.message || "Failed to apply recommendation.",
      });
    }
  }

  return {
    success: true,
    summary: {
      total: items.length,
      applied: appliedCount,
      skipped: skippedCount,
      failed: failedCount,
    },
    results,
  };
}

module.exports = {
  VALID_BADGE_TYPES,
  normalizeBadgeType,
  applyProductRecommendation,
  bulkApplyRecommendations,
  removeBadgeAssignment,
};
