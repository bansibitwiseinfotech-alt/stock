const {
  getStoreBadgeSettings,
  updateStoreBadgeSettings,
  validateBadgeConfig,
  normalizeShop,
} = require("../services/badgeConfiguration.service");

/**
 * Helper to extract shop from request
 */
function resolveShop(req) {
  return (
    req.query.shop ||
    req.headers["x-shopify-shop-domain"] ||
    req.body?.shop ||
    req.shopId ||
    req.shop
  );
}

/**
 * GET /api/badge-settings
 */
async function getSettings(req, res) {
  try {
    const shop = resolveShop(req);
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: "SHOP_REQUIRED",
        message: "Shop domain is required.",
      });
    }

    const settings = await getStoreBadgeSettings(shop);

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("[BadgeSettings getSettings Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "FETCH_SETTINGS_FAILED",
      message: error.message || "Failed to load badge settings.",
    });
  }
}

/**
 * POST/PATCH /api/badge-settings
 */
async function updateSettings(req, res) {
  try {
    const shop = resolveShop(req);
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: "SHOP_REQUIRED",
        message: "Shop domain is required.",
      });
    }

    const payload = req.body || {};
    const updated = await updateStoreBadgeSettings(shop, payload);

    return res.json({
      success: true,
      data: updated,
      message: "Store badge configuration successfully saved.",
    });
  } catch (error) {
    console.error("[BadgeSettings updateSettings Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "UPDATE_SETTINGS_FAILED",
      message: error.message || "Failed to update badge settings.",
    });
  }
}

/**
 * GET /api/badge-settings/validate
 */
async function validateSettings(req, res) {
  try {
    const shop = resolveShop(req);
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: "SHOP_REQUIRED",
        message: "Shop domain is required.",
      });
    }

    const settings = await getStoreBadgeSettings(shop);
    const badgeType = req.query.badgeType || req.query.badge;

    if (!badgeType) {
      // Validate all badges
      const badges = ["LOW_STOCK", "CLEARANCE", "BUNDLE", "PROGRESSIVE_MARKDOWN", "PRE_ORDER"];
      const report = {};
      let allValid = true;

      for (const b of badges) {
        const v = validateBadgeConfig(settings, b);
        report[b] = v;
        if (!v.valid) allValid = false;
      }

      return res.json({
        success: true,
        valid: allValid,
        report,
        settings,
      });
    }

    const result = validateBadgeConfig(settings, badgeType);
    return res.json({
      success: true,
      ...result,
      settings,
    });
  } catch (error) {
    console.error("[BadgeSettings validateSettings Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "VALIDATE_SETTINGS_FAILED",
      message: error.message || "Failed to validate badge settings.",
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  validateSettings,
};
