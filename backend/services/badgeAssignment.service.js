const SmartBadgeAssignment = require("../models/SmartBadgeAssignment");
const SmartBadgeApplication = require("../models/SmartBadgeApplication");
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
 * Fetch map of active assignments for all products in a shop
 */
async function getAppliedBadgesMap(shop) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) return {};

  const assignments = await SmartBadgeAssignment.find({
    shop: cleanShop,
    status: "ACTIVE",
  }).lean();

  const map = {};
  for (const item of assignments) {
    const { rawId, cleanId, gid } = normalizeProductId(item.productId);
    const badgeType = item.badgeType;
    map[rawId] = badgeType;
    map[cleanId] = badgeType;
    map[gid] = badgeType;
  }

  // Also fallback to SmartBadgeApplication for existing data
  const legacyApps = await SmartBadgeApplication.find({
    shop: cleanShop,
    enabled: true,
  }).lean();

  for (const app of legacyApps) {
    const { rawId, cleanId, gid } = normalizeProductId(app.productId);
    if (!map[gid]) {
      map[rawId] = app.badgeType;
      map[cleanId] = app.badgeType;
      map[gid] = app.badgeType;
    }
  }

  return map;
}

/**
 * Get active assignment for a product
 */
async function getBadgeAssignment(shop, productId) {
  const cleanShop = normalizeShop(shop);
  const { cleanId, gid } = normalizeProductId(productId);

  const assignment = await SmartBadgeAssignment.findOne({
    shop: cleanShop,
    productId: { $in: [gid, cleanId] },
    status: "ACTIVE",
  }).lean();

  return assignment;
}

/**
 * Get total count of actively applied badges
 */
async function getActiveAssignmentsCount(shop) {
  const cleanShop = normalizeShop(shop);
  return await SmartBadgeAssignment.countDocuments({
    shop: cleanShop,
    status: "ACTIVE",
  });
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
