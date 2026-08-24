const ClearanceSaleConfig = require("../models/ClearanceSaleConfig");
const BundleConfig = require("../models/BundleConfig");
const MarkdownConfig = require("../models/MarkdownConfig");
const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");
const PreOrderConfig = require("../models/PreOrderConfig");
const LaunchPreOrder = require("../models/LaunchPreOrder");

/**
 * Loads all existing Smart Stock customization configs and active pre-order launch mappings
 * @param {string} shop
 */
async function loadCustomizationSettings(shop) {
  const normalizedShop = String(shop).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const [
    clearanceConfig,
    bundleConfig,
    markdownConfig,
    lowStockConfig,
    preOrderConfig,
    launchPreOrders,
  ] = await Promise.all([
    ClearanceSaleConfig.findOne({
      $or: [{ shopId: normalizedShop }, { shopId: new RegExp(`^${normalizedShop}$`, "i") }],
    }).lean(),
    BundleConfig.findOne({
      $or: [{ shop: normalizedShop }, { shop: new RegExp(`^${normalizedShop}$`, "i") }],
    }).lean(),
    MarkdownConfig.findOne({
      $or: [{ shop: normalizedShop }, { shop: new RegExp(`^${normalizedShop}$`, "i") }],
    }).lean(),
    LowStockBadgeConfig.findOne({
      $or: [{ shop: normalizedShop }, { shop: new RegExp(`^${normalizedShop}$`, "i") }],
    }).lean(),
    PreOrderConfig.findOne({
      $or: [{ shop: normalizedShop }, { shop: new RegExp(`^${normalizedShop}$`, "i") }],
    }).lean(),
    LaunchPreOrder.find({
      $or: [{ shop: normalizedShop }, { shop: new RegExp(`^${normalizedShop}$`, "i") }],
      preOrderEnabled: true,
    }).lean(),
  ]);

  const configuredPreOrderProductIds = new Set();
  if (Array.isArray(launchPreOrders)) {
    for (const l of launchPreOrders) {
      if (l.productId) {
        configuredPreOrderProductIds.add(String(l.productId));
        const numId = String(l.productId).replace(/^gid:\/\/shopify\/Product\//, "");
        configuredPreOrderProductIds.add(numId);
        configuredPreOrderProductIds.add(`gid://shopify/Product/${numId}`);
      }
    }
  }

  return {
    clearanceSale: {
      enabled: clearanceConfig ? clearanceConfig.enabled !== false : true,
      discountPercentage: clearanceConfig?.discountPercentage ?? 10,
    },
    bundleOffer: {
      enabled: bundleConfig ? bundleConfig.enabled !== false : true,
    },
    progressiveMarkdown: {
      enabled: markdownConfig ? markdownConfig.enabled !== false : true,
    },
    lowStockBadge: {
      enabled: lowStockConfig ? lowStockConfig.enabled !== false : true,
      threshold: lowStockConfig?.threshold ?? 5,
    },
    preOrder: {
      enabled: preOrderConfig ? preOrderConfig.enabled !== false : true,
      configuredProductIds: configuredPreOrderProductIds,
      launchPreOrdersList: launchPreOrders || [],
    },
  };
}

module.exports = {
  loadCustomizationSettings,
};
