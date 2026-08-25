const PreOrder = require("../models/PreOrder");
const Product = require("../models/Product");
const Store = require("../models/Store");
const connectDB = require("../config/mongodb");
const mongoose = require("mongoose");
const shopifyGraphQL = require("../services/shopifyGraphql");
const { ensurePreOrderPaymentCustomization } = require("../services/paymentCustomizationService");

const CREATE_AUTOMATIC_DISCOUNT_MUTATION = `
mutation discountAutomaticBasicCreate(
  $automaticBasicDiscount: DiscountAutomaticBasicInput!
) {
  discountAutomaticBasicCreate(
    automaticBasicDiscount: $automaticBasicDiscount
  ) {
    automaticDiscountNode {
      id
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

const DELETE_AUTOMATIC_DISCOUNT_MUTATION = `
mutation discountAutomaticDelete($id: ID!) {
  discountAutomaticDelete(id: $id) {
    deletedAutomaticDiscountId
    userErrors {
      field
      message
      code
    }
  }
}
`;

async function syncPreOrderShopifyDiscount(shop, launchConfig) {
  try {
    const store = await Store.findOne({
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
    }).lean();

    if (!store || !store.accessToken) return "";

    // Automatically ensure COD is hidden at checkout for Pre-Orders
    ensurePreOrderPaymentCustomization(shop, store.accessToken).catch(() => {});

    // 1. Delete previous discount if any
    if (launchConfig.shopifyDiscountId) {
      try {
        await shopifyGraphQL(shop, store.accessToken, DELETE_AUTOMATIC_DISCOUNT_MUTATION, {
          id: launchConfig.shopifyDiscountId,
        });
      } catch (_) {}
    }

    const now = new Date();
    const launchDate = new Date(launchConfig.launchDate);
    if (!isNaN(launchDate.getTime())) {
      if (launchDate.getUTCHours() === 0 && launchDate.getUTCMinutes() === 0 && launchDate.getUTCSeconds() === 0) {
        launchDate.setUTCHours(23, 59, 59, 999);
      }
    }
    const opensAt = launchConfig.preOrderOpensAt ? new Date(launchConfig.preOrderOpensAt) : null;
    const isDepositEnabled = launchConfig.depositEnabled !== false;
    const isPreOrderActive =
      launchConfig.preOrderEnabled &&
      isDepositEnabled &&
      !isNaN(launchDate.getTime()) &&
      now <= launchDate &&
      (!opensAt || isNaN(opensAt.getTime()) || now >= opensAt);

    if (!isPreOrderActive) {
      return "";
    }

    const depositPct = typeof launchConfig.depositPercentage === "number" ? launchConfig.depositPercentage : 50;
    const depositAmt = Number(launchConfig.depositAmount) > 0 ? Number(launchConfig.depositAmount) : 0;

    const rawProdId = String(launchConfig.productId).replace(/^gid:\/\/shopify\/Product\//, "");
    const formattedProdGid = `gid://shopify/Product/${rawProdId}`;

    let customerGetsValue = null;
    let discountTitle = `Pre-Order Deposit - ${launchConfig.productTitle || "Product"}`;

    if (depositPct > 0 && depositPct < 100) {
      const discountPercent = (100 - depositPct) / 100;
      customerGetsValue = { percentage: discountPercent };
      discountTitle = `Pre-Order ${depositPct}% Deposit - ${launchConfig.productTitle || "Product"}`;
    } else if (depositAmt > 0) {
      let productPrice = 0;
      try {
        const prodRes = await shopifyGraphQL(shop, store.accessToken, `
          query getProdPrice($id: ID!) {
            product(id: $id) {
              variants(first: 1) {
                nodes {
                  price
                }
              }
            }
          }
        `, { id: formattedProdGid });
        const priceStr = prodRes?.product?.variants?.nodes?.[0]?.price;
        if (priceStr) productPrice = parseFloat(priceStr);
      } catch (_) {}

      if (productPrice > depositAmt) {
        const discountAmtValue = Number((productPrice - depositAmt).toFixed(2));
        customerGetsValue = {
          discountAmount: {
            amount: discountAmtValue,
            appliesOnEachItem: true,
          },
        };
      }
      discountTitle = `Pre-Order $${depositAmt.toFixed(2)} Deposit - ${launchConfig.productTitle || "Product"}`;
    }

    if (!customerGetsValue) return "";

    const automaticBasicDiscount = {
      title: discountTitle,
      startsAt: opensAt && !isNaN(opensAt.getTime()) ? opensAt.toISOString() : new Date().toISOString(),
      endsAt: launchDate.toISOString(),
      customerGets: {
        value: customerGetsValue,
        items: {
          products: {
            productsToAdd: [formattedProdGid],
          },
        },
      },
    };

    const res = await shopifyGraphQL(shop, store.accessToken, CREATE_AUTOMATIC_DISCOUNT_MUTATION, {
      automaticBasicDiscount,
    });

    const discountNodeId = res?.discountAutomaticBasicCreate?.automaticDiscountNode?.id || "";
    return discountNodeId;
  } catch (err) {
    console.warn("[PreOrder Discount Sync Error]:", err.message);
    return "";
  }
}

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

function normalizeShop(rawShop) {
  if (!rawShop) return "";
  let s = String(rawShop).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return s;
}

function normalizeVariantId(rawId) {
  if (!rawId) return "";
  const match = String(rawId).match(/(\d+)$/);
  return match ? match[1] : String(rawId).trim();
}

function getShopSubdomain(shop) {
  return String(shop).replace(/\.myshopify\.com$/, "");
}

// ==================================================
// HELPER: GET SHOPIFY ACCESS TOKEN FOR SHOP
// ==================================================
async function getShopifyAccessToken(shop) {
  try {
    const store = await Store.findOne({
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
    }).lean();

    if (store?.accessToken) {
      return store.accessToken;
    }
  } catch (_) {}

  return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
}

// ==================================================
// SYNC REAL SHOPIFY ORDERS INTO PRE-ORDERS COLLECTION
// ==================================================
async function syncShopifyPreOrders(shop) {
  await ensureConnected();
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) return { count: 0 };

  const accessToken = await getShopifyAccessToken(normalizedShop);
  if (!accessToken) {
    console.warn("[PreOrder Sync] No access token found for shop:", normalizedShop);
    return { count: 0 };
  }

  const queryGql = `
    query getPreOrders {
      orders(first: 50, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            email
            phone
            createdAt
            cancelledAt
            displayFinancialStatus
            displayFulfillmentStatus
            paymentGatewayNames
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              displayName
              firstName
              lastName
              email
              phone
            }
            tags
            customAttributes {
              key
              value
            }
            lineItems(first: 20) {
              edges {
                node {
                  id
                  title
                  variantTitle
                  quantity
                  sku
                  image {
                    url
                  }
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  product {
                    id
                    title
                    featuredImage {
                      url
                    }
                  }
                  variant {
                    id
                    title
                    image {
                      url
                    }
                  }
                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(`https://${normalizedShop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: queryGql }),
    });

    const data = await res.json();
    const orderEdges = data?.data?.orders?.edges || [];
    let syncedCount = 0;

    for (const edge of orderEdges) {
      const order = edge.node;
      const orderTags = order.tags || [];
      const orderAttributes = order.customAttributes || [];

      // Check if order has pre-order attributes, tags, or line item properties
      const isPreOrderOrder =
        orderTags.some((t) => /pre-?order/i.test(t)) ||
        orderAttributes.some((a) => /pre_?order/i.test(a.key) || /pre_?order/i.test(a.value));

      const preOrderLineItems = [];

      for (const lineEdge of order.lineItems?.edges || []) {
        const item = lineEdge.node;
        const itemAttrs = item.customAttributes || [];
        const hasPreOrderProp =
          isPreOrderOrder ||
          itemAttrs.some(
            (a) =>
              /pre-?order/i.test(a.key) ||
              /pre-?order/i.test(a.value) ||
              a.key === "_preorder" ||
              a.value === "Yes"
          );

        if (hasPreOrderProp) {
          preOrderLineItems.push(item);
        }
      }

      // If pre-orders found on this Shopify order, process deposit email and upsert to DB
      if (isPreOrderOrder || preOrderLineItems.length > 0) {
        const { processPreOrderDepositWebhook } = require("../services/preOrderDepositWebhookService");
        await processPreOrderDepositWebhook({ shop: normalizedShop, order }).catch((err) => {
          console.error(`[PreOrder Sync Process Error for ${order.name || order.id}]:`, err.message);
        });
        syncedCount++;
      }
    }

    console.log(`[PreOrder Sync] Successfully synced ${syncedCount} real pre-orders for ${normalizedShop}`);
    return { count: syncedCount };
  } catch (err) {
    console.error("[PreOrder Sync Error]:", err);
    return { count: 0, error: err.message };
  }
}

// ==================================================
// GET ALL PRE-ORDERS (WITH METRICS & FILTERING)
// GET /api/pre-orders
// ==================================================
async function getPreOrders(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    // Auto-sync real Shopify orders in background
    syncShopifyPreOrders(shop).catch(() => {});

    const {
      status = "ALL",
      search = "",
      paymentStatus = "ALL",
      fulfillmentStatus = "ALL",
      page = 1,
      limit = 20,
      sortBy = "placedAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
    };

    if (status && status !== "ALL") {
      query.status = status.toUpperCase();
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      query.$or = [{ financialStatus: paymentStatus.toUpperCase() }, { paymentStatus: paymentStatus.toUpperCase() }];
    }

    if (fulfillmentStatus && fulfillmentStatus !== "ALL") {
      query.fulfillmentStatus = fulfillmentStatus.toUpperCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$and = [
        {
          $or: [
            { orderNumber: searchRegex },
            { shopifyOrderName: searchRegex },
            { "customer.name": searchRegex },
            { "customer.email": searchRegex },
            { productTitle: searchRegex },
            { variantTitle: searchRegex },
            { sku: searchRegex },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [items, totalCount, allShopOrders] = await Promise.all([
      PreOrder.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      PreOrder.countDocuments(query),
      PreOrder.find({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean(),
    ]);

    // Calculate dynamic real metrics
    const totalPreOrders = allShopOrders.length;
    const pendingPreOrders = allShopOrders.filter(
      (o) => o.status === "PENDING" || o.fulfillmentStatus === "UNFULFILLED"
    ).length;
    const fulfilledPreOrders = allShopOrders.filter(
      (o) => o.status === "FULFILLED" || o.fulfillmentStatus === "FULFILLED"
    ).length;
    const totalUnits = allShopOrders.reduce(
      (acc, o) => acc + (Number(o.quantity) || 1),
      0
    );
    const totalRevenue = allShopOrders.reduce(
      (acc, o) => acc + (Number(o.totalPrice) || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
      metrics: {
        totalPreOrders,
        pendingPreOrders,
        fulfilledPreOrders,
        totalUnits,
        totalRevenue: Number(totalRevenue.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Get Pre-Orders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pre-orders",
      error: error.message,
    });
  }
}

// ==================================================
// TRIGGER MANUAL SYNC WITH SHOPIFY ORDERS
// POST /api/pre-orders/sync
// ==================================================
async function syncPreOrdersController(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.body?.shop || req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    const result = await syncShopifyPreOrders(shop);
    return res.status(200).json({
      success: true,
      message: `Synchronized ${result.count} pre-orders from Shopify.`,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to sync pre-orders",
      error: error.message,
    });
  }
}

// ==================================================
// UPDATE PRE-ORDER STATUS
// PATCH /api/pre-orders/:id/status
// ==================================================
async function updatePreOrderStatus(req, res) {
  try {
    await ensureConnected();
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["PENDING", "PROCESSING", "FULFILLED", "CANCELLED"];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updated = await PreOrder.findByIdAndUpdate(
      id,
      { $set: { status: status.toUpperCase() } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Pre-order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update pre-order status",
      error: error.message,
    });
  }
}

// ==================================================
// DELETE PRE-ORDER
// DELETE /api/pre-orders/:id
// ==================================================
async function deletePreOrder(req, res) {
  try {
    await ensureConnected();
    const { id } = req.params;
    const deleted = await PreOrder.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Pre-order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pre-order deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete pre-order",
      error: error.message,
    });
  }
}

// ==================================================
// HANDLE ORDER WEBHOOK (INSTANT EMAIL DISPATCH)
// POST /api/pre-orders/webhook/order-create
// ==================================================
async function handleOrderWebhook(req, res) {
  try {
    const { shop, order, topic } = req.body || {};
    const normalizedShop = normalizeShop(shop);

    if (!normalizedShop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    console.log(`[PreOrder Webhook] Received ${topic || "order"} for ${normalizedShop}. Processing instant pre-order deposit email...`);

    const { processPreOrderDepositWebhook } = require("../services/preOrderDepositWebhookService");

    // Process deposit email immediately in background
    if (order) {
      processPreOrderDepositWebhook({ shop: normalizedShop, order, topic })
        .then((result) => {
          console.log(`[PreOrder Webhook] Deposit processing result for ${order.name || order.id}:`, result);
        })
        .catch((err) => {
          console.error(`[PreOrder Webhook Processing Error]:`, err.message);
        });
    }

    // Also trigger full order sync in background
    syncShopifyPreOrders(normalizedShop).catch((err) => {
      console.error(`[PreOrder Webhook Sync Error]:`, err.message);
    });

    return res.status(200).json({ success: true, message: "Webhook accepted and processing." });
  } catch (err) {
    console.error("[PreOrder Webhook Error]:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function normalizeProductId(rawId) {
  if (!rawId) return "";
  const match = String(rawId).match(/(\d+)$/);
  return match ? match[1] : String(rawId).trim();
}

const LaunchPreOrder = require("../models/LaunchPreOrder");

// ==================================================
// GET ALL LAUNCH PRE-ORDER CONFIGURATIONS FOR SHOP
// GET /api/pre-orders/launch-config
// ==================================================
async function getLaunchConfigs(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    const configs = await LaunchPreOrder.find({ shop }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    const accessToken = await getShopifyAccessToken(shop);

    const enrichedConfigs = await Promise.all(
      configs.map(async (item) => {
        let productImage = item.productImage || "";
        let productHandle = item.productHandle || "";
        let productTitle = item.productTitle || "";

        const cleanId = normalizeProductId(item.productId);
        const formattedGid = `gid://shopify/Product/${cleanId}`;

        if (!productImage || !productHandle) {
          // 1. Try local MongoDB Product model
          const localProd = await Product.findOne({
            $or: [{ productId: cleanId }, { productId: formattedGid }],
          }).lean().catch(() => null);

          if (localProd) {
            if (!productImage && localProd.image) productImage = localProd.image;
            if (!productHandle && localProd.handle) productHandle = localProd.handle;
            if (!productTitle && localProd.title) productTitle = localProd.title;
          }

          // 2. Try HighDemand model
          if (!productImage) {
            const HighDemand = require("../models/highDemand");
            const hdItem = await HighDemand.findOne({
              shop,
              $or: [{ productId: cleanId }, { productId: formattedGid }],
            }).lean().catch(() => null);
            if (hdItem && hdItem.image) {
              productImage = hdItem.image;
            }
          }

          // 3. Try Shopify GraphQL
          if ((!productImage || !productHandle) && accessToken) {
            try {
              const query = `
                query getProdInfo($id: ID!) {
                  node(id: $id) {
                    ... on Product {
                      id
                      title
                      handle
                      featuredImage {
                        url
                      }
                      images(first: 1) {
                        edges {
                          node {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              `;
              const shopifyData = await shopifyGraphQL(shop, accessToken, query, { id: formattedGid });
              const pNode = shopifyData?.node;
              if (pNode) {
                if (!productImage) {
                  productImage = pNode.featuredImage?.url || pNode.images?.edges?.[0]?.node?.url || "";
                }
                if (!productHandle) {
                  productHandle = pNode.handle || "";
                }
                if (!productTitle && pNode.title) {
                  productTitle = pNode.title;
                }
              }
            } catch (_) {}
          }

          // Update MongoDB document asynchronously if image/handle found
          if (productImage || productHandle) {
            LaunchPreOrder.updateOne(
              { _id: item._id },
              {
                $set: {
                  ...(productImage ? { productImage } : {}),
                  ...(productHandle ? { productHandle } : {}),
                  ...(productTitle ? { productTitle } : {}),
                },
              }
            ).catch(() => {});
          }
        }

        const launchDate = new Date(item.launchDate);
        if (!isNaN(launchDate.getTime())) {
          if (launchDate.getUTCHours() === 0 && launchDate.getUTCMinutes() === 0 && launchDate.getUTCSeconds() === 0) {
            launchDate.setUTCHours(23, 59, 59, 999);
          }
        }
        const opensAt = item.preOrderOpensAt ? new Date(item.preOrderOpensAt) : null;
        const isPastLaunch = !isNaN(launchDate.getTime()) && now > launchDate;
        const isBeforeOpen = opensAt && !isNaN(opensAt.getTime()) && now < opensAt;

        let status = "ACTIVE";
        if (!item.preOrderEnabled) {
          status = "DISABLED";
        } else if (isPastLaunch) {
          status = "LAUNCHED";
        } else if (isBeforeOpen) {
          status = "SCHEDULED";
        }

        return {
          ...item,
          productImage,
          productHandle,
          productTitle,
          status,
          isActive: status === "ACTIVE",
        };
      })
    );

    const activeCount = enrichedConfigs.filter((c) => c.status === "ACTIVE").length;
    const scheduledCount = enrichedConfigs.filter((c) => c.status === "SCHEDULED").length;

    return res.status(200).json({
      success: true,
      data: enrichedConfigs,
      metrics: {
        total: enrichedConfigs.length,
        active: activeCount,
        scheduled: scheduledCount,
      },
    });
  } catch (error) {
    console.error("Get Launch Configs Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch launch configs", error: error.message });
  }
}

// ==================================================
// GET SINGLE LAUNCH CONFIG
// GET /api/pre-orders/launch-config/:productId
// ==================================================
async function getLaunchConfigByProduct(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);
    const rawProductId = req.params.productId;
    const cleanId = normalizeProductId(rawProductId);

    if (!shop || !cleanId) {
      return res.status(400).json({ success: false, message: "shop and productId are required" });
    }

    const config = await LaunchPreOrder.findOne({
      shop,
      $or: [{ productId: cleanId }, { productId: `gid://shopify/Product/${cleanId}` }],
    }).lean();

    return res.status(200).json({
      success: true,
      data: config || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch launch config", error: error.message });
  }
}

// ==================================================
// SAVE / UPSERT LAUNCH CONFIG
// POST /api/pre-orders/launch-config
// ==================================================
async function saveLaunchConfig(req, res) {
  try {
    await ensureConnected();
    const {
      shop: rawShop,
      productId: rawProductId,
      productTitle = "",
      productHandle = "",
      productImage = "",
      preOrderEnabled = true,
      preOrderOpensAt = null,
      launchDate,
      shippingDate = null,
      badgeText = "🛒 PRE-ORDER",
      launchLabel = "NEW LAUNCH",
      launchTitle = "New Product Launch",
      customerMessage = "Be the first to get the new product.",
      launchDetails = "",
      buttonText = "PRE-ORDER NOW",
      depositPercentage = 50,
      depositAmount = 0,
      depositEnabled = true,
      cardBackgroundColor = "#FFFFFF",
      textColor = "#111827",
      accentColor = "#4F46E5",
      borderColor = "#E2E8F0",
      badgeBackgroundColor = "#0F172A",
      badgeTextColor = "#FFFFFF",
    } = req.body || {};

    const shop = normalizeShop(rawShop || req.query.shop || req.headers["x-shopify-shop-domain"]);
    const cleanProductId = normalizeProductId(rawProductId);

    if (!shop) {
      return res.status(400).json({ success: false, message: "Shop domain is required." });
    }

    if (!cleanProductId) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }

    if (!launchDate) {
      return res.status(400).json({ success: false, message: "Launch Date is required." });
    }

    const rawPct = depositPercentage !== "" && depositPercentage != null ? Number(depositPercentage) : 50;
    const pct = isNaN(rawPct) ? 50 : Math.max(0, Math.min(100, rawPct));
    const safeDepositAmt = Number(depositAmount) >= 0 ? Number(depositAmount) : 0;

    const updatePayload = {
      shop,
      productId: cleanProductId,
      productTitle: productTitle.trim(),
      productHandle: productHandle.trim(),
      productImage: productImage.trim(),
      preOrderEnabled: Boolean(preOrderEnabled),
      preOrderOpensAt: preOrderOpensAt ? new Date(preOrderOpensAt) : null,
      launchDate: new Date(launchDate),
      shippingDate: shippingDate ? new Date(shippingDate) : null,
      badgeText: String(badgeText || "🛒 PRE-ORDER").trim(),
      launchLabel: String(launchLabel || "NEW LAUNCH").trim(),
      launchTitle: String(launchTitle || "New Product Launch").trim(),
      customerMessage: String(customerMessage || "").trim(),
      launchDetails: String(launchDetails || "").trim(),
      buttonText: String(buttonText || "PRE-ORDER NOW").trim(),
      depositPercentage: pct,
      depositAmount: safeDepositAmt,
      depositEnabled: Boolean(depositEnabled),
      cardBackgroundColor: String(cardBackgroundColor || "#FFFFFF").trim(),
      textColor: String(textColor || "#111827").trim(),
      accentColor: String(accentColor || "#4F46E5").trim(),
      borderColor: String(borderColor || "#E2E8F0").trim(),
      badgeBackgroundColor: String(badgeBackgroundColor || "#0F172A").trim(),
      badgeTextColor: String(badgeTextColor || "#FFFFFF").trim(),
    };

    const updated = await LaunchPreOrder.findOneAndUpdate(
      { shop, productId: cleanProductId },
      { $set: updatePayload },
      { upsert: true, new: true }
    );

    // Synchronize Shopify Automatic Discount for partial deposit
    try {
      const discountId = await syncPreOrderShopifyDiscount(shop, updated);
      if (discountId !== updated.shopifyDiscountId) {
        updated.shopifyDiscountId = discountId;
        await updated.save();
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "Launch Pre-Order configuration saved successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Save Launch Config Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save launch config", error: error.message });
  }
}

// ==================================================
// TOGGLE LAUNCH CONFIG ENABLED
// POST /api/pre-orders/launch-config/:productId/toggle
// ==================================================
async function toggleLaunchConfig(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.body?.shop || req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);
    const cleanId = normalizeProductId(req.params.productId);
    const { enabled } = req.body || {};

    if (!shop || !cleanId) {
      return res.status(400).json({ success: false, message: "shop and productId are required" });
    }

    const updated = await LaunchPreOrder.findOneAndUpdate(
      { shop, productId: cleanId },
      { $set: { preOrderEnabled: Boolean(enabled) } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Launch configuration not found." });
    }

    // Synchronize Shopify Automatic Discount on toggle
    try {
      const discountId = await syncPreOrderShopifyDiscount(shop, updated);
      if (discountId !== updated.shopifyDiscountId) {
        updated.shopifyDiscountId = discountId;
        await updated.save();
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Launch pre-order ${updated.preOrderEnabled ? "enabled" : "disabled"}.`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to toggle launch config", error: error.message });
  }
}

// ==================================================
// DELETE LAUNCH CONFIG
// DELETE /api/pre-orders/launch-config/:productId
// ==================================================
async function deleteLaunchConfig(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);
    const cleanId = normalizeProductId(req.params.productId);

    if (!shop || !cleanId) {
      return res.status(400).json({ success: false, message: "shop and productId are required" });
    }

    const deleted = await LaunchPreOrder.findOneAndDelete({
      shop,
      $or: [
        { productId: cleanId },
        { productId: req.params.productId },
        { productId: `gid://shopify/Product/${cleanId}` },
      ],
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Launch configuration not found." });
    }

    // Clean up Shopify discount
    if (deleted.shopifyDiscountId) {
      try {
        const store = await Store.findOne({ shop }).lean();
        if (store?.accessToken) {
          await shopifyGraphQL(shop, store.accessToken, DELETE_AUTOMATIC_DISCOUNT_MUTATION, {
            id: deleted.shopifyDiscountId,
          });
        }
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      message: "Launch configuration deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete launch config", error: error.message });
  }
}

// ==================================================
// FETCH REAL SHOPIFY STORE PRODUCTS FOR SELECTOR
// GET /api/pre-orders/products
// ==================================================
async function getStoreProductsForLaunch(req, res) {
  try {
    await ensureConnected();
    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const shop = normalizeShop(rawShop);
    const search = String(req.query.search || "").trim();

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    const accessToken = await getShopifyAccessToken(shop);
    if (!accessToken) {
      return res.status(401).json({ success: false, message: "No access token found for store." });
    }

    const queryFilter = search ? `title:*${search.replace(/['"\\]/g, "")}*` : null;

    const gql = `
      query getProducts($query: String) {
        products(first: 50, query: $query, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
              variants(first: 30) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    const shopifyRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: gql,
        variables: { query: queryFilter },
      }),
    });

    const data = await shopifyRes.json();
    const productEdges = data?.data?.products?.edges || [];

    const products = productEdges.map((edge) => {
      const p = edge.node;
      const cleanId = normalizeProductId(p.id);
      const variants = (p.variants?.edges || []).map((v) => ({
        id: normalizeProductId(v.node.id),
        shopifyGid: v.node.id,
        title: v.node.title,
        price: v.node.price,
        sku: v.node.sku || "",
        stock: v.node.inventoryQuantity ?? 0,
      }));

      return {
        id: cleanId,
        shopifyGid: p.id,
        title: p.title,
        handle: p.handle,
        image: p.featuredImage?.url || "",
        variants,
        variantsCount: variants.length,
      };
    });

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get Products For Launch Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch store products", error: error.message });
  }
}

module.exports = {
  getPreOrders,
  syncPreOrdersController,
  syncShopifyPreOrders,
  handleOrderWebhook,
  updatePreOrderStatus,
  deletePreOrder,
  getLaunchConfigs,
  getLaunchConfigByProduct,
  saveLaunchConfig,
  toggleLaunchConfig,
  deleteLaunchConfig,
  getStoreProductsForLaunch,
};

