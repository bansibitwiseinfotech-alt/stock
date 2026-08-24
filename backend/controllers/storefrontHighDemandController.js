const mongoose = require("mongoose");
const HighDemand = require("../models/highDemand");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const StockoutNotification = require("../models/StockoutNotification");
const Store = require("../models/Store");
const connectDB = require("../config/mongodb");
const shopifyGraphQL = require("../services/shopifyGraphql");
const {
  calculateSalesVelocity,
  calculateDaysUntilStockout,
  calculateRiskLevel,
  getShieldAction,
} = require("../services/highDemand.service");
const {
  processBackInStockNotifications,
} = require("../services/stockoutNotification.service");
const { sendConfirmationEmail } = require("../services/email.service");

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

function normalizeShop(shop) {
  if (!shop) return "";
  return String(shop)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function normalizeVariantId(value) {
  if (!value) return "";
  const match = String(value).match(/(\d+)$/);
  return match ? match[1] : String(value).trim();
}

function toVariantGid(id) {
  const clean = normalizeVariantId(id);
  return clean ? `gid://shopify/ProductVariant/${clean}` : "";
}

function parseBoolean(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  if (typeof val === "number") return val === 1;
  return false;
}

// ==================================================
// STOREFRONT HIGH DEMAND / STOCKOUT SHIELD WIDGET API
// GET /api/storefront/stockout-shield
// GET /api/storefront/high-demand
// ==================================================

async function getHighDemandStorefrontWidget(req, res) {
  try {
    await ensureConnected();

    const shop = normalizeShop(
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      ""
    );

    const rawVariantId =
      req.query.variantId ||
      req.query.variant_id ||
      req.query.id ||
      "";

    const cleanVariantId = normalizeVariantId(rawVariantId);
    const variantGid = toVariantGid(cleanVariantId);

    const rawProductId = req.query.productId || req.query.product_id || "";
    const cleanProductId = normalizeVariantId(rawProductId);

    if (!shop || !cleanVariantId) {
      return res.status(200).json({
        success: true,
        show: false,
        enabled: false,
        message: "Missing shop or variantId parameters",
      });
    }

    const shopQuery = {
      $or: [
        { shop },
        { shop: new RegExp(`^${shop}$`, "i") },
      ],
    };

    const variantQuery = {
      $or: [
        { variantId: variantGid },
        { variantId: cleanVariantId },
        { variantId: rawVariantId },
      ],
    };

    // 1. Fetch Storefront Configuration specifically for this variant
    let configDoc = await HighDemandStorefront.findOne({
      $and: [shopQuery, variantQuery],
    }).lean();

    // 2. Fetch existing HighDemand analysis record from MongoDB
    let highDemandDoc = await HighDemand.findOne({
      $and: [shopQuery, variantQuery],
    }).lean();

    // Fallback by productId if variant wasn't explicitly saved
    if (!configDoc && cleanProductId) {
      const productQuery = {
        $or: [
          { productId: cleanProductId },
          { productId: `gid://shopify/Product/${cleanProductId}` },
        ],
      };
      configDoc = await HighDemandStorefront.findOne({
        $and: [shopQuery, productQuery],
      }).lean();
    }

    // 3. Fetch live real-time inventory from Shopify Admin GraphQL
    let liveStock = null;
    let liveTitle = "";
    let liveVariantTitle = "";
    let liveProductId = "";

    try {
      const store = await Store.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean();

      if (store?.accessToken) {
        const query = `
          query GetVariantLiveStock($id: ID!) {
            node(id: $id) {
              ... on ProductVariant {
                id
                title
                inventoryQuantity
                product {
                  id
                  title
                }
              }
            }
          }
        `;
        const data = await shopifyGraphQL(shop, store.accessToken, query, { id: variantGid });
        const variantNode = data?.node;
        if (variantNode && variantNode.inventoryQuantity !== undefined) {
          liveStock = Number(variantNode.inventoryQuantity);
          liveVariantTitle = variantNode.title || "";
          liveTitle = variantNode.product?.title || "";
          liveProductId = variantNode.product?.id || "";
        }
      }
    } catch (shopifyErr) {
      console.warn("[StorefrontHighDemand] Shopify inventory check notice:", shopifyErr.message);
    }

    const Inventory = require("../models/Inventory");
    const invDoc = await Inventory.findOne({
      $or: [{ variantId: cleanVariantId }, { variantId: variantGid }],
    }).lean();

    // Priority: Live Shopify stock if query succeeded, otherwise highDemandDoc / local inventory
    let currentStock = 0;
    if (liveStock !== null && !isNaN(Number(liveStock))) {
      currentStock = Number(liveStock);
    } else if (highDemandDoc?.currentStock !== undefined && highDemandDoc?.currentStock !== null) {
      currentStock = Number(highDemandDoc.currentStock);
    } else {
      currentStock = Number(invDoc?.availableQuantity || 0);
    }

    const salesVelocity = Number(highDemandDoc?.salesVelocity || 0);
    const daysUntilStockout =
      highDemandDoc?.daysUntilStockout !== null && highDemandDoc?.daysUntilStockout !== undefined
        ? Number(highDemandDoc.daysUntilStockout)
        : currentStock <= 0                                
        ? 0
        : salesVelocity > 0      
        ? Number((currentStock / salesVelocity).toFixed(2))
        : null;       

    let riskLevel = highDemandDoc?.riskLevel;
    if (!riskLevel) {
      riskLevel = currentStock <= 0 ? "CRITICAL" : calculateRiskLevel(daysUntilStockout, currentStock, salesVelocity);
    }

    // Process back in stock if applicable
    if (currentStock > 0) {
      processBackInStockNotifications(shop, cleanVariantId, currentStock).catch(() => {});
    }

    // 4. Fetch Global Low Stock Badge Customization Config for Shop
    const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");
    const globalLowStockConfig = await LowStockBadgeConfig.findOne({
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
    }).lean().catch(() => null);

    const isGlobalLowStockEnabled = globalLowStockConfig ? Boolean(globalLowStockConfig.enabled) : true;

    // Config flags
    const threshold = Number(globalLowStockConfig?.threshold || configDoc?.lowStockBadge?.threshold || 5);
    const showDaysRemaining = globalLowStockConfig?.showDaysRemaining !== false && configDoc?.lowStockBadge?.showDaysRemaining !== false;
    
    const SmartBadgeApplication = require("../models/SmartBadgeApplication");
    const { getBadgeAssignment } = require("../services/badgeAssignment.service");

    const [smartBadgeLowStock, smartAssignment] = await Promise.all([
      SmartBadgeApplication.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
        productId: { $in: [rawProductId, cleanProductId, `gid://shopify/Product/${cleanProductId}`].filter(Boolean) },
        badgeType: "LOW_STOCK",
        enabled: true,
      }).lean().catch(() => null),
      cleanProductId
        ? getBadgeAssignment(shop, cleanProductId).catch(() => null)
        : null,
    ]);

    const isSmartAssignmentLowStock = smartAssignment && smartAssignment.status === "ACTIVE" && smartAssignment.badgeType === "LOW_STOCK";

    const isLowStockBadgeConfigured =
      Boolean(isSmartAssignmentLowStock) ||
      Boolean(smartBadgeLowStock) ||
      (isGlobalLowStockEnabled &&
        (parseBoolean(configDoc?.lowStockBadge?.enabled) ||
         parseBoolean(configDoc?.urgencyBadgeEnabled)));

    const isPreOrderConfigured =
      parseBoolean(configDoc?.preOrder?.enabled) ||
      parseBoolean(configDoc?.preOrderEnabled) ||
      parseBoolean(highDemandDoc?.preOrder?.enabled) ||
      parseBoolean(highDemandDoc?.preOrderEnabled);

    // Send all enabled controls so they can render line by line on the storefront
    const showLowStockBadge = isLowStockBadgeConfigured && currentStock <= threshold;
    const showPreOrder = false;
    const isOverallShown = showLowStockBadge;

    let badgeMessage = "";
    let badgeSubtext = "";

    if (showLowStockBadge) {
      const templateText = globalLowStockConfig?.badgeText || "🔥 Only {stock} left in stock!";
      badgeMessage = currentStock > 0
        ? templateText.replace(/\{stock\}/gi, String(currentStock))
        : `🔥 High Demand — Almost Sold Out!`;

      if (showDaysRemaining && typeof daysUntilStockout === "number" && daysUntilStockout > 0) {
        const daysText = daysUntilStockout <= 1 ? "estimated 1 day remaining." : `estimated ${Math.ceil(daysUntilStockout)} days remaining.`;
        badgeSubtext = `Selling fast — ${daysText}`;
      } else {
        badgeSubtext = globalLowStockConfig?.subtext !== undefined
          ? globalLowStockConfig.subtext
          : "Selling fast – high demand detected.";
      }
    }

    const preOrderButtonText = "";

    let widgetMessage = "";
    if (showLowStockBadge) {
      widgetMessage = badgeMessage;
    } else if (currentStock <= 0) {
      widgetMessage = "Product is out of stock.";
    }

    return res.status(200).json({
      success: true,
      show: isOverallShown,
      enabled: isOverallShown,
      productId: normalizeVariantId(liveProductId || configDoc?.productId || highDemandDoc?.productId || cleanProductId),
      variantId: cleanVariantId,
      productTitle: liveTitle || highDemandDoc?.productName || "",
      variantTitle: liveVariantTitle || highDemandDoc?.variantTitle || "",
      stock: currentStock,
      daysUntilStockout,
      salesVelocity,
      riskLevel,
      lowStockBadge: {
        enabled: isLowStockBadgeConfigured,
        show: showLowStockBadge,
        threshold,
        showDaysRemaining,
        message: badgeMessage,
        subtext: badgeSubtext,
        backgroundColor: globalLowStockConfig?.backgroundColor || configDoc?.badgeBackgroundColor || "#FFF1F2",
        borderColor: globalLowStockConfig?.borderColor || "#FECDD3",
        textColor: globalLowStockConfig?.textColor || configDoc?.badgeColor || "#991B1B",
        subtextColor: globalLowStockConfig?.subtextColor || "#B91C1C",
        borderRadius: globalLowStockConfig?.borderRadius ?? 8,
        pulseAnimation: globalLowStockConfig?.pulseAnimation !== false,
      },
      preOrder: {
        enabled: isPreOrderConfigured,
        show: showPreOrder,
        buttonText: preOrderButtonText,
      },
      widget: {
        title: "Stockout Shield",
        icon: "🛡️",
        showBadge: showLowStockBadge,
        message: widgetMessage,
        subtext: badgeSubtext,
        showPreOrder,
        buttonText: showPreOrder ? preOrderButtonText : "",
        riskLevel,
        isOutOfStock: currentStock <= 0,
        currentStock,
        daysUntilStockout,
      },
      message: widgetMessage,
    });
  } catch (error) {
    console.error("Storefront High Demand Widget Error:", error);
    return res.status(200).json({
      success: true,
      show: false,
      enabled: false,
      error: error.message,
    });
  }
}

// ==================================================
// STOREFRONT STOCKOUT NOTIFY ME SUBSCRIPTION API
// POST /api/storefront/stockout-notify
// ==================================================

async function subscribeStockoutNotification(req, res) {
  try {
    await ensureConnected();

    const rawShop =
      req.body.shop ||
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      "";

    const shop = normalizeShop(rawShop);
    const rawVariantId = req.body.variantId || req.body.variant_id || req.body.id || "";
    const cleanVariantId = normalizeVariantId(rawVariantId);
    const rawProductId = req.body.productId || req.body.product_id || "";
    const cleanProductId = normalizeVariantId(rawProductId);
    const email = String(req.body.email || "").trim().toLowerCase();
    const productTitle = String(req.body.productTitle || req.body.product_title || "").trim();
    const variantTitle = String(req.body.variantTitle || req.body.variant_title || "").trim();
    const productHandle = String(req.body.productHandle || req.body.product_handle || "").trim();

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required.",
      });
    }

    if (!cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "Variant ID is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const filterQuery = {
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      $and: [
        {
          $or: [
            { variantId: cleanVariantId },
            { variantId: `gid://shopify/ProductVariant/${cleanVariantId}` },
          ],
        },
        { email },
      ],
    };

    const existing = await StockoutNotification.findOne(filterQuery);

    if (existing) {
      if (existing.status === "NOTIFIED" || existing.status === "CANCELLED") {
        existing.status = "PENDING";
        existing.notifiedAt = null;
        if (productTitle) existing.productTitle = productTitle;
        if (variantTitle) existing.variantTitle = variantTitle;
        if (productHandle) existing.productHandle = productHandle;
        if (cleanProductId) existing.productId = cleanProductId;
        await existing.save();

        sendConfirmationEmail({
          to: email,
          shop,
          productTitle: existing.productTitle || productTitle,
          variantTitle: existing.variantTitle || variantTitle,
          productHandle: existing.productHandle || productHandle,
          variantId: cleanVariantId,
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          status: "subscribed",
          message: "✓ You're on the list! We'll notify you when this product is back in stock.",
        });
      }

      return res.status(200).json({
        success: true,
        duplicate: true,
        status: "already_subscribed",
        message: "You're already on the notification list for this product.",
      });
    }

    const newDoc = await StockoutNotification.create({
      shop,
      productId: cleanProductId,
      variantId: cleanVariantId,
      email,
      productHandle,
      productTitle,
      variantTitle,
      status: "PENDING",
    });

    sendConfirmationEmail({
      to: email,
      shop,
      productTitle,
      variantTitle,
      productHandle,
      variantId: cleanVariantId,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      status: "subscribed",
      message: "✓ You're on the list! We'll email you when this product is back in stock.",
      data: {
        id: newDoc._id,
        email: newDoc.email,
        variantId: newDoc.variantId,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        status: "already_subscribed",
        message: "You're already on the notification list for this product.",
      });
    }
    console.error("Stockout Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process notification request. Please try again.",
      error: error.message,
    });
  }
}

module.exports = {
  getHighDemandStorefrontWidget,
  getStockoutShieldStorefront: getHighDemandStorefrontWidget,
  subscribeStockoutNotification,
};


