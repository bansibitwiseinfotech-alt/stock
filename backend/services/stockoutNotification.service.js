const mongoose = require("mongoose");
const StockoutNotification = require("../models/StockoutNotification");
const emailService = require("./smtpService");
const connectDB = require("../config/mongodb");

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

/**
 * Process notifications when stock for a variant becomes > 0 or admin triggers restock
 * Identifies PENDING subscriptions for exact shop + variantId,
 * dispatches real back-in-stock emails, and marks as NOTIFIED only upon verified provider acceptance.
 */
async function processBackInStockNotifications(shop, variantId, currentStock = 10) {
  try {
    await ensureConnected();
    const cleanShop = normalizeShop(shop);
    const cleanVariant = normalizeVariantId(variantId);
    const stock = Number(currentStock || 0);

    console.log(`[BackInStock] Restock requested for shop: ${cleanShop}, variant: ${cleanVariant}, quantity: ${stock}`);

    if (!cleanShop || !cleanVariant || stock <= 0) {
      console.warn(`[BackInStock] Invalid restock parameters: shop=${cleanShop}, variant=${cleanVariant}, stock=${stock}`);
      return {
        success: false,
        processed: 0,
        sent: 0,
        failed: 0,
        results: [],
        message: "Valid shop, variantId, and positive restock quantity are required",
      };
    }

    const shopRegex = new RegExp(`^${cleanShop}$`, "i");

    // Fetch all active PENDING subscribers for this variant
    const pendingSubscriptions = await StockoutNotification.find({
      shop: shopRegex,
      $or: [
        { variantId: cleanVariant },
        { variantId: `gid://shopify/ProductVariant/${cleanVariant}` },
      ],
      status: "PENDING",
    });

    console.log(`[BackInStock] Pending subscribers found: ${pendingSubscriptions.length}`);

    if (pendingSubscriptions.length === 0) {
      return {
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        results: [],
        message: "No pending subscribers found for this variant",
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (const sub of pendingSubscriptions) {
      // Atomic lease: transition from PENDING -> PROCESSING to prevent race conditions
      const leasedSub = await StockoutNotification.findOneAndUpdate(
        {
          _id: sub._id,
          status: "PENDING",
        },
        {
          $set: { status: "PROCESSING" },
        },
        { new: true }
      );

      if (!leasedSub) {
        // Already claimed/processed by another concurrent restock execution
        continue;
      }

      const masked = emailService.maskEmail(leasedSub.email);
      console.log(`[BackInStock] Sending email to: ${masked} (Variant: ${cleanVariant})`);

      try {
        const emailResult = await emailService.sendBackInStockEmail({
          to: leasedSub.email,
          shop: cleanShop,
          productTitle: leasedSub.productTitle || "Product",
          variantTitle: leasedSub.variantTitle || "",
          productHandle: leasedSub.productHandle || "",
          variantId: cleanVariant,
          currentStock: stock,
        });

        if (emailResult.success && emailResult.messageId) {
          // Email provider accepted message: atomically mark NOTIFIED
          await StockoutNotification.updateOne(
            { _id: leasedSub._id },
            {
              $set: {
                status: "NOTIFIED",
                notifiedAt: new Date(),
                lastError: null,
              },
            }
          );

          successCount++;
          console.log(
            `[BackInStock] Email provider accepted message (${emailResult.messageId}). Subscriber marked NOTIFIED: ${masked}`
          );

          results.push({
            email: leasedSub.email,
            success: true,
            messageId: emailResult.messageId,
          });
        } else {
          // Delivery rejected or failed: revert back to PENDING
          const errReason = emailResult.error || "Email provider rejected submission";
          await StockoutNotification.updateOne(
            { _id: leasedSub._id },
            {
              $set: {
                status: "PENDING",
                lastError: errReason,
              },
              $inc: { retryCount: 1 },
            }
          );

          failureCount++;
          console.warn(`[BackInStock] Email send failed for ${masked}: ${errReason}. Subscriber remains PENDING.`);

          results.push({
            email: leasedSub.email,
            success: false,
            error: errReason,
          });
        }
      } catch (sendErr) {
        await StockoutNotification.updateOne(
          { _id: leasedSub._id },
          {
            $set: {
              status: "PENDING",
              lastError: sendErr.message,
            },
            $inc: { retryCount: 1 },
          }
        ).catch(() => {});

        failureCount++;
        console.error(
          `[BackInStock] Unexpected error sending email to ${masked}: ${sendErr.message}. Subscriber remains PENDING.`
        );

        results.push({
          email: leasedSub.email,
          success: false,
          error: sendErr.message,
        });
      }
    }

    return {
      success: failureCount === 0 || successCount > 0,
      processed: pendingSubscriptions.length,
      sent: successCount,
      failed: failureCount,
      results,
      shop: cleanShop,
      variantId: cleanVariant,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("[BackInStock] Critical error in processBackInStockNotifications:", error);
    return {
      success: false,
      processed: 0,
      sent: 0,
      failed: 1,
      results: [{ error: error.message }],
      error: error.message,
    };
  }
}

/**
 * Get paginated list of notification requests for merchant dashboard
 */
async function getNotificationsList(shop, { status, search, productId, variantId, page = 1, limit = 50 }) {
  await ensureConnected();
  const cleanShop = normalizeShop(shop);
  if (!cleanShop) throw new Error("Shop domain is required");

  const query = {
    $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
  };

  if (status && status !== "ALL") {
    query.status = status.toUpperCase();
  }

  if (productId) {
    query.productId = normalizeVariantId(productId);
  }

  if (variantId) {
    const cleanVar = normalizeVariantId(variantId);
    query.$and = [
      {
        $or: [
          { variantId: cleanVar },
          { variantId: `gid://shopify/ProductVariant/${cleanVar}` },
        ],
      },
    ];
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { email: searchRegex },
      { productTitle: searchRegex },
      { variantTitle: searchRegex },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;

  const [items, total, pendingCount, notifiedCount] = await Promise.all([
    StockoutNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
    StockoutNotification.countDocuments(query),
    StockoutNotification.countDocuments({
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      status: "PENDING",
    }),
    StockoutNotification.countDocuments({
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
      status: "NOTIFIED",
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    },
    counts: {
      total,
      pending: pendingCount,
      notified: notifiedCount,
    },
  };
}

/**
 * Cancel a notification request
 */
async function cancelNotification(shop, notificationId) {
  await ensureConnected();
  const cleanShop = normalizeShop(shop);
  const updated = await StockoutNotification.findOneAndUpdate(
    {
      _id: notificationId,
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    },
    { $set: { status: "CANCELLED" } },
    { new: true }
  );

  return updated;
}

/**
 * Delete a notification request completely
 */
async function deleteNotification(shop, notificationId) {
  await ensureConnected();
  const cleanShop = normalizeShop(shop);
  const deleted = await StockoutNotification.findOneAndDelete({
    _id: notificationId,
    $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
  });

  return deleted;
}

module.exports = {
  processBackInStockNotifications,
  getNotificationsList,
  cancelNotification,
  deleteNotification,
  sendConfirmationEmail: emailService.sendConfirmationEmail,
};
