const mongoose = require("mongoose");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const Store = require("../models/Store");
const connectDB = require("../config/mongodb");
const shopifyGraphQL = require("../services/shopifyGraphql");

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

function normalizeVariantGid(variantId) {
  if (!variantId) return "";
  const value = String(variantId).trim();
  if (value.startsWith("gid://shopify/ProductVariant/")) {
    return value;
  }
  const cleanNum = value.replace(/\D/g, "");
  return `gid://shopify/ProductVariant/${cleanNum || value}`;
}

// ==================================================
// GET HIGH-DEMAND STOREFRONT STATUS
// GET /api/storefront/high-demand-status
// ==================================================

async function getHighDemandStorefrontStatus(req, res) {
  try {
    await ensureConnected();

    const shop = normalizeShop(
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      ""
    );

    const rawVariantId = req.query.variantId || req.query.variant_id || "";
    const variantId = normalizeVariantGid(rawVariantId);

    if (!shop || !variantId) {
      return res.status(200).json({
        success: true,
        data: {
          enabled: false,
          urgencyBadgeEnabled: false,
          preOrderEnabled: false,
          currentStock: 0,
        },
      });
    }

    // 1. Fetch Storefront Configuration
    const config = await HighDemandStorefront.findOne({
      shop,
      variantId,
    }).lean();

    // 2. Fetch Real-time Current Inventory from Shopify
    let currentStock = null;

    try {
      const store = await Store.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean();

      if (store?.accessToken) {
        const query = `
          query GetVariantStock($id: ID!) {
            node(id: $id) {
              ... on ProductVariant {
                id
                inventoryQuantity
              }
            }
          }
        `;
        const data = await shopifyGraphQL(shop, store.accessToken, query, { id: variantId });
        if (data?.node && data.node.inventoryQuantity !== undefined) {
          currentStock = Number(data.node.inventoryQuantity);
        }
      }
    } catch (stockErr) {
      console.warn("[HighDemandStorefront] Could not fetch real-time inventory:", stockErr.message);
    }

    const stock = currentStock !== null ? currentStock : 0;
    const isUrgencyConfigured = Boolean(config?.urgencyBadgeEnabled);
    const isPreOrderConfigured = Boolean(config?.preOrderEnabled);

    // Rule:
    // If stock <= 0: Urgency badge should NOT show; Pre-Order can show if enabled.
    // If stock > 0: Urgency badge shows if enabled; Pre-Order does not show.
    const showUrgencyBadge = isUrgencyConfigured && stock > 0;
    const showPreOrder = isPreOrderConfigured && stock <= 0;
    const isOverallEnabled = showUrgencyBadge || showPreOrder;

    const rawBadgeText = config?.badgeText || "Only {stock} left in stock!";
    const formattedBadgeText = rawBadgeText.replace("{stock}", String(stock));

    return res.status(200).json({
      success: true,
      data: {
        enabled: isOverallEnabled,
        urgencyBadgeEnabled: showUrgencyBadge,
        preOrderEnabled: showPreOrder,
        currentStock: stock,
        badgeText: formattedBadgeText,
        badgeColor: config?.badgeColor || "#991B1B",
        badgeBackgroundColor: config?.badgeBackgroundColor || "#FFF1F2",
        preOrderText: config?.preOrderText || "Pre-Order Now",
        variantId,
        shop,
      },
    });
  } catch (error) {
    console.error("Get High Demand Storefront Status Error:", error);
    return res.status(200).json({
      success: true,
      data: {
        enabled: false,
        urgencyBadgeEnabled: false,
        preOrderEnabled: false,
        currentStock: 0,
      },
    });
  }
}

module.exports = {
  getHighDemandStorefrontStatus,
};
