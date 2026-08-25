const mongoose = require("mongoose");
const ClearanceSaleConfig = require("../models/ClearanceSaleConfig");
const connectDB = require("../config/mongodb");

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

const DEFAULT_CONFIG = {
  enabled: true,
  badgeTitle: "Clearance Sale",
  supportingText: "Limited time offer",
  limitedTimeText: "Limited time offer",
  discountPercentage: 10,
  showIcon: true,
  showSupportingText: true,
  showSavings: true,
  showPrice: true,
  layout: "horizontal",
  alignment: "left",
  backgroundColor: "#FFF1F2",
  textColor: "#991B1B",
  accentColor: "#DC2626",
  borderColor: "#FECACA",
  borderRadius: 8,
  paddingTop: 14,
  paddingBottom: 14,
  paddingLeft: 16,
  paddingRight: 16,
  fontFamily: "Arial",
  fontSize: "13px",
  fontWeight: "600",
};

function isValidHexColor(color) {
  if (typeof color !== "string") return false;
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color.trim());
}

function sanitizeConfig(input) {
  const sanitized = { ...DEFAULT_CONFIG };

  if (typeof input.enabled === "boolean") sanitized.enabled = input.enabled;

  if (typeof input.badgeTitle === "string" && input.badgeTitle.trim().length > 0) {
    sanitized.badgeTitle = input.badgeTitle.trim().slice(0, 100);
  }

  const normalizedLimitedText =
    typeof input.limitedTimeText === "string"
      ? input.limitedTimeText
      : typeof input.supportingText === "string"
        ? input.supportingText
        : DEFAULT_CONFIG.limitedTimeText;

  sanitized.limitedTimeText = normalizedLimitedText.trim().slice(0, 150);
  sanitized.supportingText = sanitized.limitedTimeText;

  const parsedDiscount = Number(input.discountPercentage ?? input.discount ?? input.saleDiscount ?? DEFAULT_CONFIG.discountPercentage);
  if (Number.isFinite(parsedDiscount)) {
    sanitized.discountPercentage = Math.min(100, Math.max(0, parsedDiscount));
  }

  if (typeof input.showIcon === "boolean") sanitized.showIcon = input.showIcon;
  if (typeof input.showSupportingText === "boolean") sanitized.showSupportingText = input.showSupportingText;
  if (typeof input.showSavings === "boolean") sanitized.showSavings = input.showSavings;
  if (typeof input.showPrice === "boolean") sanitized.showPrice = input.showPrice;

  if (["horizontal", "stacked"].includes(input.layout)) sanitized.layout = input.layout;
  if (["left", "center", "right"].includes(input.alignment)) sanitized.alignment = input.alignment;

  if (isValidHexColor(input.backgroundColor)) sanitized.backgroundColor = input.backgroundColor.trim();
  if (isValidHexColor(input.textColor)) sanitized.textColor = input.textColor.trim();
  if (isValidHexColor(input.accentColor)) sanitized.accentColor = input.accentColor.trim();
  if (isValidHexColor(input.borderColor)) sanitized.borderColor = input.borderColor.trim();

  const parseBoundedNum = (val, def, min = 0, max = 100) => {
    const num = Number(val);
    if (Number.isNaN(num)) return def;
    return Math.max(min, Math.min(max, Math.round(num)));
  };

  sanitized.borderRadius = parseBoundedNum(input.borderRadius, 8, 0, 50);
  sanitized.paddingTop = parseBoundedNum(input.paddingTop, 14, 0, 100);
  sanitized.paddingBottom = parseBoundedNum(input.paddingBottom, 14, 0, 100);
  sanitized.paddingLeft = parseBoundedNum(input.paddingLeft, 16, 0, 100);
  sanitized.paddingRight = parseBoundedNum(input.paddingRight, 16, 0, 100);

  // Typography validation
  if (typeof input.fontFamily === "string" && input.fontFamily.trim().length > 0) {
    sanitized.fontFamily = input.fontFamily.trim().slice(0, 50);
  }

  if (typeof input.fontSize === "string" && input.fontSize.trim().length > 0) {
    sanitized.fontSize = input.fontSize.trim().slice(0, 20);
  }

  if (typeof input.fontWeight === "string" && input.fontWeight.trim().length > 0) {
    sanitized.fontWeight = input.fontWeight.trim().slice(0, 20);
  }

  return sanitized;
}

async function getClearanceSaleConfig(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    let config = await ClearanceSaleConfig.findOne({ shopId }).lean().catch(() => null);
    if (!config) {
      config = await ClearanceSaleConfig.create({ shopId, ...DEFAULT_CONFIG })
        .then((doc) => doc.toObject())
        .catch(() => ({ shopId, ...DEFAULT_CONFIG }));
    }

    return res.status(200).json({
      success: true,
      data: {
        ...DEFAULT_CONFIG,
        ...config,
      },
    });
  } catch (error) {
    console.error("Get Clearance Config Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load clearance sale configuration.",
      data: DEFAULT_CONFIG,
    });
  }
}

async function updateClearanceSaleConfig(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const payload = req.body || {};
    const sanitized = sanitizeConfig(payload);

    const updated = await ClearanceSaleConfig.findOneAndUpdate(
      { shopId },
      { $set: sanitized },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Clearance Sale configuration saved successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Update Clearance Config Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save clearance sale configuration.",
    });
  }
}

async function resetClearanceSaleConfig(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const updated = await ClearanceSaleConfig.findOneAndUpdate(
      { shopId },
      { $set: DEFAULT_CONFIG },
      { upsert: true, new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Clearance Sale configuration reset to default values.",
      data: updated,
    });
  } catch (error) {
    console.error("Reset Clearance Config Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to reset clearance sale configuration.",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUNDLE CUSTOMIZATION (FREQUENTLY BOUGHT TOGETHER)
// ─────────────────────────────────────────────────────────────────────────────
const BundleConfig = require("../models/BundleConfig");

const DEFAULT_BUNDLE_CONFIG = {
  enabled: true,
  headerTitle: "Frequently Bought Together",
  buttonText: "Add Both to Cart",
  showDiscountBadge: true,
  badgeColor: "#DCFCE7",
  badgeTextColor: "#15803D",
  buttonColor: "#111827",
  buttonTextColor: "#FFFFFF",
  borderRadius: 12,
};

async function getBundleConfig(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.shopId || req.query.shop || req.body?.shop;
    if (!rawShop) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }
    const cleanShop = String(rawShop).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();

    const config = await BundleConfig.findOne({
      $or: [{ shop: cleanShop }, { shop: rawShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    }).lean();

    return res.status(200).json({
      success: true,
      data: config || { shop: cleanShop, ...DEFAULT_BUNDLE_CONFIG },
    });
  } catch (error) {
    console.error("Get Bundle Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch bundle configuration." });
  }
}

async function updateBundleConfig(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.shopId || req.query.shop || req.body?.shop;
    if (!rawShop) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }
    const cleanShop = String(rawShop).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();

    const payload = req.body || {};
    const updated = await BundleConfig.findOneAndUpdate(
      { $or: [{ shop: cleanShop }, { shop: rawShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }] },
      {
        $set: {
          shop: cleanShop,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
          headerTitle: payload.headerTitle || DEFAULT_BUNDLE_CONFIG.headerTitle,
          buttonText: payload.buttonText || DEFAULT_BUNDLE_CONFIG.buttonText,
          showDiscountBadge: typeof payload.showDiscountBadge === "boolean" ? payload.showDiscountBadge : true,
          badgeColor: payload.badgeColor || DEFAULT_BUNDLE_CONFIG.badgeColor,
          badgeTextColor: payload.badgeTextColor || DEFAULT_BUNDLE_CONFIG.badgeTextColor,
          buttonColor: payload.buttonColor || DEFAULT_BUNDLE_CONFIG.buttonColor,
          buttonTextColor: payload.buttonTextColor || DEFAULT_BUNDLE_CONFIG.buttonTextColor,
          borderRadius: Number(payload.borderRadius) || 12,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Bundle configuration saved successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Update Bundle Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save bundle configuration." });
  }
}

async function resetBundleConfig(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.shopId || req.query.shop || req.body?.shop;
    if (!rawShop) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }
    const cleanShop = String(rawShop).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();

    const updated = await BundleConfig.findOneAndUpdate(
      { $or: [{ shop: cleanShop }, { shop: rawShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }] },
      { $set: { shop: cleanShop, ...DEFAULT_BUNDLE_CONFIG } },
      { upsert: true, new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Bundle configuration reset to default values.",
      data: updated,
    });
  } catch (error) {
    console.error("Reset Bundle Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to reset bundle configuration." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSIVE MARKDOWN CUSTOMIZATION
// ─────────────────────────────────────────────────────────────────────────────
const MarkdownConfig = require("../models/MarkdownConfig");

const DEFAULT_MARKDOWN_CONFIG = {
  enabled: true,
  badgeText: "{discount}% OFF",
  showStrikethroughPrice: true,
  badgeBackgroundColor: "#E53935",
  badgeTextColor: "#FFFFFF",
  priceColor: "#111111",
  strikethroughColor: "#757575",
  borderRadius: 4,
};

async function getMarkdownConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const config = await MarkdownConfig.findOne({ shop: shopId }).lean();
    return res.status(200).json({
      success: true,
      data: config || { shop: shopId, ...DEFAULT_MARKDOWN_CONFIG },
    });
  } catch (error) {
    console.error("Get Markdown Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch markdown configuration." });
  }
}

async function updateMarkdownConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const payload = req.body || {};
    const updated = await MarkdownConfig.findOneAndUpdate(
      { shop: shopId },
      {
        $set: {
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
          badgeText: payload.badgeText || DEFAULT_MARKDOWN_CONFIG.badgeText,
          showStrikethroughPrice: typeof payload.showStrikethroughPrice === "boolean" ? payload.showStrikethroughPrice : true,
          badgeBackgroundColor: payload.badgeBackgroundColor || DEFAULT_MARKDOWN_CONFIG.badgeBackgroundColor,
          badgeTextColor: payload.badgeTextColor || DEFAULT_MARKDOWN_CONFIG.badgeTextColor,
          priceColor: payload.priceColor || DEFAULT_MARKDOWN_CONFIG.priceColor,
          strikethroughColor: payload.strikethroughColor || DEFAULT_MARKDOWN_CONFIG.strikethroughColor,
          borderRadius: Number(payload.borderRadius) || 4,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const MarkdownRule = require("../models/MarkdownRule");
    const { updateShopifyVariantPrice, calculateMarkdownPrice: calcPriceService } = require("../services/progressiveMarkdownService");
    const Store = require("../models/Store");

    const calculateMarkdownPrice = typeof calcPriceService === "function"
      ? calcPriceService
      : (orig, disc) => Math.max(0, Number((Number(orig || 0) * (1 - Number(disc || 0) / 100)).toFixed(2)));

    const store = await Store.findOne({
      $or: [{ shop: shopId }, { shop: String(shopId).replace(/^https?:\/\//i, "") }],
    }).lean();
    const accessToken = store?.accessToken;

    if (accessToken) {
      if (payload.enabled === true) {
        // Re-apply markdown discounted price on Shopify for rules
        const rules = await MarkdownRule.find({ shop: shopId }).lean();
        for (const rule of rules) {
          if (rule.originalPrice && rule.currentDiscount > 0) {
            const discountedPrice = calculateMarkdownPrice(rule.originalPrice, rule.currentDiscount);
            await updateShopifyVariantPrice({
              shop: shopId,
              accessToken,
              productId: rule.productId,
              variantId: rule.variantId,
              price: discountedPrice,
              compareAtPrice: rule.originalPrice,
            }).catch((err) => console.warn(`[MarkdownConfig] Failed to apply discount for rule ${rule._id}:`, err.message));

            await MarkdownRule.updateOne(
              { _id: rule._id },
              { $set: { active: true, currentPrice: discountedPrice } }
            );
          }
        }
      } else if (payload.enabled === false) {
        // Restore original prices and clear compareAtPrice on Shopify
        const rules = await MarkdownRule.find({ shop: shopId }).lean();
        for (const rule of rules) {
          if (rule.originalPrice) {
            await updateShopifyVariantPrice({
              shop: shopId,
              accessToken,
              productId: rule.productId,
              variantId: rule.variantId,
              price: rule.originalPrice,
              compareAtPrice: null,
            }).catch((err) => console.warn(`[MarkdownConfig] Failed to restore price for rule ${rule._id}:`, err.message));

            await MarkdownRule.updateOne(
              { _id: rule._id },
              { $set: { active: false, currentPrice: rule.originalPrice } }
            );
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Progressive Markdown configuration saved successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Update Markdown Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save markdown configuration." });
  }
}

async function resetMarkdownConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const updated = await MarkdownConfig.findOneAndUpdate(
      { shop: shopId },
      { $set: DEFAULT_MARKDOWN_CONFIG },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Progressive Markdown configuration reset to default values.",
      data: updated,
    });
  } catch (error) {
    console.error("Reset Markdown Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to reset markdown configuration." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW STOCK BADGE CUSTOMIZATION
// ─────────────────────────────────────────────────────────────────────────────
const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");

const DEFAULT_LOW_STOCK_CONFIG = {
  enabled: true,
  badgeText: "🔥 Only {stock} left in stock!",
  subtext: "Selling fast – high demand detected.",
  threshold: 5,
  showDaysRemaining: true,
  backgroundColor: "#FFF1F2",
  borderColor: "#FECDD3",
  textColor: "#991B1B",
  subtextColor: "#B91C1C",
  borderRadius: 8,
  pulseAnimation: true,
};

async function getLowStockConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const config = await LowStockBadgeConfig.findOne({ shop: shopId }).lean();
    return res.status(200).json({
      success: true,
      data: config || { shop: shopId, ...DEFAULT_LOW_STOCK_CONFIG },
    });
  } catch (error) {
    console.error("Get Low Stock Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch low stock badge configuration." });
  }
}

async function updateLowStockConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const payload = req.body || {};
    const updated = await LowStockBadgeConfig.findOneAndUpdate(
      { shop: shopId },
      {
        $set: {
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
          badgeText: payload.badgeText || DEFAULT_LOW_STOCK_CONFIG.badgeText,
          subtext: payload.subtext !== undefined ? payload.subtext : DEFAULT_LOW_STOCK_CONFIG.subtext,
          threshold: Number(payload.threshold) > 0 ? Number(payload.threshold) : DEFAULT_LOW_STOCK_CONFIG.threshold,
          showDaysRemaining: typeof payload.showDaysRemaining === "boolean" ? payload.showDaysRemaining : true,
          backgroundColor: payload.backgroundColor || DEFAULT_LOW_STOCK_CONFIG.backgroundColor,
          borderColor: payload.borderColor || DEFAULT_LOW_STOCK_CONFIG.borderColor,
          textColor: payload.textColor || DEFAULT_LOW_STOCK_CONFIG.textColor,
          subtextColor: payload.subtextColor || DEFAULT_LOW_STOCK_CONFIG.subtextColor,
          borderRadius: Number(payload.borderRadius) >= 0 ? Number(payload.borderRadius) : 8,
          pulseAnimation: typeof payload.pulseAnimation === "boolean" ? payload.pulseAnimation : true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Low Stock Badge configuration saved successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Update Low Stock Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save low stock badge configuration." });
  }
}

async function resetLowStockConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const updated = await LowStockBadgeConfig.findOneAndUpdate(
      { shop: shopId },
      { $set: DEFAULT_LOW_STOCK_CONFIG },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Low Stock Badge configuration reset to default values.",
      data: updated,
    });
  } catch (error) {
    console.error("Reset Low Stock Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to reset low stock badge configuration." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-ORDER CUSTOMIZATION (COLORS & STYLING)
// ─────────────────────────────────────────────────────────────────────────────
const PreOrderConfig = require("../models/PreOrderConfig");

const DEFAULT_PRE_ORDER_CONFIG = {
  enabled: true,
  buttonText: "PRE-ORDER NOW",
  badgeText: "🛒 PRE-ORDER",
  launchLabel: "NEW LAUNCH",
  cardBackgroundColor: "#FFFFFF",
  borderColor: "#E2E8F0",
  textColor: "#111827",
  accentColor: "#4F46E5",
  badgeBackgroundColor: "#0F172A",
  badgeTextColor: "#FFFFFF",
  borderRadius: 12,
};

async function getPreOrderCustomizationConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const config = await PreOrderConfig.findOne({ shop: shopId }).lean();
    return res.status(200).json({
      success: true,
      data: config || { shop: shopId, ...DEFAULT_PRE_ORDER_CONFIG },
    });
  } catch (error) {
    console.error("Get PreOrder Customization Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch pre-order customization configuration." });
  }
}

async function updatePreOrderCustomizationConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const payload = req.body || {};
    const updated = await PreOrderConfig.findOneAndUpdate(
      { shop: shopId },
      {
        $set: {
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
          buttonText: payload.buttonText || DEFAULT_PRE_ORDER_CONFIG.buttonText,
          badgeText: payload.badgeText || DEFAULT_PRE_ORDER_CONFIG.badgeText,
          launchLabel: payload.launchLabel || DEFAULT_PRE_ORDER_CONFIG.launchLabel,
          cardBackgroundColor: payload.cardBackgroundColor || DEFAULT_PRE_ORDER_CONFIG.cardBackgroundColor,
          borderColor: payload.borderColor || DEFAULT_PRE_ORDER_CONFIG.borderColor,
          textColor: payload.textColor || DEFAULT_PRE_ORDER_CONFIG.textColor,
          accentColor: payload.accentColor || DEFAULT_PRE_ORDER_CONFIG.accentColor,
          badgeBackgroundColor: payload.badgeBackgroundColor || DEFAULT_PRE_ORDER_CONFIG.badgeBackgroundColor,
          badgeTextColor: payload.badgeTextColor || DEFAULT_PRE_ORDER_CONFIG.badgeTextColor,
          borderRadius: Number(payload.borderRadius) >= 0 ? Number(payload.borderRadius) : 12,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Pre-Order styling configuration saved successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Update PreOrder Customization Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save pre-order customization configuration." });
  }
}

async function resetPreOrderCustomizationConfig(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const updated = await PreOrderConfig.findOneAndUpdate(
      { shop: shopId },
      { $set: DEFAULT_PRE_ORDER_CONFIG },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Pre-Order styling configuration reset to default values.",
      data: updated,
    });
  } catch (error) {
    console.error("Reset PreOrder Customization Config Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to reset pre-order customization configuration." });
  }
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_BUNDLE_CONFIG,
  DEFAULT_MARKDOWN_CONFIG,
  DEFAULT_LOW_STOCK_CONFIG,
  DEFAULT_PRE_ORDER_CONFIG,
  getClearanceSaleConfig,
  updateClearanceSaleConfig,
  resetClearanceSaleConfig,
  getBundleConfig,
  updateBundleConfig,
  resetBundleConfig,
  getMarkdownConfig,
  updateMarkdownConfig,
  resetMarkdownConfig,
  getLowStockConfig,
  updateLowStockConfig,
  resetLowStockConfig,
  getPreOrderCustomizationConfig,
  updatePreOrderCustomizationConfig,
  resetPreOrderCustomizationConfig,
};
