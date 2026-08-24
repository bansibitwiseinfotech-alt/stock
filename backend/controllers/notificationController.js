const {
  getNotificationsList,
  cancelNotification,
  deleteNotification,
  processBackInStockNotifications,
} = require("../services/stockoutNotification.service");
const { restockShopifyVariantInventory } = require("../services/shopifyInventoryService");

function getShop(req) {
  return (
    req.query.shop ||
    req.body.shop ||
    req.headers["x-shopify-shop-domain"] ||
    req.headers["x-shop-domain"] ||
    ""
  );
}

/**
 * GET /api/notifications
 * List back-in-stock subscriber requests with filters and pagination
 */
async function listNotifications(req, res) {
  try {
    const shop = getShop(req);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop parameter is required",
      });
    }

    const { status, search, productId, variantId, page, limit } = req.query;

    const result = await getNotificationsList(shop, {
      status,
      search,
      productId,
      variantId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      counts: result.counts,
    });
  } catch (error) {
    console.error("[BackInStock Controller] List Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notification requests",
      error: error.message,
    });
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete or cancel a notification request
 */
async function removeNotification(req, res) {
  try {
    const shop = getShop(req);
    const { id } = req.params;

    if (!shop || !id) {
      return res.status(400).json({
        success: false,
        message: "Shop and notification ID are required",
      });
    }

    const hardDelete = req.query.hard === "true";
    let result;

    if (hardDelete) {
      result = await deleteNotification(shop, id);
    } else {
      result = await cancelNotification(shop, id);
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Notification request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: hardDelete
        ? "Notification request permanently deleted"
        : "Notification request cancelled",
      data: result,
    });
  } catch (error) {
    console.error("[BackInStock Controller] Remove Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification request",
      error: error.message,
    });
  }
}

function getAccessToken(req) {
  return (
    req.headers["x-shopify-access-token"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    ""
  );
}

/**
 * POST /api/notifications/test-restock
 * 1. Restock REAL Shopify inventory via GraphQL Admin API
 * 2. If Shopify inventory update succeeds, dispatch back-in-stock emails to pending subscribers
 * 3. Only mark as NOTIFIED after email delivery succeeds
 */
async function triggerRestock(req, res) {
  try {
    const shop = getShop(req);
    const variantId = req.body.variantId || req.body.variant_id;
    const rawQuantity = req.body.quantity !== undefined ? req.body.quantity : req.body.currentStock;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required",
      });
    }

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    if (rawQuantity === undefined || rawQuantity === null || rawQuantity === "") {
      return res.status(400).json({
        success: false,
        message: "Restock quantity is required and must be a positive integer",
      });
    }

    const quantity = Number(rawQuantity);
    if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Restock quantity must be a positive integer",
      });
    }

    console.log(`[BackInStock Controller] Trigger Restock requested: Shop=${shop}, Variant=${variantId}, Quantity=${quantity}`);

    // Step 1: Update REAL Shopify inventory
    const accessToken = getAccessToken(req);
    const inventoryResult = await restockShopifyVariantInventory(shop, variantId, quantity, accessToken);

    console.log(`[BackInStock Controller] Real Shopify inventory updated successfully. Available = ${inventoryResult.newStock}`);

    // Step 2: Dispatch emails to pending waitlist subscribers
    const notifResult = await processBackInStockNotifications(shop, variantId, inventoryResult.newStock);

    const isSuccess = notifResult.failed === 0;

    const summaryMessage =
      notifResult.processed === 0
        ? `Shopify inventory updated to ${inventoryResult.newStock} units. No pending subscribers for this variant.`
        : `Shopify inventory restocked to ${inventoryResult.newStock} units. ${notifResult.sent} email(s) sent successfully${
            notifResult.failed > 0 ? `, ${notifResult.failed} failed` : ""
          }.`;

    return res.status(isSuccess ? 200 : 207).json({
      success: isSuccess,
      inventory: inventoryResult,
      processed: notifResult.processed,
      sent: notifResult.sent,
      failed: notifResult.failed,
      results: notifResult.results || [],
      message: summaryMessage,
      data: {
        inventory: inventoryResult,
        notifications: notifResult,
      },
    });
  } catch (error) {
    console.error("[BackInStock Controller] Trigger Restock Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Failed to process restock: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * POST /api/notifications/webhook/inventory-update
 * Handle webhook from Shopify inventory_levels/update
 */
async function handleInventoryWebhook(req, res) {
  try {
    const shop = getShop(req);
    const { inventoryItemId, available } = req.body;

    const stock = Number(available || 0);
    if (!shop || !inventoryItemId || stock <= 0) {
      return res.status(200).json({ success: true, message: "No restock action required" });
    }

    const Store = require("../models/Store");
    const shopifyGraphQL = require("../services/shopifyGraphql");

    const store = await Store.findOne({
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
    }).lean();

    if (store?.accessToken) {
      const query = `
        query GetVariantByInventoryItem($id: ID!) {
          inventoryItem(id: $id) {
            variant {
              id
              title
              product {
                id
                title
              }
            }
          }
        }
      `;

      const gid = `gid://shopify/InventoryItem/${inventoryItemId}`;
      const data = await shopifyGraphQL(shop, store.accessToken, query, { id: gid });
      const variantNode = data?.inventoryItem?.variant;

      if (variantNode?.id) {
        const variantId = variantNode.id.match(/(\d+)$/)?.[1] || variantNode.id;
        const result = await processBackInStockNotifications(shop, variantId, stock);
        return res.status(200).json({ success: true, data: result });
      }
    }

    return res.status(200).json({ success: true, message: "Inventory webhook acknowledged" });
  } catch (error) {
    console.error("[BackInStock Controller] Inventory Webhook Processing Error:", error);
    return res.status(200).json({ success: true, error: error.message });
  }
}

module.exports = {
  listNotifications,
  removeNotification,
  triggerRestock,
  handleInventoryWebhook,
};
