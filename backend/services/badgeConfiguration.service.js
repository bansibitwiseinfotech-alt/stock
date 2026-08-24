const StoreBadgeSettings = require("../models/StoreBadgeSettings");
const ClearanceSaleConfig = require("../models/ClearanceSaleConfig");
const BundleConfig = require("../models/BundleConfig");
const MarkdownConfig = require("../models/MarkdownConfig");
const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");
const PreOrderConfig = require("../models/PreOrderConfig");

/**
 * Default Store Badge Settings
 */
const DEFAULT_SETTINGS = {
  lowStock: {
    enabled: true,
    threshold: 5,
    badgeText: "🔥 Only {stock} left!",
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
    textColor: "#991B1B",
    subtextColor: "#B91C1C",
  },
  clearance: {
    enabled: true,
    discountType: "PERCENTAGE",
    discountValue: 20,
    badgeText: "🏷️ {discount}% OFF",
    applyToStorefront: true,
  },
  bundle: {
    enabled: true,
    discountType: "PERCENTAGE",
    discountValue: 15,
    badgeText: "📦 Bundle & Save {discount}%",
    headerTitle: "Frequently Bought Together",
    buttonText: "Add Both to Cart",
  },
  progressiveMarkdown: {
    enabled: true,
    startingDiscount: 10,
    increasePercent: 5,
    decreasePercent: 5,
    minimumDiscount: 5,
    maximumDiscount: 50,
    evaluationIntervalHours: 24,
    badgeText: "{discount}% OFF",
    badgeBackgroundColor: "#E53935",
    badgeTextColor: "#FFFFFF",
  },
  preorder: {
    enabled: true,
    depositPercentage: 50,
    launchDate: null,
    badgeText: "🛒 PRE-ORDER",
    buttonText: "PRE-ORDER NOW",
    launchLabel: "NEW LAUNCH",
    accentColor: "#4F46E5",
  },
};

/**
 * Normalize shop domain
 */
function normalizeShop(shop) {
  return String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/**
 * Retrieve or initialize store badge settings
 */
async function getStoreBadgeSettings(shop) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) throw new Error("Shop domain is required.");

  let settings = await StoreBadgeSettings.findOne({ shop: cleanShop }).lean();

  if (!settings) {
    // Attempt to seed from existing individual configs if present
    const [cConfig, bConfig, mConfig, lConfig, pConfig] = await Promise.all([
      ClearanceSaleConfig.findOne({ shop: cleanShop }).lean().catch(() => null),
      BundleConfig.findOne({ shop: cleanShop }).lean().catch(() => null),
      MarkdownConfig.findOne({ shop: cleanShop }).lean().catch(() => null),
      LowStockBadgeConfig.findOne({ shop: cleanShop }).lean().catch(() => null),
      PreOrderConfig.findOne({ shop: cleanShop }).lean().catch(() => null),
    ]);

    const initialData = {
      shop: cleanShop,
      lowStock: {
        ...DEFAULT_SETTINGS.lowStock,
        ...(lConfig ? { enabled: lConfig.enabled, threshold: lConfig.threshold, badgeText: lConfig.badgeText } : {}),
      },
      clearance: {
        ...DEFAULT_SETTINGS.clearance,
        ...(cConfig ? { enabled: cConfig.enabled, discountValue: cConfig.discountValue || 20 } : {}),
      },
      bundle: {
        ...DEFAULT_SETTINGS.bundle,
        ...(bConfig ? { enabled: bConfig.enabled, discountValue: bConfig.discountValue || 15 } : {}),
      },
      progressiveMarkdown: {
        ...DEFAULT_SETTINGS.progressiveMarkdown,
        ...(mConfig ? { enabled: mConfig.enabled, badgeText: mConfig.badgeText } : {}),
      },
      preorder: {
        ...DEFAULT_SETTINGS.preorder,
        ...(pConfig ? { enabled: pConfig.enabled } : {}),
      },
    };

    settings = await StoreBadgeSettings.findOneAndUpdate(
      { shop: cleanShop },
      { $setOnInsert: initialData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  return settings;
}

/**
 * Update store badge settings
 */
async function updateStoreBadgeSettings(shop, updates = {}) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) throw new Error("Shop domain is required.");

  const current = await getStoreBadgeSettings(cleanShop);

  const merged = {
    lowStock: { ...current.lowStock, ...(updates.lowStock || {}) },
    clearance: { ...current.clearance, ...(updates.clearance || {}) },
    bundle: { ...current.bundle, ...(updates.bundle || {}) },
    progressiveMarkdown: { ...current.progressiveMarkdown, ...(updates.progressiveMarkdown || {}) },
    preorder: { ...current.preorder, ...(updates.preorder || {}) },
  };

  const updated = await StoreBadgeSettings.findOneAndUpdate(
    { shop: cleanShop },
    { $set: merged },
    { new: true, upsert: true }
  ).lean();

  return updated;
}

/**
 * Validate configuration for a specific badge type
 */
function validateBadgeConfig(settings, badgeType) {
  const type = String(badgeType).toUpperCase();
  switch (type) {
    case "CLEARANCE": {
      const cfg = settings?.clearance;
      if (!cfg || cfg.discountValue == null || cfg.discountValue < 0) {
        return { valid: false, reason: "Clearance discount value is missing or invalid." };
      }
      return { valid: true };
    }
    case "BUNDLE": {
      const cfg = settings?.bundle;
      if (!cfg || cfg.discountValue == null || cfg.discountValue < 0) {
        return { valid: false, reason: "Bundle discount value is missing or invalid." };
      }
      return { valid: true };
    }
    case "PROGRESSIVE_MARKDOWN": {
      const cfg = settings?.progressiveMarkdown;
      if (!cfg || cfg.startingDiscount == null || cfg.startingDiscount <= 0) {
        return { valid: false, reason: "Progressive Markdown starting discount is missing or invalid." };
      }
      if (cfg.maximumDiscount == null || cfg.maximumDiscount < cfg.startingDiscount) {
        return { valid: false, reason: "Progressive Markdown maximum discount is invalid." };
      }
      return { valid: true };
    }
    case "PREORDER":
    case "PRE_ORDER": {
      const cfg = settings?.preorder;
      if (!cfg || cfg.depositPercentage == null || cfg.depositPercentage < 0 || cfg.depositPercentage > 100) {
        return { valid: false, reason: "Pre-order deposit percentage must be between 0% and 100%." };
      }
      return { valid: true };
    }
    case "LOW_STOCK": {
      const cfg = settings?.lowStock;
      if (!cfg || cfg.threshold == null || cfg.threshold < 1) {
        return { valid: false, reason: "Low stock threshold must be at least 1 unit." };
      }
      return { valid: true };
    }
    case "NONE":
      return { valid: true };
    default:
      return { valid: false, reason: `Unknown badge type: ${badgeType}` };
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  normalizeShop,
  getStoreBadgeSettings,
  updateStoreBadgeSettings,
  validateBadgeConfig,
};
