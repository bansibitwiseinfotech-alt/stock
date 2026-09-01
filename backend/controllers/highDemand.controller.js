const mongoose = require("mongoose");
const HighDemand = require("../models/highDemand");
const Store = require("../models/Store");
const connectDB = require("../config/mongodb");
const {
  calculateSalesVelocity,
  calculateDaysUntilStockout,
  calculateRiskLevel,
  calculateReorderQuantity,
  getShieldAction,
} = require("../services/highDemand.service");
const {
  fetchHighDemandProducts,
  fetchLast30DaysSalesMap,
} = require("../services/shopifyHighDemand.service");
const shopifyGraphQL = require("../services/shopifyGraphql");
const {
  incrementFeatureUsage,
  getOrCreateSubscription,
} = require("../middleware/checkPlanLimit");
const PLAN_LIMITS = require("../config/planLimits");

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

async function persistStoreToken(shopId, accessToken) {
  if (!shopId || !accessToken) return;
  try {
    const cleanShop = normalizeShop(shopId);
    await Store.findOneAndUpdate(
      { $or: [{ shop: shopId }, { shop: cleanShop }] },
      { $set: { shop: cleanShop, accessToken, active: true } },
      { upsert: true }
    );
  } catch (error) {
    console.warn("Unable to persist store token in background:", error.message);
  }
}

async function getStoreAccessToken(shop, req) {
  const headerToken = req?.headers?.["x-shopify-access-token"];
  if (headerToken) {
    await persistStoreToken(shop, headerToken);
    return { accessToken: headerToken, store: { shop, accessToken: headerToken } };
  }

  const cleanShop = normalizeShop(shop);
  const store = await Store.findOne({
    $or: [
      { shop: shop },
      { shop: cleanShop },
      { shop: new RegExp(`^${cleanShop}$`, "i") },
    ],
  }).lean();

  return { accessToken: store?.accessToken || null, store };
}

// ==================================================
// HIGH DEMAND ANALYSIS
// GET /api/high-demand?shop=...
// ==================================================

async function analyzeHighDemand(req, res) {
  try {
    await ensureConnected();

    const shop = String(
      req.query.shop ||
      req.body?.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      ""
    )
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const { accessToken, store } = await getStoreAccessToken(shop, req);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Shopify authentication failed. Please reconnect the store.",
      });
    }

    const cleanShop = normalizeShop(shop);

    // Parallel fetch direct live GraphQL API data & Storefront settings
    const HighDemandStorefront = require("../models/HighDemandStorefront");
    const [rawProductsData, salesMap, hdsList, subscription] = await Promise.all([
      fetchHighDemandProducts(shop, accessToken).catch((e) => {
        console.error("fetchHighDemandProducts error:", e.message);
        return { products: [] };
      }),
      fetchLast30DaysSalesMap(shop, accessToken).catch(() => new Map()),
      HighDemandStorefront.find({
        $or: [{ shop }, { shop: cleanShop }],
      }).lean().catch(() => []),
      getOrCreateSubscription(shop).catch(() => null),
    ]);

    const hdsMap = {};
    for (const hds of hdsList || []) {
      if (hds.variantId) hdsMap[hds.variantId] = hds;
    }

    const currentPlan = subscription?.plan || "free";
    const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    const productLimit = typeof planLimits.products === "number" ? planLimits.products : Infinity;

    const rawProducts = rawProductsData?.products || [];

    // Fallback to MongoDB if GraphQL returns empty (e.g. rate limit)
    let productsToAnalyze = rawProducts;
    if (productsToAnalyze.length === 0) {
      const cached = await HighDemand.find({
        $or: [{ shop }, { shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      }).lean().catch(() => []);

      productsToAnalyze = cached.map((c) => ({
        productId: c.productId,
        variantId: c.variantId,
        productName: c.productName,
        variantTitle: c.variantTitle,
        currentStock: c.currentStock,
        sku: c.sku,
        image: c.image,
      }));
    }

    const products = productsToAnalyze.slice(0, productLimit);
    const results = [];
    const bulkOps = [];

    for (const product of products) {
      const cleanVariantId = String(product.variantId || "").replace(/\D/g, "");
      const last30DaysSales = Number(
        salesMap.get(product.variantId) ||
        (cleanVariantId ? salesMap.get(cleanVariantId) : 0) ||
        0
      );

      const salesVelocity = calculateSalesVelocity(last30DaysSales);
      const daysUntilStockout = calculateDaysUntilStockout(product.currentStock, salesVelocity);
      const riskLevel = calculateRiskLevel(daysUntilStockout, product.currentStock, salesVelocity);

      const targetCoverageDays = 30;
      const reorderQuantity = calculateReorderQuantity(
        product.currentStock,
        salesVelocity,
        targetCoverageDays
      );

      const shieldAction = getShieldAction({
        currentStock: product.currentStock,
        salesVelocity,
        daysUntilStockout,
        riskLevel,
        reorderQuantity,
      });

      const hds = hdsMap[product.variantId] || {};

      const item = {
        productId: product.productId,
        variantId: product.variantId,
        productName: product.productName,
        variantTitle: product.variantTitle,
        sku: product.sku || "",
        image: product.image || "",
        currentStock: product.currentStock,
        last30DaysSales,
        salesVelocity,
        daysUntilStockout,
        daysLeftToStockout: daysUntilStockout,
        riskLevel,
        recommendedAction: shieldAction.recommendedAction,
        actionLabel: shieldAction.actionLabel,
        actionPriority: shieldAction.actionPriority,
        actionMessage: shieldAction.actionMessage,
        reorderQuantity,
        targetCoverageDays,
        urgencyBadgeEnabled: Boolean(hds.urgencyBadgeEnabled || hds.lowStockBadge?.enabled),
        preOrderEnabled: Boolean(hds.preOrderEnabled),
        notifyMeEnabled: Boolean(hds.notifyMeEnabled),
        monitorEnabled: Boolean(hds.monitorEnabled !== false),
      };

      results.push(item);

      bulkOps.push({
        updateOne: {
          filter: { shop: cleanShop, variantId: product.variantId },
          update: {
            $set: {
              shop: cleanShop,
              productId: product.productId,
              productName: product.productName,
              variantTitle: product.variantTitle,
              sku: product.sku || "",
              image: product.image || "",
              currentStock: product.currentStock,
              last30DaysSales,
              salesVelocity,
              daysUntilStockout,
              riskLevel,
              recommendedAction: shieldAction.recommendedAction,
              actionLabel: shieldAction.actionLabel,
              actionPriority: shieldAction.actionPriority,
              actionMessage: shieldAction.actionMessage,
              reorderQuantity,
              targetCoverageDays,
              analyzedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    // Non-blocking background sync to MongoDB
    if (bulkOps.length > 0) {
      HighDemand.bulkWrite(bulkOps, { ordered: false }).catch((e) =>
        console.warn("HighDemand bulkWrite notice:", e.message)
      );
    }

    return res.status(200).json({
      success: true,
      shop: cleanShop,
      analyzedCount: results.length,
      count: results.length,
      products: results,
    });
  } catch (error) {
    console.error("High Demand Analysis Error:", error);
    const isAuthError =
      error.response?.status === 401 ||
      (error.message && error.message.includes("401")) ||
      (error.message && error.message.toLowerCase().includes("invalid api key or access token"));

    const status = isAuthError ? 401 : (error.response?.status || 500);

    return res.status(status).json({
      success: false,
      message: isAuthError
        ? "Shopify authentication failed. Please reconnect the store."
        : "Failed to analyze high-demand products",
      error: error.message,
    });
  }
}

// ==================================================
// VARIANT DETAIL API
// GET /api/high-demand/variant/:variantId?shop=...
// ==================================================

async function getHighDemandVariantDetail(req, res) {
  try {
    await ensureConnected();
    const rawVariantId = String(req.params.variantId || "");
    const shop = String(
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      ""
    )
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const cleanNumericId = rawVariantId.replace("gid://shopify/ProductVariant/", "").replace(/\D/g, "");
    const canonicalGid = rawVariantId.startsWith("gid://shopify/ProductVariant/")
      ? rawVariantId
      : `gid://shopify/ProductVariant/${cleanNumericId}`;

    let item = await HighDemand.findOne({
      shop,
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { variantId: rawVariantId },
      ],
    }).lean();

    if (!item) {
      // Query Shopify directly if not found in MongoDB
      try {
        const { accessToken } = await getStoreAccessToken(shop, req);
        if (accessToken) {
          const query = `
            query GetVariant($id: ID!) {
              node(id: $id) {
                ... on ProductVariant {
                  id
                  title
                  sku
                  inventoryQuantity
                  image { url }
                  product {
                    id
                    title
                    featuredImage { url }
                  }
                }
              }
            }
          `;
          const data = await shopifyGraphQL(shop, accessToken, query, { id: canonicalGid });
          const variantNode = data?.node;
          if (variantNode) {
            const salesVelocity = 0;
            const daysUntilStockout = calculateDaysUntilStockout(variantNode.inventoryQuantity || 0, salesVelocity);
            const riskLevel = calculateRiskLevel(daysUntilStockout, variantNode.inventoryQuantity || 0, salesVelocity);
            const shieldAction = getShieldAction({
              currentStock: variantNode.inventoryQuantity || 0,
              salesVelocity,
              daysUntilStockout,
              riskLevel,
            });

            item = {
              shop,
              productId: variantNode.product?.id || "",
              variantId: variantNode.id,
              productName: variantNode.product?.title || "",
              variantTitle: variantNode.title || "",
              sku: variantNode.sku || "",
              image: variantNode.image?.url || variantNode.product?.featuredImage?.url || "",
              currentStock: Number(variantNode.inventoryQuantity) || 0,
              last30DaysSales: 0,
              salesVelocity: 0,
              daysUntilStockout,
              riskLevel,
              reorderQuantity: 0,
              targetCoverageDays: 30,
              recommendedAction: shieldAction.recommendedAction,
              actionLabel: shieldAction.actionLabel,
              actionPriority: shieldAction.actionPriority,
              actionMessage: shieldAction.actionMessage,
              urgencyBadgeEnabled: false,
              preOrderEnabled: false,
            };
          }
        }
      } catch (shopifyErr) {
        console.warn("Direct Shopify variant lookup notice:", shopifyErr.message);
      }
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    const storefrontDoc = await HighDemandStorefront.findOne({
      shop,
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { variantId: rawVariantId },
      ],
    }).lean();

    const lowStockBadgeEnabled = Boolean(
      storefrontDoc?.lowStockBadge?.enabled ??
        storefrontDoc?.urgencyBadgeEnabled ??
        item.urgencyBadgeEnabled
    );
    const preOrderEnabled = Boolean(
      storefrontDoc?.preOrder?.enabled ??
        storefrontDoc?.preOrderEnabled ??
        item.preOrderEnabled
    );
    const notifyMeEnabled = Boolean(
      storefrontDoc?.notifyMe?.enabled ??
        storefrontDoc?.notifyMeEnabled ??
        true
    );
    const monitorEnabled = Boolean(
      storefrontDoc?.monitor?.enabled ?? false
    );

    const enrichedItem = {
      ...item,
      urgencyBadgeEnabled: lowStockBadgeEnabled,
      lowStockBadge: {
        enabled: lowStockBadgeEnabled,
        threshold:
          storefrontDoc?.lowStockBadge?.threshold ?? 5,
        showDaysRemaining:
          storefrontDoc?.lowStockBadge?.showDaysRemaining ??
          true,
      },
      preOrderEnabled: preOrderEnabled,
      preOrder: {
        enabled: preOrderEnabled,
        buttonText:
          storefrontDoc?.preOrder?.buttonText ||
          "🛒 Pre-Order Now",
      },
      notifyMeEnabled: notifyMeEnabled,
      notifyMe: {
        enabled: notifyMeEnabled,
        buttonText:
          storefrontDoc?.notifyMe?.buttonText ||
          "🔔 Notify Me",
      },
      monitor: {
        enabled: monitorEnabled,
      },
    };

    return res.status(200).json({
      success: true,
      data: enrichedItem,
    });
  } catch (error) {
    console.error("Get Variant Detail Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant detail",
      error: error.message,
    });
  }
}

const HighDemandStorefront = require("../models/HighDemandStorefront");

function parseBoolean(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  if (typeof val === "number") return val === 1;
  return false;
}

function normalizeVariantId(value) {
  if (!value) return "";
  const match = String(value).match(/(\d+)$/);
  return match ? match[1] : String(value).trim();
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
// TOGGLE URGENCY / LOW STOCK BADGE
// POST /api/high-demand/toggle-badge
// ==================================================

async function toggleUrgencyBadge(req, res) {
  try {
    await ensureConnected();
    const rawVariantParam = req.params?.variantId;
    const { shop: rawShop, variantId: rawVariantId, enabled, threshold, showDaysRemaining } = req.body || {};

    const shop = normalizeShop(rawShop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanVariantId = normalizeVariantId(rawVariantId || rawVariantParam);
    const variantGid = normalizeVariantGid(rawVariantId || rawVariantParam);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    if (!cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    const isEnabled = parseBoolean(enabled);
    const badgeThreshold = Number(threshold) > 0 ? Number(threshold) : 5;
    const showDays = showDaysRemaining !== undefined ? parseBoolean(showDaysRemaining) : true;

    const filterQuery = {
      $or: [
        { shop, variantId: variantGid },
        { shop, variantId: cleanVariantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: variantGid },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: cleanVariantId },
      ],
    };

    const existingConfig = await HighDemandStorefront.findOne(filterQuery).lean();
    const wasAlreadyEnabled = Boolean(
      existingConfig?.urgencyBadgeEnabled ||
      existingConfig?.lowStockBadge?.enabled
    );

    const storefrontConfig = await HighDemandStorefront.findOneAndUpdate(
      filterQuery,
      {
        $set: {
          shop,
          variantId: variantGid,
          urgencyBadgeEnabled: isEnabled,
          "lowStockBadge.enabled": isEnabled,
          "lowStockBadge.threshold": badgeThreshold,
          "lowStockBadge.showDaysRemaining": showDays,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await HighDemand.updateMany(
      filterQuery,
      { $set: { urgencyBadgeEnabled: isEnabled, "lowStockBadge.enabled": isEnabled } }
    ).catch(() => {});

    // Only increment usage on transitioning to active (prevent duplicate counts)
    if (isEnabled && !wasAlreadyEnabled && req.subscription) {
      await incrementFeatureUsage(
        req.subscription,
        "lowStockBadge"
      );
    }

    return res.status(200).json({
      success: true,
      message: isEnabled
        ? "Low stock badge enabled successfully."
        : "Low stock badge disabled successfully.",
      data: {
        shop,
        variantId: variantGid,
        urgencyBadgeEnabled: isEnabled,
        lowStockBadge: storefrontConfig.lowStockBadge,
        config: storefrontConfig,
      },
      billing: req.subscription
        ? {
            plan: req.subscription.plan,
            feature: "lowStockBadge",
          }
        : null,
    });
  } catch (error) {
    console.error("Toggle Urgency Badge Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update urgency badge",
      error: error.message,
    });
  }
}

// ==================================================
// TOGGLE PRE-ORDER
// POST /api/high-demand/toggle-preorder
// ==================================================

async function togglePreOrder(req, res) {
  try {
    await ensureConnected();
    const rawVariantParam = req.params?.variantId;
    const { shop: rawShop, variantId: rawVariantId, enabled } = req.body || {};

    const shop = normalizeShop(rawShop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanVariantId = normalizeVariantId(rawVariantId || rawVariantParam);
    const variantGid = normalizeVariantGid(rawVariantId || rawVariantParam);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    if (!cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    const isEnabled = parseBoolean(enabled);

    const filterQuery = {
      $or: [
        { shop, variantId: variantGid },
        { shop, variantId: cleanVariantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: variantGid },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: cleanVariantId },
      ],
    };

    const storefrontConfig = await HighDemandStorefront.findOneAndUpdate(
      filterQuery,
      {
        $set: {
          shop,
          variantId: variantGid,
          preOrderEnabled: isEnabled,
          "preOrder.enabled": isEnabled,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await HighDemand.updateMany(
      filterQuery,
      { $set: { preOrderEnabled: isEnabled, "preOrder.enabled": isEnabled } }
    ).catch(() => {});

    // Automatically configure Shopify variant's inventory policy to allow pre-orders at checkout!
    try {
      const Store = require("../models/Store");
      const store = await Store.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean();

      if (store?.accessToken && cleanVariantId) {
        await fetch(`https://${shop}/admin/api/2024-01/variants/${cleanVariantId}.json`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": store.accessToken,
          },
          body: JSON.stringify({
            variant: {
              id: Number(cleanVariantId),
              inventory_policy: isEnabled ? "continue" : "deny",
            },
          }),
        });
        console.log(`[Smart Stock] Variant ${cleanVariantId} inventory_policy set to ${isEnabled ? "continue" : "deny"}`);
      }
    } catch (policyErr) {
      console.warn("[togglePreOrder] Shopify inventory policy update notice:", policyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: isEnabled
        ? "Pre-order enabled successfully."
        : "Pre-order disabled successfully.",
      data: {
        shop,
        variantId: variantGid,
        preOrderEnabled: isEnabled,
        preOrder: storefrontConfig.preOrder,
        config: storefrontConfig,
      },
    });
  } catch (error) {
    console.error("Toggle Pre-Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update pre-order setting",
      error: error.message,
    });
  }
}

// ==================================================
// TOGGLE NOTIFY ME (BACK-IN-STOCK WAITLIST)
// POST /api/high-demand/toggle-notify-me
// ==================================================

async function toggleNotifyMe(req, res) {
  try {
    await ensureConnected();
    const rawVariantParam = req.params?.variantId;
    const { shop: rawShop, variantId: rawVariantId, enabled } = req.body || {};

    const shop = normalizeShop(rawShop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanVariantId = normalizeVariantId(rawVariantId || rawVariantParam);
    const variantGid = normalizeVariantGid(rawVariantId || rawVariantParam);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    if (!cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    const isEnabled = parseBoolean(enabled);

    const filterQuery = {
      $or: [
        { shop, variantId: variantGid },
        { shop, variantId: cleanVariantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: variantGid },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: cleanVariantId },
      ],
    };

    const storefrontConfig = await HighDemandStorefront.findOneAndUpdate(
      filterQuery,
      {
        $set: {
          shop,
          variantId: variantGid,
          notifyMeEnabled: isEnabled,
          "notifyMe.enabled": isEnabled,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await HighDemand.updateMany(
      filterQuery,
      { $set: { notifyMeEnabled: isEnabled, "notifyMe.enabled": isEnabled } }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: isEnabled
        ? "Notify Me waitlist enabled successfully."
        : "Notify Me waitlist disabled successfully.",
      data: {
        shop,
        variantId: variantGid,
        notifyMeEnabled: isEnabled,
        notifyMe: storefrontConfig.notifyMe,
        config: storefrontConfig,
      },
    });
  } catch (error) {
    console.error("Toggle Notify Me Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Notify Me setting",
      error: error.message,
    });
  }
}

// ==================================================
// TOGGLE MONITOR
// POST /api/high-demand/monitor/:variantId
// ==================================================

async function toggleMonitor(req, res) {
  try {
    await ensureConnected();
    const rawVariantParam = req.params?.variantId;
    const { shop: rawShop, variantId: rawVariantId, enabled } = req.body || {};

    const shop = normalizeShop(rawShop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const variantId = normalizeVariantGid(rawVariantId || rawVariantParam);

    if (!shop || !variantId) {
      return res.status(400).json({
        success: false,
        message: "shop and variantId are required",
      });
    }

    const isEnabled = enabled !== undefined ? Boolean(enabled) : true;

    const storefrontConfig = await HighDemandStorefront.findOneAndUpdate(
      { shop, variantId },
      { $set: { "monitor.enabled": isEnabled } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: isEnabled
        ? "Product monitoring activated."
        : "Product monitoring deactivated.",
      data: {
        shop,
        variantId,
        monitor: storefrontConfig.monitor,
      },
    });
  } catch (error) {
    console.error("Toggle Monitor Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update monitor setting",
      error: error.message,
    });
  }
}

// ==================================================
// GET / PATCH STOREFRONT CONFIG BY VARIANT
// ==================================================

async function getStorefrontConfig(req, res) {
  try {
    await ensureConnected();
    const rawVariantId = req.params.variantId || req.query.variantId;
    const shop = normalizeShop(req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanVariantId = normalizeVariantId(rawVariantId);
    const variantId = normalizeVariantGid(rawVariantId);

    if (!shop || !cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "shop and variantId are required",
      });
    }

    const filterQuery = {
      $or: [
        { shop, variantId },
        { shop, variantId: cleanVariantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: cleanVariantId },
      ],
    };

    const config = await HighDemandStorefront.findOne(filterQuery).lean();
    const highDemandDoc = await HighDemand.findOne(filterQuery).lean();

    const isPreOrder = parseBoolean(
      config?.preOrder?.enabled ??
      config?.preOrderEnabled ??
      highDemandDoc?.preOrder?.enabled ??
      highDemandDoc?.preOrderEnabled
    );

    const isLowStockBadge = parseBoolean(
      config?.lowStockBadge?.enabled ??
      config?.urgencyBadgeEnabled ??
      highDemandDoc?.lowStockBadge?.enabled ??
      highDemandDoc?.urgencyBadgeEnabled
    );

    return res.status(200).json({
      success: true,
      data: {
        shop,
        variantId,
        productId: config?.productId || highDemandDoc?.productId || "",
        lowStockBadge: {
          enabled: isLowStockBadge,
          threshold: Number(config?.lowStockBadge?.threshold || 5),
          showDaysRemaining: config?.lowStockBadge?.showDaysRemaining !== false,
        },
        preOrder: {
          enabled: isPreOrder,
          buttonText: config?.preOrder?.buttonText || "🛒 Pre-Order Now",
        },
        monitor: {
          enabled: parseBoolean(config?.monitor?.enabled ?? highDemandDoc?.monitor?.enabled),
        },
        currentStock: highDemandDoc?.currentStock ?? 0,
        daysUntilStockout: highDemandDoc?.daysUntilStockout ?? null,
      },
    });
  } catch (error) {
    console.error("Get Storefront Config Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch storefront config",
      error: error.message,
    });
  }
}

async function updateStorefrontConfig(req, res) {
  try {
    await ensureConnected();
    const rawVariantId = req.params.variantId || req.body.variantId;
    const shop = normalizeShop(req.body.shop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanVariantId = normalizeVariantId(rawVariantId);
    const variantId = normalizeVariantGid(rawVariantId);

    if (!shop || !cleanVariantId) {
      return res.status(400).json({
        success: false,
        message: "shop and variantId are required",
      });
    }

    const updateFields = {};
    if (req.body.lowStockBadge) {
      if (req.body.lowStockBadge.enabled !== undefined) {
        const isBadge = parseBoolean(req.body.lowStockBadge.enabled);
        updateFields["lowStockBadge.enabled"] = isBadge;
        updateFields["urgencyBadgeEnabled"] = isBadge;
      }
      if (req.body.lowStockBadge.threshold !== undefined) {
        updateFields["lowStockBadge.threshold"] = Number(req.body.lowStockBadge.threshold);
      }
      if (req.body.lowStockBadge.showDaysRemaining !== undefined) {
        updateFields["lowStockBadge.showDaysRemaining"] = parseBoolean(req.body.lowStockBadge.showDaysRemaining);
      }
    }
    if (req.body.preOrder) {
      if (req.body.preOrder.enabled !== undefined) {
        const isPreOrder = parseBoolean(req.body.preOrder.enabled);
        updateFields["preOrder.enabled"] = isPreOrder;
        updateFields["preOrderEnabled"] = isPreOrder;
      }
      if (req.body.preOrder.buttonText !== undefined) {
        updateFields["preOrder.buttonText"] = String(req.body.preOrder.buttonText);
      }
    }
    if (req.body.monitor && req.body.monitor.enabled !== undefined) {
      updateFields["monitor.enabled"] = parseBoolean(req.body.monitor.enabled);
    }
    if (req.body.productId) {
      updateFields["productId"] = String(req.body.productId);
    }

    const filterQuery = {
      $or: [
        { shop, variantId },
        { shop, variantId: cleanVariantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId },
        { shop: new RegExp(`^${shop}$`, "i"), variantId: cleanVariantId },
      ],
    };

    const saved = await HighDemandStorefront.findOneAndUpdate(
      filterQuery,
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await HighDemand.updateMany(
      filterQuery,
      { $set: updateFields }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Storefront configuration updated successfully.",
      data: saved,
    });
  } catch (error) {
    console.error("Update Storefront Config Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update storefront config",
      error: error.message,
    });
  }
}

async function getHighDemandProductActions(req, res) {
  try {
    await ensureConnected();
    const rawVariantId = String(req.params.variantId || "");
    const cleanNumericId = rawVariantId.replace("gid://shopify/ProductVariant/", "").replace(/\D/g, "");
    const canonicalGid = rawVariantId.startsWith("gid://shopify/ProductVariant/")
      ? rawVariantId
      : `gid://shopify/ProductVariant/${cleanNumericId}`;

    const shop = normalizeShop(req.query.shop || req.headers["x-shopify-shop-domain"]);

    const resultActions = [];

    // 1. Fetch High Demand item details to get productId
    const hdItem = await HighDemand.findOne({
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { variantId: rawVariantId },
      ],
    }).lean().catch(() => null);

    const productId = hdItem?.productId || "";
    const cleanProdId = String(productId).replace(/\D/g, "");
    const prodGid = productId.startsWith("gid://shopify/Product/")
      ? productId
      : cleanProdId
      ? `gid://shopify/Product/${cleanProdId}`
      : "";

    // 2. Low Stock Urgency Badge Record
    const HighDemandStorefront = require("../models/HighDemandStorefront");
    const badgeItem = await HighDemandStorefront.findOne({
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { variantId: rawVariantId },
      ],
    }).lean().catch(() => null);

    if (badgeItem) {
      resultActions.push({
        _id: `badge-${badgeItem._id}`,
        actionType: "LOW_STOCK_BADGE",
        status: badgeItem.urgencyBadgeEnabled || badgeItem.lowStockBadge?.enabled ? "ACTIVE" : "DISABLED",
        createdAt: badgeItem.updatedAt || badgeItem.createdAt || new Date(),
      });
    }

    // 3. Launch Pre-Order Record
    const LaunchPreOrder = require("../models/LaunchPreOrder");
    const preorderItem = await LaunchPreOrder.findOne({
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { productId: prodGid },
        { productId: cleanProdId },
      ],
    }).lean().catch(() => null);

    if (preorderItem) {
      resultActions.push({
        _id: `po-${preorderItem._id}`,
        actionType: "LAUNCH_PRE_ORDER",
        status: preorderItem.preOrderEnabled ? "ACTIVE" : "DISABLED",
        createdAt: preorderItem.updatedAt || preorderItem.createdAt || new Date(),
      });
    }

    // 4. Reorder Purchase Orders
    const HighDemandReorder = require("../models/highDemandReorder");
    const reorderItems = await HighDemandReorder.find({
      $or: [
        { variantId: canonicalGid },
        { variantId: cleanNumericId },
        { productId: prodGid },
        { productId: cleanProdId },
      ],
    }).sort({ createdAt: -1 }).lean().catch(() => []);

    for (const po of reorderItems || []) {
      resultActions.push({
        _id: `reorder-${po._id}`,
        actionType: `REORDER_PO_CREATED (${po.quantity || 0} units)`,
        status: String(po.status || "PENDING").toUpperCase(),
        createdAt: po.createdAt || new Date(),
      });
    }

    // 5. Stockout Risk Analysis Record
    resultActions.push({
      _id: `audit-hd-${cleanNumericId || "item"}`,
      actionType: `STOCKOUT_RISK_ANALYSIS (${hdItem?.riskLevel || "CRITICAL"})`,
      status: "COMPLETED",
      createdAt: hdItem?.analyzedAt || hdItem?.updatedAt || new Date(),
    });

    // Sort descending by date
    resultActions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ success: true, data: resultActions });
  } catch (error) {
    console.error("GET /api/high-demand/:variantId/actions Error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch high demand product actions." });
  }
}

module.exports = {
  analyzeHighDemand,
  getHighDemandProducts: analyzeHighDemand,
  getHighDemandVariantDetail,
  getHighDemandVariant: getHighDemandVariantDetail,
  getHighDemandProductActions,
  toggleUrgencyBadge,
  togglePreOrder,
  toggleNotifyMe,
  toggleMonitor,
  getStorefrontConfig,
  updateStorefrontConfig,
};