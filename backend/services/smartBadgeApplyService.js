const SmartBadgeApplication = require("../models/SmartBadgeApplication");
const { loadCustomizationSettings } = require("./smartBadgeCustomizationLoader");
const { BADGES } = require("./smartBadgeRecommendationService");

const VALID_BADGE_TYPES = [
  BADGES.CLEARANCE,
  BADGES.BUNDLE,
  BADGES.PROGRESSIVE_MARKDOWN,
  BADGES.LOW_STOCK,
  BADGES.PRE_ORDER,
];

function isBadgeModuleEnabled(badgeType, settings) {
  switch (badgeType) {
    case BADGES.CLEARANCE:
      return Boolean(settings?.clearanceSale?.enabled);
    case BADGES.BUNDLE:
      return Boolean(settings?.bundleOffer?.enabled);
    case BADGES.PROGRESSIVE_MARKDOWN:
      return Boolean(settings?.progressiveMarkdown?.enabled);
    case BADGES.LOW_STOCK:
      return Boolean(settings?.lowStockBadge?.enabled);
    case BADGES.PRE_ORDER:
      return Boolean(settings?.preOrder?.enabled);
    default:
      return false;
  }
}

/**
 * Apply a specific badge recommendation to a single product
 */
async function applyBadgeToProduct({ shop, accessToken, productId, badgeType }) {
  const normalizedShop = String(shop).trim().toLowerCase();
  const rawId = String(productId).trim();
  const cleanId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");
  const gid = `gid://shopify/Product/${cleanId}`;

  if (!VALID_BADGE_TYPES.includes(badgeType)) {
    throw new Error(`Invalid badge type: ${badgeType}`);
  }

  // Disable any existing badges for this product first (1 product -> 1 badge)
  await SmartBadgeApplication.updateMany(
    {
      shop: normalizedShop,
      productId: { $in: [rawId, cleanId, gid] },
    },
    {
      $set: { enabled: false },
    }
  );

  // Update or insert canonical product badge application
  const application = await SmartBadgeApplication.findOneAndUpdate(
    {
      shop: normalizedShop,
      productId: gid,
      badgeType,
    },
    {
      shop: normalizedShop,
      productId: gid,
      badgeType,
      enabled: true,
      appliedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    success: true,
    application,
    message: `${badgeType} badge successfully applied to product.`,
  };
}

/**
 * Disable a badge for a specific product without disabling the global module
 */
async function disableBadgeForProduct({ shop, productId, badgeType }) {
  const normalizedShop = String(shop).trim().toLowerCase();
  const rawId = String(productId).trim();
  const cleanId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");
  const gid = `gid://shopify/Product/${cleanId}`;

  const query = {
    shop: normalizedShop,
    productId: { $in: [rawId, cleanId, gid] },
  };
  if (badgeType) {
    query.badgeType = badgeType;
  }

  const result = await SmartBadgeApplication.updateMany(
    query,
    {
      $set: { enabled: false },
    }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount,
    message: `Badge disabled for product.`,
  };
}

/**
 * Bulk apply individual recommendations (each product gets its own badge)
 */
async function bulkApplyBadges({ shop, accessToken, items = [] }) {
  const normalizedShop = String(shop).trim().toLowerCase();
  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: true,
      applied: 0,
      failed: 0,
      results: [],
    };
  }

  const bulkOps = [];
  const results = [];
  let appliedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const { productId, badge } = item;
    if (!productId || !badge) {
      failedCount++;
      results.push({ productId, badge, success: false, reason: "Missing productId or badge" });
      continue;
    }

    if (!VALID_BADGE_TYPES.includes(badge)) {
      failedCount++;
      results.push({ productId, badge, success: false, reason: `Invalid badge type: ${badge}` });
      continue;
    }

    const rawId = String(productId).trim();
    const cleanId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");
    const gid = `gid://shopify/Product/${cleanId}`;

    // Disable any other badges for this product
    bulkOps.push({
      updateMany: {
        filter: {
          shop: normalizedShop,
          productId: { $in: [rawId, cleanId, gid] },
        },
        update: {
          $set: { enabled: false },
        },
      },
    });

    // Enable selected badge
    bulkOps.push({
      updateOne: {
        filter: {
          shop: normalizedShop,
          productId: gid,
          badgeType: badge,
        },
        update: {
          $set: {
            shop: normalizedShop,
            productId: gid,
            badgeType: badge,
            enabled: true,
            appliedAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    appliedCount++;
    results.push({ productId: gid, badge, success: true });
  }

  if (bulkOps.length > 0) {
    await SmartBadgeApplication.bulkWrite(bulkOps, { ordered: false });
  }

  return {
    success: true,
    applied: appliedCount,
    failed: failedCount,
    results,
  };
}

module.exports = {
  applyBadgeToProduct,
  disableBadgeForProduct,
  bulkApplyBadges,
  isBadgeModuleEnabled,
};
