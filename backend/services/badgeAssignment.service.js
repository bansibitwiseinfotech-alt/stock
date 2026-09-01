const SmartBadgeAssignment = require("../models/SmartBadgeAssignment");
const SmartBadgeApplication = require("../models/SmartBadgeApplication");
const LaunchPreOrder = require("../models/LaunchPreOrder");
const Bundle = require("../models/Bundle");
const ClearanceSale = require("../models/ClearanceSale");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const { normalizeShop } = require("./badgeConfiguration.service");

/**
 * Format standard GID and clean ID
 */
function normalizeProductId(productId) {
  const rawId = String(productId || "").trim();
  const cleanId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");
  const gid = `gid://shopify/Product/${cleanId}`;
  return { rawId, cleanId, gid };
}

/**
 * Fetch map of active assignments for all products in a shop across all active feature sources
 */
async function getAppliedBadgesMap(shop) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) return {};

  const map = {};

  // 1. Explicit SmartBadgeAssignments (Lowest priority fallback)
  try {
    const assignments = await SmartBadgeAssignment.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      status: "ACTIVE",
    }).lean();

    for (const item of assignments) {
      if (item.productId) {
        const { rawId, cleanId, gid } = normalizeProductId(item.productId);
        map[rawId] = item.badgeType;
        map[cleanId] = item.badgeType;
        map[gid] = item.badgeType;
      }
    }
  } catch (_) {}

  // 2. Real Storefront Pre-Orders (LaunchPreOrder)
  try {
    const launchPreOrders = await LaunchPreOrder.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      preOrderEnabled: true,
      status: { $nin: ["CANCELLED", "DISABLED"] },
    }).lean();

    for (const lpo of launchPreOrders) {
      const idsToMap = [lpo.productId, lpo.variantId].filter(Boolean);
      for (const id of idsToMap) {
        const { rawId, cleanId, gid } = normalizeProductId(id);
        map[rawId] = "PRE_ORDER";
        map[cleanId] = "PRE_ORDER";
        map[gid] = "PRE_ORDER";
      }
    }
  } catch (_) {}

  // 3. Active Bundles (High priority — includes deadStockProductId & companionProductId)
  try {
    const activeBundles = await Bundle.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      status: "ACTIVE",
    }).lean();

    for (const b of activeBundles) {
      const idsToMap = [
        b.deadStockProductId,
        b.deadStockVariantId,
        b.companionProductId,
        b.companionVariantId,
        b.shopifyProductId,
        b.buyProductId,
      ].filter(Boolean);

      for (const id of idsToMap) {
        const { rawId, cleanId, gid } = normalizeProductId(id);
        map[rawId] = "BUNDLE";
        map[cleanId] = "BUNDLE";
        map[gid] = "BUNDLE";
      }
    }
  } catch (_) {}

  // 4. Active Clearance Sales
  try {
    const now = new Date();
    const activeClearances = await ClearanceSale.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      $or: [{ status: "ACTIVE" }, { active: true }],
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }] },
      ],
    }).lean();

    for (const c of activeClearances) {
      const idsToMap = [c.productId, c.variantId].filter(Boolean);
      for (const id of idsToMap) {
        const { rawId, cleanId, gid } = normalizeProductId(id);
        map[rawId] = "CLEARANCE";
        map[cleanId] = "CLEARANCE";
        map[gid] = "CLEARANCE";
      }
    }
  } catch (_) {}

  // 5. Active Progressive Markdown Rules
  try {
    const MarkdownRule = require("../models/MarkdownRule");
    const activeMarkdowns = await MarkdownRule.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      $or: [{ status: "ACTIVE" }, { active: true }],
    }).lean();

    for (const m of activeMarkdowns) {
      const idsToMap = [m.productId, m.variantId, m.deadStockProductId, m.deadStockVariantId].filter(Boolean);
      for (const id of idsToMap) {
        const { rawId, cleanId, gid } = normalizeProductId(id);
        map[rawId] = "PROGRESSIVE_MARKDOWN";
        map[cleanId] = "PROGRESSIVE_MARKDOWN";
        map[gid] = "PROGRESSIVE_MARKDOWN";
      }
    }
  } catch (_) {}

  // 6. Active HighDemandStorefront Urgency/Low Stock badges
  try {
    const hdsRecords = await HighDemandStorefront.find({
      $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      $or: [
        { "lowStockBadge.enabled": true },
        { urgencyBadgeEnabled: true },
      ],
    }).lean();

    for (const hds of hdsRecords) {
      const idsToMap = [hds.productId, hds.variantId].filter(Boolean);
      for (const id of idsToMap) {
        const { rawId, cleanId, gid } = normalizeProductId(id);
        map[rawId] = "LOW_STOCK";
        map[cleanId] = "LOW_STOCK";
        map[gid] = "LOW_STOCK";
      }
    }
  } catch (_) {}

  return map;
}

/**
 * Get active assignment for a product
 */
async function getBadgeAssignment(shop, productId) {
  const cleanShop = normalizeShop(shop);
  const { cleanId, gid } = normalizeProductId(productId);

  const assignment = await SmartBadgeAssignment.findOne({
    $or: [{ shop: cleanShop }, { shopId: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    productId: { $in: [gid, cleanId] },
    status: "ACTIVE",
  }).lean();

  if (assignment) return assignment;

  // Check fallback from full map
  const map = await getAppliedBadgesMap(cleanShop);
  const badgeType = map[gid] || map[cleanId];
  if (badgeType) {
    return {
      shop: cleanShop,
      productId: gid,
      badgeType,
      status: "ACTIVE",
      appliedAt: new Date(),
    };
  }

  return null;
}

/**
 * Get total count of actively applied badges across all features
 */
async function getActiveAssignmentsCount(shop) {
  const map = await getAppliedBadgesMap(shop);
  const uniqueProductGids = new Set(
    Object.keys(map).filter((k) => k.startsWith("gid://shopify/Product/"))
  );
  return uniqueProductGids.size;
}

/**
 * Save / update product badge assignment with snapshot
 */
async function saveBadgeAssignment({
  shop,
  productId,
  variantId = null,
  badgeType,
  score = 0,
  confidence = "MEDIUM",
  reason = "",
  configurationSnapshot = {},
}) {
  const cleanShop = normalizeShop(shop);
  const { gid } = normalizeProductId(productId);

  // 1. Update SmartBadgeAssignment (with snapshot)
  const assignment = await SmartBadgeAssignment.findOneAndUpdate(
    { shop: cleanShop, productId: gid },
    {
      $set: {
        shop: cleanShop,
        productId: gid,
        variantId,
        badgeType,
        recommendationScore: score,
        confidence,
        recommendationReason: reason,
        configurationSnapshot,
        appliedAt: new Date(),
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 2. Keep SmartBadgeApplication in sync for backward compatibility
  await SmartBadgeApplication.updateMany(
    { shop: cleanShop, productId: gid },
    { $set: { enabled: false } }
  );

  await SmartBadgeApplication.findOneAndUpdate(
    { shop: cleanShop, productId: gid, badgeType },
    {
      $set: {
        shop: cleanShop,
        productId: gid,
        badgeType,
        enabled: true,
        appliedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return assignment;
}

/**
 * Remove / disable badge assignment for a product
 */
async function removeBadgeAssignment(shop, productId) {
  const cleanShop = normalizeShop(shop);
  const { rawId, cleanId, gid } = normalizeProductId(productId);

  await SmartBadgeAssignment.updateMany(
    {
      shop: cleanShop,
      productId: { $in: [rawId, cleanId, gid] },
    },
    {
      $set: { status: "REMOVED" },
    }
  );

  await SmartBadgeApplication.updateMany(
    {
      shop: cleanShop,
      productId: { $in: [rawId, cleanId, gid] },
    },
    {
      $set: { enabled: false },
    }
  );

  return { success: true, message: "Badge removed from product." };
}

module.exports = {
  normalizeProductId,
  getAppliedBadgesMap,
  getBadgeAssignment,
  getActiveAssignmentsCount,
  saveBadgeAssignment,
  removeBadgeAssignment,
};
