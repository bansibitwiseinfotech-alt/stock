const mongoose = require("mongoose");
const Store = require("../models/Store");
const DeadStock = require("../models/DeadStock");
const DeadStockAction = require("../models/DeadStockAction");
const ClearanceSale = require("../models/ClearanceSale");
const shopifyGraphQL = require("../services/shopifyGraphql");
const connectDB = require("../config/mongodb");
const { runDeadStockEngine } = require("../services/deadStock/deadStockEngine");
const clearanceService = require("../services/clearanceService");
const progressiveMarkdownService = require("../services/progressiveMarkdownService");
const bundleService = require("../services/bundleService");
const bulkSaleService = require("../services/bulkSaleService");

// ─────────────────────────────────────────────────────────────────────────────
// Shopify GraphQL query — cursor-based paginated product listing.
// ─────────────────────────────────────────────────────────────────────────────
const GET_STORE_PRODUCTS_QUERY = `
  query GetStoreProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE, reverse: false) {
      nodes {
        id
        title
        handle
        status
        totalInventory 
        featuredImage { url altText }
        variants(first: 250) {
          nodes {
            id
            title
            sku
            price
            inventoryQuantity
            inventoryItem {
              unitCost { amount currencyCode }
            }
          }
          pageInfo { hasNextPage }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

function parseInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function persistStoreToken(shopId, headerToken) {
  if (shopId && headerToken && !headerToken.startsWith("shpua_test")) {
    try {
      await Store.findOneAndUpdate(
        { shop: shopId },
        { shop: shopId, accessToken: headerToken, active: true },
        { upsert: true }
      );
    } catch (err) {
      console.error("Failed to persist store token:", err.message);
    }
  }
}

async function getAccessToken(req, shopId) {
  const headerToken = req.headers["x-shopify-access-token"];
  if (headerToken) {
    await persistStoreToken(shopId, headerToken);
    return headerToken;
  }
  const store = await Store.findOne({ shop: shopId });
  return store?.accessToken || null;
}

function getParamId(req) {
  return req.params.variantId || req.params.productId || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/store-products
// ─────────────────────────────────────────────────────────────────────────────
async function getStoreProducts(req, res) {
  try {
    const shop =
      req.shopId ||
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    if (!shop) {
      return res.status(400).json({ success: false, message: "Shop domain is required." });
    }

    await ensureConnected();

    const accessToken = await getAccessToken(req, shop);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Shopify access token not found. Please reinstall the app.",
      });
    }

    const first = Math.min(Math.max(Number(req.query.limit) || 50, 1), 250);
    const after = req.query.cursor || null;
    const rawSearch = String(req.query.search || "").trim().replace(/['"\\]/g, "");
    const shopifyQuery = rawSearch ? `title:*${rawSearch}*` : null;

    console.log(`[StoreProducts] shop=${shop} first=${first} after=${after || "null"} search=${rawSearch || "none"}`);

    const data = await shopifyGraphQL(shop, accessToken, GET_STORE_PRODUCTS_QUERY, {
      first,
      after,
      query: shopifyQuery,
    });

    const connection = data?.products;
    if (!connection) {
      return res.status(502).json({ success: false, message: "Shopify returned an unexpected response." });
    }

    const products = [];

    for (const product of connection.nodes || []) {
      const variants = product.variants?.nodes || [];

      if (variants.length === 0) {
        products.push({
          id: product.id,
          shopifyProductId: product.id,
          shopifyVariantId: null,
          title: product.title,
          productTitle: product.title,
          handle: product.handle,
          status: product.status,
          image: product.featuredImage?.url || null,
          sku: "",
          stock: product.totalInventory || 0,
          currentPrice: null,
          unitCost: null,
          cashTiedUp: null,
          daysUnsold: null,
          lastSoldAt: null,
          salesVelocity: 0,
          salesLast7Days: 0,
          salesLast30Days: 0,
          salesLast60Days: 0,
        });
        continue;
      }

      for (const variant of variants) {
        const stock = Number(variant.inventoryQuantity) || 0;
        const currentPrice = Number(variant.price) || 0;

        const rawCost = variant.inventoryItem?.unitCost?.amount;
        const unitCost = rawCost != null ? Number(rawCost) : null;
        const cashTiedUp = unitCost != null ? Number((stock * unitCost).toFixed(2)) : null;

        products.push({
          id: variant.id,
          shopifyProductId: product.id,
          shopifyVariantId: variant.id,
          title:
            variants.length > 1 && variant.title && variant.title !== "Default Title"
              ? `${product.title} \u2014 ${variant.title}`
              : product.title,
          productTitle: product.title,
          handle: product.handle,
          status: product.status,
          image: product.featuredImage?.url || null,
          sku: variant.sku || "",
          stock,
          currentPrice,
          unitCost,
          cashTiedUp,
          daysUnsold: null,
          lastSoldAt: null,
          salesVelocity: 0,
          salesLast7Days: 0,
          salesLast30Days: 0,
          salesLast60Days: 0,
        });
      }
    }

    return res.json({
      success: true,
      data: products,
      pagination: {
        limit: first,
        hasNextPage: connection.pageInfo.hasNextPage,
        hasPreviousPage: connection.pageInfo.hasPreviousPage,
        nextCursor: connection.pageInfo.endCursor || null,
        previousCursor: connection.pageInfo.startCursor || null,
        totalItems: null,
        totalPages: null,
      },
    });
  } catch (error) {
    console.error("[StoreProducts] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch Shopify products.",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock
// ─────────────────────────────────────────────────────────────────────────────
async function getDeadStock(req, res) {
  try {
    await ensureConnected();

    const shopId =
      req.shopId ||
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      "";

    const headerToken = req.headers["x-shopify-access-token"];
    if (headerToken) await persistStoreToken(shopId, headerToken);

    const { days, locationId, collectionId, search, status, page: rawPage, limit: rawLimit, all } = req.query;

    const allRecords = all === "true" || all === "1" || rawLimit === "0" || rawLimit === "all";
    const page = parseInteger(rawPage, 1);
    const limit = allRecords ? 0 : parseInteger(rawLimit, 10);
    const skip = allRecords ? 0 : (page - 1) * limit;

    const query = { shopId };

    if (days && days !== "all") {
      const minDays = Number(days);
      if (Number.isFinite(minDays) && minDays >= 0) query.daysUnsold = { $gte: minDays };
    } else if (status && status !== "all") {
      query.status = status;
    }

    if (locationId && locationId !== "all") query.locationId = locationId;
    if (collectionId && collectionId !== "all") query.collectionIds = collectionId;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ title: regex }, { sku: regex }];
    }

    const totalItems = await DeadStock.countDocuments(query).catch(() => 0);
    const totalPages = allRecords ? 1 : Math.max(1, Math.ceil(totalItems / limit));
    const sortOption = days === "all" ? { createdAt: -1 } : { daysUnsold: -1, createdAt: -1 };

    const deadStockQuery = DeadStock.find(query).sort(sortOption);
    const items = allRecords
      ? await deadStockQuery.lean().catch(() => [])
      : await deadStockQuery.skip(skip).limit(limit).lean().catch(() => []);

    const formattedData = items.map((item) => {
      const stock = item.stock || 0;
      const unitCost = item.costPrice || 0;
      return {
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        productTitle: item.title,
        sku: item.sku || "N/A",
        image: item.image,
        daysUnsold: item.daysUnsold || 0,
        stock,
        costPrice: unitCost,
        unitCost,
        cashTiedUp: Number((stock * unitCost).toFixed(2)),
        status: item.status,
        locationId: item.locationId,
        locationName: item.locationName,
        lastSoldAt: item.lastSoldAt,
        salesVelocity: item.salesVelocity || 0,
        salesLast7Days: item.salesLast7Days || 0,
        salesLast30Days: item.salesLast30Days || 0,
        salesLast60Days: item.salesLast60Days || 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        page: allRecords ? 1 : page,
        limit: allRecords ? 0 : limit,
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    console.error("GET /api/dead-stock Error:", error);
    return res.status(500).json({ success: false, message: "Unable to load dead stock data." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/summary
// ─────────────────────────────────────────────────────────────────────────────
async function getDeadStockSummary(req, res) {
  try {
    await ensureConnected();

    const shopId =
      req.shopId ||
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      "";

    const summaryQuery = {
      shopId,
      $or: [{ status: "dead_stock" }, { daysUnsold: { $gte: 60 } }],
    };

    const aggregation = await DeadStock.aggregate([
      { $match: summaryQuery },
      { $group: { _id: null, totalCashTiedUp: { $sum: "$cashTiedUp" }, deadStockSkuCount: { $sum: 1 } } },
    ]).catch(() => []);

    const result = aggregation[0] || { totalCashTiedUp: 0, deadStockSkuCount: 0 };

    return res.status(200).json({
      success: true,
      data: {
        totalCashTiedUp: Number((result.totalCashTiedUp || 0).toFixed(2)),
        deadStockSkuCount: result.deadStockSkuCount || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/dead-stock/summary Error:", error);
    return res.status(500).json({ success: false, message: "Unable to calculate dead stock summary." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/sync
// ─────────────────────────────────────────────────────────────────────────────
async function syncDeadStockData(req, res) {
  try {
    await ensureConnected();

    const shopId =
      req.shopId ||
      req.query.shop ||
      req.body?.shop ||
      req.headers["x-shopify-shop-domain"] ||
      "";

    const headerToken = req.headers["x-shopify-access-token"];
    if (headerToken) await persistStoreToken(shopId, headerToken);

    const store = await Store.findOne({ shop: shopId });
    const accessToken = store?.accessToken || headerToken || req.body?.accessToken;

    if (!accessToken) {
      return res.status(403).json({ success: false, message: "Access token missing. Please reinstall the app." });
    }

    const syncResult = await runDeadStockEngine(shopId, accessToken);

    return res.status(200).json({
      success: true,
      message: `Synced ${syncResult.totalSynced} products from Shopify into MongoDB.`,
      syncedCount: syncResult.totalSynced,
    });
  } catch (error) {
    console.error("POST /api/dead-stock/sync Error:", error.message);
    return res.status(500).json({ success: false, message: "Shopify sync failed: " + (error.message || "") });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/webhook/product-delete
// ─────────────────────────────────────────────────────────────────────────────
async function deleteProductByWebhook(req, res) {
  try {
    await ensureConnected();

    const { shop, productId } = req.body || {};
    if (!shop || !productId) {
      return res.status(400).json({ success: false, message: "Missing shop or productId." });
    }

    const numericId = String(productId).replace("gid://shopify/Product/", "");
    const gid = `gid://shopify/Product/${numericId}`;

    const deleteResult = await DeadStock.deleteMany({
      shopId: shop,
      $or: [
        { productId: numericId },
        { productId: gid },
        { productId: { $regex: numericId } },
      ],
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${deleteResult.deletedCount} items from MongoDB.`,
    });
  } catch (error) {
    console.error("deleteProductByWebhook Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId
// ─────────────────────────────────────────────────────────────────────────────
async function getDeadStockByVariantId(req, res) {
  try {
    await ensureConnected();

    const shopId =
      req.shopId ||
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      "";
    const targetId = getParamId(req);
    const decodedId = decodeURIComponent(targetId);
    const cleanId = decodedId
      .replace("gid://shopify/ProductVariant/", "")
      .replace("gid://shopify/Product/", "");

    let formattedProduct = null;

    const shopCondition = {
      $or: [
        { shopId },
        { shop: shopId },
        { shopId: String(shopId).replace(/^https?:\/\//i, "") },
        { shop: String(shopId).replace(/^https?:\/\//i, "") },
      ],
    };

    const idCondition = {
      $or: [
        { variantId: decodedId }, 
        { variantId: `gid://shopify/ProductVariant/${cleanId}` },
        { variantId: cleanId },
        { productId: decodedId },
        { productId: `gid://shopify/Product/${cleanId}` },
        { productId: cleanId },
      ],
    };                                                                                  

    const item = await DeadStock.findOne({
      $and: [shopCondition, idCondition],
    }).lean().catch(() => null);

    if (!item) {
      const accessToken = await getAccessToken(req, shopId);
      if (!accessToken) {
        return res.status(403).json({ success: false, message: "Access token missing." });
      }

      const variantGid = decodedId.startsWith("gid://")
        ? decodedId
        : `gid://shopify/ProductVariant/${cleanId}`;

      const data = await shopifyGraphQL(shopId, accessToken, `
        query productVariantDetail($id: ID!) {
          productVariant(id: $id) {
            id sku price compareAtPrice inventoryQuantity
            inventoryItem { unitCost { amount currencyCode } }
            product { id title featuredImage { url } }
          }
        }`, { id: variantGid });

      const variant = data?.productVariant;
      if (!variant) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      const productData = variant.product || {};
      const stock = Number(variant.inventoryQuantity) || 0;
      const unitCost = Number(variant.inventoryItem?.unitCost?.amount) || 0;
      const sellingPrice = Number(variant.price) || 0;
      const compareAtPrice = Number(variant.compareAtPrice) || null;

      formattedProduct = {
        id: productData.id,
        shopifyProductId: productData.id,
        shopifyVariantId: variant.id,
        productId: productData.id,
        variantId: variant.id,
        title: productData.title || "Untitled product",
        productTitle: productData.title || "Untitled product",
        image: productData.featuredImage?.url || "",
        sku: variant.sku && variant.sku.trim() ? variant.sku : "N/A",
        currentPrice: sellingPrice,
        price: sellingPrice,
        compareAtPrice,
        currentStock: stock,
        stock,
        unitCost,
        costPrice: unitCost,
        cashTiedUp: Number((stock * (unitCost > 0 ? unitCost : sellingPrice)).toFixed(2)),
        daysUnsold: null,
        lastSoldAt: null,
        salesVelocity: 0,
        status: stock <= 0 ? "out_of_stock" : "in_stock",
      };
    } else {
      let stock = item.stock || 0;
      const unitCost = item.costPrice || 0;
      let currentPrice = Number(item.price || item.currentPrice || 0);
      let compareAtPrice = null;

      try {
        const accessToken = await getAccessToken(req, shopId);
        const variantGid = item.variantId?.startsWith("gid://")
          ? item.variantId
          : `gid://shopify/ProductVariant/${String(item.variantId).replace(/\D/g, "")}`;
        const priceData = await shopifyGraphQL(shopId, accessToken,
          "query q($id: ID!) { productVariant(id: $id) { price compareAtPrice inventoryQuantity } }",
          { id: variantGid });
        if (priceData?.productVariant) {
          if (priceData.productVariant.price != null) currentPrice = Number(priceData.productVariant.price);
          if (priceData.productVariant.compareAtPrice != null) compareAtPrice = Number(priceData.productVariant.compareAtPrice);
          if (priceData.productVariant.inventoryQuantity != null) stock = Number(priceData.productVariant.inventoryQuantity);
        }
      } catch (priceError) {
        console.warn("Unable to load current Shopify price:", priceError.message);
      }

      formattedProduct = {
        id: item.productId,
        shopifyProductId: item.productId,
        shopifyVariantId: item.variantId,
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        productTitle: item.title,
        image: item.image,
        sku: item.sku && item.sku.trim() ? item.sku : "N/A",
        currentPrice,
        price: currentPrice,
        compareAtPrice,
        currentStock: stock,
        stock,
        unitCost,
        costPrice: unitCost,
        cashTiedUp: Number((stock * (unitCost > 0 ? unitCost : currentPrice)).toFixed(2)),
        daysUnsold: item.daysUnsold || 0,
        lastSoldAt: item.lastSoldAt,
        salesVelocity: item.salesVelocity || 0,
        status: item.status,
      };
    }

    const prodIdClean = String(formattedProduct.shopifyProductId || formattedProduct.id || "").replace(/\D/g, "");
    const varIdClean = String(formattedProduct.shopifyVariantId || "").replace(/\D/g, "");

    const activeClearanceSale = await ClearanceSale.findOne({
      shop: shopId,
      $or: [
        { variantId: formattedProduct.shopifyVariantId },
        { variantId: varIdClean },
        { variantId: `gid://shopify/ProductVariant/${varIdClean}` },
        { productId: formattedProduct.shopifyProductId },
        { productId: prodIdClean },
        { productId: `gid://shopify/Product/${prodIdClean}` },
      ],
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    }).lean().catch(() => null);
    formattedProduct.activeClearanceSale = activeClearanceSale;

    const DeadStockBundle = require("../models/DeadStockBundle");
    const Bundle = require("../models/Bundle");

    const activeBogo = await DeadStockBundle.findOne({
      shop: shopId,
      status: { $in: ["ACTIVE", "DRAFT"] },
      $or: [
        { buyProductId: formattedProduct.shopifyProductId },
        { buyProductId: prodIdClean },
        { buyProductId: `gid://shopify/Product/${prodIdClean}` },
        { "products.productId": formattedProduct.shopifyProductId },
        { "products.productId": prodIdClean },
        { "products.productId": `gid://shopify/Product/${prodIdClean}` },
        { "products.variantId": formattedProduct.shopifyVariantId },
        { "products.variantId": varIdClean },
        { "products.variantId": `gid://shopify/ProductVariant/${varIdClean}` },
      ],
    }).sort({ createdAt: -1 }).lean().catch(() => null);

    const legacyBundle = await Bundle.findOne({
      shop: shopId,
      status: "ACTIVE",
      $or: [
        { deadStockVariantId: formattedProduct.shopifyVariantId },
        { deadStockVariantId: varIdClean },
        { deadStockVariantId: `gid://shopify/ProductVariant/${varIdClean}` },
        { deadStockProductId: formattedProduct.shopifyProductId },
        { deadStockProductId: prodIdClean },
        { deadStockProductId: `gid://shopify/Product/${prodIdClean}` },
      ],
    }).lean().catch(() => null);

    const activeBundle = legacyBundle || activeBogo;
    formattedProduct.activeBundle = activeBundle;

    const MarkdownRule = require("../models/MarkdownRule");
    const activeMarkdownRule = await MarkdownRule.findOne({
      $or: [{ shop: shopId }, { shop: String(shopId).replace(/^https?:\/\//i, "") }],
      $and: [
        { $or: [{ status: "ACTIVE" }, { active: true }] },
        {
          $or: [
            { variantId: formattedProduct.shopifyVariantId },
            { variantId: varIdClean },
            { variantId: `gid://shopify/ProductVariant/${varIdClean}` },
            { productId: formattedProduct.shopifyProductId },
            { productId: prodIdClean },
            { productId: `gid://shopify/Product/${prodIdClean}` },
          ],
        },
      ],
    }).lean().catch(() => null);
    formattedProduct.activeMarkdownRule = activeMarkdownRule;

    return res.status(200).json({
      success: true,
      product: formattedProduct,
      data: formattedProduct,
      activeClearanceSale,
      activeBundle,
      activeMarkdownRule,
    });
  } catch (error) {
    console.error("GET /api/dead-stock/:variantId Error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve product details." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/clearance
// ─────────────────────────────────────────────────────────────────────────────
async function createClearanceSale(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const authenticatedShop = req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const { variantId, discountPercent, startDate, endDate, durationDays, title } = req.body || {};

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });
    if (authenticatedShop && authenticatedShop !== shopId) return res.status(403).json({ success: false, message: "Shop mismatch." });
    if (!authenticatedShop || !req.headers["x-shopify-access-token"]) return res.status(401).json({ success: false, message: "Valid Shopify session required." });

    const accessToken = await getAccessToken(req, shopId);
    if (!accessToken) return res.status(403).json({ success: false, message: "Missing Shopify access token." });

    if (!Number.isFinite(Number(discountPercent)) || Number(discountPercent) <= 0 || Number(discountPercent) > 100) {
      return res.status(422).json({ success: false, message: "Discount must be between 1 and 100." });
    }
    if (!targetId || !variantId) return res.status(422).json({ success: false, message: "Product and variant are required." });

    let computedEndDate = endDate;
    if (!computedEndDate && (!durationDays || Number(durationDays) <= 0)) {
      return res.status(422).json({ success: false, message: "Duration must be > 0 days." });
    }
    if (!computedEndDate && durationDays && Number(durationDays) > 0) {
      const days = Number(durationDays);
      const start = startDate ? new Date(startDate) : new Date();
      if (Number.isNaN(start.getTime())) return res.status(422).json({ success: false, message: "Invalid start date." });
      computedEndDate = new Date(start.getTime() + days * 86400000).toISOString();
    }

    const result = await clearanceService.createClearanceSale(shopId, accessToken, {
      productId: targetId,
      variantId: variantId || "",
      discountPercent: Number(discountPercent),
      startDate,
      endDate: computedEndDate,
      title,
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("POST /api/dead-stock/:variantId/clearance Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create clearance sale." });
  }
}

// DELETE /api/dead-stock/:variantId/clearance
async function deleteClearanceSale(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const cleanId = decodeURIComponent(targetId)
      .replace("gid://shopify/ProductVariant/", "")
      .replace("gid://shopify/Product/", "");

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const accessToken = await getAccessToken(req, shopId);
    if (!accessToken) return res.status(403).json({ success: false, message: "Missing access token." });

    const ClearanceSale = require("../models/ClearanceSale");
    const formattedVarId = `gid://shopify/ProductVariant/${cleanId}`;
    const formattedProdId = `gid://shopify/Product/${cleanId}`;

    const sale = await ClearanceSale.findOne({
      shop: shopId,
      status: { $in: ["SCHEDULED", "ACTIVE"] },
      $or: [
        { variantId: targetId },
        { variantId: formattedVarId },
        { variantId: cleanId },
        { productId: targetId },
        { productId: formattedProdId },
        { productId: cleanId },
      ],
    }).lean();

    const productId = sale?.productId || formattedProdId;
    const variantId = sale?.variantId || (targetId.includes("ProductVariant") ? targetId : formattedVarId);

    const result = await clearanceService.deleteClearanceSale(shopId, accessToken, {
      productId,
      variantId,
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("DELETE /api/dead-stock/:variantId/clearance Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete clearance sale." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/collection
// ─────────────────────────────────────────────────────────────────────────────
async function addToClearanceCollection(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const { variantId } = req.body || {};

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const accessToken = await getAccessToken(req, shopId);
    if (!accessToken) return res.status(403).json({ success: false, message: "Missing access token." });

    const result = await clearanceService.addToClearanceCollection(shopId, accessToken, {
      productId: targetId,
      variantId: variantId || targetId,
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("POST /api/dead-stock/:variantId/collection Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to add to collection." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/markdown
// ─────────────────────────────────────────────────────────────────────────────
async function createProgressiveMarkdown(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const {
      variantId,
      startingDiscount,
      increasePercent,
      incrementPercent,
      decreasePercent,
      minimumDiscount,
      maximumDiscount,
    } = req.body || {};

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const accessToken = await getAccessToken(req, shopId);
    if (!accessToken) return res.status(403).json({ success: false, message: "Missing access token." });

    const result = await progressiveMarkdownService.createMarkdownRule(shopId, accessToken, {
      productId: targetId,
      variantId: variantId || targetId,
      startingDiscount,
      increasePercent: increasePercent ?? incrementPercent ?? 10,
      decreasePercent,
      minimumDiscount,
      maximumDiscount,
    });
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error("POST /api/dead-stock/:variantId/markdown Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create markdown rule." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE or POST /api/dead-stock/:variantId/markdown/stop
// ─────────────────────────────────────────────────────────────────────────────
async function stopProgressiveMarkdown(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const accessToken = await getAccessToken(req, shopId);
    const result = await progressiveMarkdownService.stopMarkdownRule(shopId, targetId, accessToken);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Stop Markdown Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to stop markdown rule." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/markdown/pause
// ─────────────────────────────────────────────────────────────────────────────
async function pauseProgressiveMarkdown(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const result = await progressiveMarkdownService.pauseMarkdownRule(shopId, targetId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Pause Markdown Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to pause markdown rule." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId/markdown
// ─────────────────────────────────────────────────────────────────────────────
async function getProgressiveMarkdown(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const rule = await progressiveMarkdownService.getMarkdownRuleByVariant(shopId, targetId);
    return res.json({ success: true, rule: rule || null });
  } catch (error) {
    console.error("Get Markdown Rule Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch markdown rule." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/markdown/rules
// ─────────────────────────────────────────────────────────────────────────────
async function listProgressiveMarkdownRules(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const rules = await progressiveMarkdownService.getMarkdownRules(shopId);
    return res.json({ success: true, rules: rules || [] });
  } catch (error) {
    console.error("List Markdown Rules Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to list markdown rules." });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/bundle
// ─────────────────────────────────────────────────────────────────────────────
async function createBundle(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const {
      deadStockVariantId,
      companionProductId,
      companionVariantId,
      deadStockTitle,
      companionTitle,
      deadStockImage,
      companionImage,
      deadStockPrice,
      companionPrice,
      bundleName,
      discountPercent,
      offerType,
      freeProductId,
      freeProductVariantId,
      freeProductTitle,
      freeProductImage,
    } = req.body || {};

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });
    if (!companionProductId) return res.status(422).json({ success: false, message: "Companion product must be selected." });

    const accessToken = await getAccessToken(req, shopId);
    const result = await bundleService.createDeadStockBundle(shopId, accessToken, {
      deadStockProductId: targetId,
      deadStockVariantId: deadStockVariantId || targetId,
      companionProductId,
      companionVariantId,
      deadStockTitle,
      companionTitle,
      deadStockImage,
      companionImage,
      deadStockPrice,
      companionPrice,
      bundleName,
      discountPercent,
      offerType,
      freeProductId,
      freeProductVariantId,
      freeProductTitle,
      freeProductImage,
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("POST /api/dead-stock/:variantId/bundle Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create bundle." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/dead-stock/:variantId/bundle
// ─────────────────────────────────────────────────────────────────────────────
async function deleteBundle(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);

    if (!shopId) return res.status(401).json({ success: false, message: "Shop domain is required." });

    const accessToken = await getAccessToken(req, shopId);
    const result = await bundleService.deleteDeadStockBundle(shopId, accessToken, targetId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("DELETE /api/dead-stock/:variantId/bundle Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete bundle." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId/companion-products
// ─────────────────────────────────────────────────────────────────────────────
async function getCompanionProducts(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const accessToken = await getAccessToken(req, shopId);
    const companions = await bundleService.getCompanionProducts(shopId, accessToken, targetId);
    return res.status(200).json({ success: true, data: companions });
  } catch (error) {
    console.error("GET /api/dead-stock/:variantId/companion-products Error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve companion products." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId/actions
// ─────────────────────────────────────────────────────────────────────────────
async function getProductActions(req, res) {
  try {
    await ensureConnected();
    const shopId = req.shopId || req.query.shop || req.headers["x-shopify-shop-domain"];
    const targetId = getParamId(req);
    const cleanId = decodeURIComponent(targetId)
      .replace("gid://shopify/ProductVariant/", "")
      .replace("gid://shopify/Product/", "");

    const actions = await DeadStockAction.find({
      shop: shopId,
      $or: [
        { productId: targetId }, { productId: `gid://shopify/Product/${cleanId}` }, { productId: cleanId },
        { variantId: targetId }, { variantId: `gid://shopify/ProductVariant/${cleanId}` }, { variantId: cleanId },
      ],
    }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, data: actions });
  } catch (error) {
    console.error("GET /api/dead-stock/:variantId/actions Error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve product actions log." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/bulk-sale
// ─────────────────────────────────────────────────────────────────────────────
async function createBulkSale(req, res) {
  try {
    await ensureConnected();

    const shop = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    if (!shop) {
      return res.status(401).json({ success: false, message: "Shop domain is required." });
    }

    const accessToken = await getAccessToken(req, shop);
    if (!accessToken) {
      return res.status(401).json({ success: false, message: "Shopify access token is required." });
    }

    const { variantIds, productIds, discountPercent, durationDays, startDate } = req.body || {};

    const result = await bulkSaleService.createBulkSale({
      shop,
      accessToken,
      variantIds,
      productIds,
      discountPercent,
      durationDays,
      startDate,
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("POST /api/dead-stock/bulk-sale Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process bulk sale request.",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/collection-sale-records
//
// Saves ClearanceSale MongoDB records for every variant in a collection
// after the Remix route has created the Shopify automatic discount.
// This is the bridge between the Shopify discount and the storefront widget.
// ─────────────────────────────────────────────────────────────────────────────
async function saveCollectionSaleRecords(req, res) {
  try {
    await ensureConnected();

    const shop = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    if (!shop) {
      return res.status(401).json({ success: false, message: "Shop domain is required." });
    }

    const {
      shopifyDiscountId,
      collectionId,
      collectionTitle,
      discountValue,
      startDate,
      endDate,
      variants,
    } = req.body || {};

    if (!shopifyDiscountId) {
      return res.status(400).json({ success: false, message: "Shopify discount ID is required." });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, message: "No variants provided." });
    }

    const discountPercent = Number(discountValue);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
      return res.status(400).json({ success: false, message: "Invalid discount value." });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid start or end date." });
    }

    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ success: false, message: "End date must be after start date." });
    }

    const now = new Date();
    const status = parsedStartDate > now ? "SCHEDULED" : "ACTIVE";

    const normalizeId = (value, prefix) => {
      const raw = String(value ?? "").trim();
      if (!raw) return [];
      const clean = raw.replace(/^gid:\/\/shopify\//, "").split("/").filter(Boolean).at(-1) || raw;
      const forms = new Set([raw, clean]);
      const prefixed = prefix && !raw.startsWith(prefix)
        ? `${prefix}${clean}`
        : null;
      if (prefixed) forms.add(prefixed);
      return [...forms].filter(Boolean);
    };

    let savedCount = 0;
    let errorCount = 0;

    for (const variant of variants) {
      try {
        const productId = String(variant.productId || "");
        const variantId = String(variant.variantId || "");
        const originalPrice = variant.price != null ? Number(variant.price) : null;

        if (!productId || !variantId) {
          errorCount++;
          continue;
        }

        const productIdForms = normalizeId(productId, "gid://shopify/Product/");
        const variantIdForms = normalizeId(variantId, "gid://shopify/ProductVariant/");

        const operationKeys = new Set();
        const operations = [];
        for (const productForm of productIdForms) {
          for (const variantForm of variantIdForms) {
            const key = `${productForm}::${variantForm}`;
            if (operationKeys.has(key)) continue;
            operationKeys.add(key);
            operations.push({
              productId: productForm,
              variantId: variantForm,
            });
          }
        }

        if (operations.length === 0) {
          errorCount++;
          continue;
        }

        for (const operation of operations) {
          await ClearanceSale.findOneAndUpdate(
            {
              shop,
              variantId: operation.variantId,
              status: { $in: ["SCHEDULED", "ACTIVE"] },
            },
            {
              $set: {
                shop,
                collectionId: collectionId || "",
                collectionTitle: collectionTitle || "",
                productId: operation.productId,
                productTitle: variant.productTitle || variant.title || "",
                variantId: operation.variantId,
                shopifyDiscountId,
                discountType: "PERCENTAGE",
                discountValue: discountPercent,
                discountPercent,
                originalPrice,
                salePrice: originalPrice != null ? Number((originalPrice * (1 - discountPercent / 100)).toFixed(2)) : null,
                savings: originalPrice != null ? Number((originalPrice * (discountPercent / 100)).toFixed(2)) : null,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                active: true,
                status,
                error: "",
              },
            },
            { upsert: true, new: true }
          );
        }

        savedCount += operations.length;
      } catch (variantError) {
        console.warn(
          `[CollectionSaleRecords] Failed to save record for variant ${variant.variantId}:`,
          variantError.message
        );
        errorCount++;
      }
    }

    // Log the bulk action
    try {
      await DeadStockAction.create({
        shop,
        productId: collectionId || "",
        variantId: "",
        actionType: "COLLECTION_BULK_CLEARANCE",
        status: "COMPLETED",
        discountPercent,
        discountValue: discountPercent,
        shopifyDiscountId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        executedAt: new Date(),
        metadata: {
          collectionId,
          collectionTitle,
          totalVariants: variants.length,
          savedCount,
          errorCount,
        },
      });
    } catch (logError) {
      console.error("[CollectionSaleRecords] Action log failed:", logError.message);
    }

    console.log(
      `[CollectionSaleRecords] shop=${shop} collection="${collectionTitle}" saved=${savedCount} errors=${errorCount}`
    );

    return res.status(200).json({
      success: true,
      message: `Saved ${savedCount} clearance sale records.`,
      savedCount,
      errorCount,
    });
  } catch (error) {
    console.error("POST /api/dead-stock/collection-sale-records Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save collection sale records.",
    });
  }
}

async function deleteCollectionSaleRecords(req, res) {
  try {
    await ensureConnected();

    const shop = req.shopId || req.query.shop || req.body?.shop || req.headers["x-shopify-shop-domain"];
    if (!shop) {
      return res.status(401).json({ success: false, message: "Shop domain is required." });
    }

    const { collectionId, collectionTitle } = req.body || {};
    if (!collectionId) {
      return res.status(400).json({ success: false, message: "Collection ID is required." });
    }

    const accessToken = await getAccessToken(req, shop);
    if (!accessToken) {
      return res.status(403).json({ success: false, message: "Missing Shopify access token." });
    }

    const rawCollectionId = String(collectionId).trim();
    const normalizedCollectionId = rawCollectionId.replace(/^gid:\/\/shopify\/Collection\//, "");
    const collectionIdVariants = new Set([
      rawCollectionId,
      normalizedCollectionId,
      `gid://shopify/Collection/${normalizedCollectionId}`,
    ]);

    const collectionMatches = [
      { collectionId: { $in: [...collectionIdVariants] } },
      { collectionTitle: collectionTitle ? collectionTitle.trim() : "" },
    ];

    const query = {
      shop,
      active: true,
      status: { $in: ["SCHEDULED", "ACTIVE"] },
      $or: collectionMatches,
    };

    const records = await ClearanceSale.find(query).lean();

    if (!records.length) {
      return res.status(200).json({
        success: true,
        deletedCount: 0,
        message: "No active collection sale records found.",
      });
    }

    let deletedCount = 0;
    for (const record of records) {
      if (record.shopifyDiscountId) {
        const discountResult = await clearanceService.deleteClearanceDiscount(shop, accessToken, record.shopifyDiscountId);
        if (!discountResult.success && discountResult.message && !discountResult.message.includes("not found")) {
          console.warn("[deleteCollectionSaleRecords] Failed to delete discount:", discountResult.message);
        }
      }

      await ClearanceSale.updateOne(
        { _id: record._id },
        {
          $set: {
            active: false,
            status: "CANCELLED",
            endDate: new Date(),
            error: "",
            updatedAt: new Date(),
          },
        }
      );

      deletedCount += 1;
    }

    return res.status(200).json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} active collection sale record(s).`,
    });
  } catch (error) {
    console.error("POST /api/dead-stock/collection-sale-records/delete Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete collection sale records.",
    });
  }
}

module.exports = {
  getStoreProducts,
  getDeadStock,
  getDeadStockSummary,
  syncDeadStockData,
  deleteProductByWebhook,
  getDeadStockByVariantId,
  createClearanceSale,
  deleteClearanceSale,
  addToClearanceCollection,
  createProgressiveMarkdown,
  stopProgressiveMarkdown,
  pauseProgressiveMarkdown,
  getProgressiveMarkdown,
  listProgressiveMarkdownRules,
  createBundle,
  deleteBundle,
  getCompanionProducts,
  getProductActions,
  createBulkSale,
  saveCollectionSaleRecords,
  deleteCollectionSaleRecords,
};