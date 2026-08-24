const mongoose = require("mongoose");
const connectDB = require("../config/mongodb");
const PreOrder = require("../models/PreOrder");
const PreOrderNotificationLog = require("../models/PreOrderNotificationLog");
const LaunchPreOrder = require("../models/LaunchPreOrder");
const Product = require("../models/Product");
const HighDemand = require("../models/highDemand");
const {
  maskEmail,
  sendPreOrderDepositPaymentConfirmationEmail,
} = require("./email.service");

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

function normalizeId(id) {
  if (!id) return "";
  const match = String(id).match(/(\d+)$/);
  return match ? match[1] : String(id).trim();
}

/**
 * Extract properties/customAttributes from a line item regardless of REST or GraphQL format
 */
function getLineItemProperties(item) {
  const props = {};
  if (Array.isArray(item.properties)) {
    // REST webhook format: [{ name: "_preorder", value: "true" }]
    for (const p of item.properties) {
      if (p && p.name) {
        props[p.name] = p.value;
      }
    }
  }
  if (Array.isArray(item.customAttributes)) {
    // GraphQL webhook format: [{ key: "_preorder", value: "true" }]
    for (const p of item.customAttributes) {
      if (p && p.key) {
        props[p.key] = p.value;
      }
    }
  }
  return props;
}

/**
 * Decimal-safe round to 2 decimal places
 */
function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

/**
 * Process Shopify Order Webhook for Pre-Order Deposit Confirmation
 * Guaranteed Idempotency | Production Ready | Decimal-Safe
 */
async function processPreOrderDepositWebhook({ shop, order, topic = "orders/create" }) {
  await ensureConnected();

  const cleanShop = normalizeShop(shop);
  if (!cleanShop || !order) {
    console.warn("[PREORDER EMAIL] Invalid shop or order payload received.");
    return { success: false, reason: "Invalid payload" };
  }

  const rawOrderId = String(order.id || "");
  const cleanOrderId = normalizeId(rawOrderId);
  const orderNumber = String(order.name || (order.order_number ? `#${order.order_number}` : "") || `#${cleanOrderId}`);

  console.log(`[PREORDER EMAIL] Order received: ${orderNumber} (ID: ${cleanOrderId}) for shop ${cleanShop}`);

  // 1. Check if order is cancelled
  const isCancelled = Boolean(order.cancelled_at || order.cancelledAt);
  if (isCancelled) {
    console.log(`[PREORDER EMAIL] Order ${orderNumber} is cancelled. Skipping deposit email.`);
    return { success: false, reason: "Order is cancelled" };
  }

  // 2. Check Financial / Payment Status
  // Valid statuses for deposit payment capture: paid, partially_paid, authorized
  const financialStatus = String(
    order.financial_status || order.displayFinancialStatus || ""
  ).toLowerCase();

  const paymentGateways = Array.isArray(order.payment_gateway_names)
    ? order.payment_gateway_names
    : Array.isArray(order.paymentGatewayNames)
    ? order.paymentGatewayNames
    : [order.gateway || ""];

  const isCod = paymentGateways.some((g) => /cod|cash/i.test(String(g)));
  const isPaidOrAuthorized = ["paid", "partially_paid", "authorized"].includes(financialStatus);

  if (!isPaidOrAuthorized && !isCod) {
    console.log(
      `[PREORDER EMAIL] Order ${orderNumber} payment status '${financialStatus || "unpaid"}' is not confirmed. Skipping email.`
    );
    return { success: false, reason: `Payment not confirmed (${financialStatus})` };
  }

  // 3. Inspect Line Items for Pre-Order identification & metadata
  const rawLineItems = Array.isArray(order.line_items)
    ? order.line_items
    : Array.isArray(order.lineItems?.edges)
    ? order.lineItems.edges.map((e) => e.node)
    : [];

  const orderTags = Array.isArray(order.tags)
    ? order.tags
    : typeof order.tags === "string"
    ? order.tags.split(",").map((t) => t.trim())
    : [];

  const orderNoteAttrs = Array.isArray(order.note_attributes)
    ? order.note_attributes
    : Array.isArray(order.customAttributes)
    ? order.customAttributes
    : [];

  const isOrderTaggedPreOrder =
    orderTags.some((t) => /pre-?order/i.test(t)) ||
    orderNoteAttrs.some((a) => /pre-?order/i.test(a.name || a.key || "") || /pre-?order/i.test(a.value || ""));

  const preOrderItems = [];
  let detectedDepositPct = 50;
  let detectedLaunchDate = "";
  let detectedShippingDate = "";
  let calculatedPreOrderTotal = 0;
  let calculatedDepositPaid = 0;

  for (const item of rawLineItems) {
    const props = getLineItemProperties(item);

    const hasPreOrderProp =
      props["_preorder"] === "true" ||
      props["_preorder_launch"] === "true" ||
      props["Pre-Order"] === "true" ||
      props["preorder"] === "true" ||
      isOrderTaggedPreOrder;

    const rawItemProdId = normalizeId(item.product_id || item.product?.id || "");
    const rawItemVarId = normalizeId(item.variant_id || item.variant?.id || "");

    // Check if this product has an active Launch Pre-Order in database
    let launchDoc = null;
    if (rawItemProdId) {
      launchDoc = await LaunchPreOrder.findOne({
        shop: cleanShop,
        $or: [
          { productId: rawItemProdId },
          { productId: `gid://shopify/Product/${rawItemProdId}` },
        ],
      }).lean().catch(() => null);
    }

    if (hasPreOrderProp || launchDoc) {
      // Determine Deposit Percentage
      let itemDepositPct = 50;
      if (props["_deposit_percentage"]) {
        const parsed = parseInt(String(props["_deposit_percentage"]).replace("%", ""), 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) itemDepositPct = parsed;
      } else if (launchDoc && typeof launchDoc.depositPercentage === "number") {
        itemDepositPct = launchDoc.depositPercentage;
      }
      detectedDepositPct = itemDepositPct;

      // Extract Dates
      if (props["Launch Date"] || props["launch_date"]) {
        detectedLaunchDate = props["Launch Date"] || props["launch_date"];
      } else if (launchDoc && launchDoc.launchDate) {
        try {
          detectedLaunchDate = new Date(launchDoc.launchDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        } catch (_) {}
      }

      if (props["Estimated Shipping"] || props["estimated_shipping"]) {
        detectedShippingDate = props["Estimated Shipping"] || props["estimated_shipping"];
      } else if (launchDoc && launchDoc.shippingDate) {
        try {
          detectedShippingDate = new Date(launchDoc.shippingDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        } catch (_) {}
      }

      const itemQty = Number(item.quantity || 1);
      const rawPrice = Number(item.price || item.originalUnitPriceSet?.shopMoney?.amount || 0);

      // 1. Determine Full Product Price (Pre-Order Total)
      let itemFullPrice = 0;
      if (props["_total_price_cents"]) {
        itemFullPrice = round2(Number(props["_total_price_cents"]) / 100 / itemQty);
      } else if (rawPrice > 0) {
        // If rawPrice was discounted to the deposit amount
        if (itemDepositPct > 0 && itemDepositPct < 100 && rawPrice < 50000 && props["_deposit_cents"]) {
          itemFullPrice = round2(rawPrice / (itemDepositPct / 100));
        } else {
          itemFullPrice = rawPrice;
        }
      }

      // 2. Determine Deposit Paid Amount
      let itemDepositPaid = 0;
      if (props["_deposit_cents"]) {
        itemDepositPaid = round2(Number(props["_deposit_cents"]) / 100);
      } else {
        itemDepositPaid = round2(itemFullPrice * itemQty * (itemDepositPct / 100));
      }

      const itemTotalFull = round2(itemFullPrice * itemQty);
      const itemRemaining = Math.max(0, round2(itemTotalFull - itemDepositPaid));

      calculatedPreOrderTotal += itemTotalFull;
      calculatedDepositPaid += itemDepositPaid;

      // Resolve product image
      let itemImage = "";
      if (item.image?.src || item.image?.url) {
        itemImage = item.image.src || item.image.url;
      } else if (item.variant?.image?.url || item.product?.featuredImage?.url) {
        itemImage = item.variant?.image?.url || item.product?.featuredImage?.url;
      } else if (launchDoc && launchDoc.productImage) {
        itemImage = launchDoc.productImage;
      }

      preOrderItems.push({
        id: normalizeId(item.id),
        title: item.title || item.name || "Pre-Order Product",
        variantTitle: item.variant_title || item.variantTitle || "",
        quantity: itemQty,
        price: itemFullPrice,
        depositPct: itemDepositPct,
        depositPaid: itemDepositPaid,
        remainingBalance: itemRemaining,
        image: itemImage,
        variantId: rawItemVarId,
        productId: rawItemProdId,
        sku: item.sku || "",
      });
    }
  }

  // If no pre-order items detected, exit safely without sending email
  if (preOrderItems.length === 0) {
    console.log(`[PREORDER EMAIL] Order ${orderNumber} is a standard order (no pre-order items). No email needed.`);
    return { success: false, reason: "Not a pre-order" };
  }

  console.log(`[PREORDER EMAIL] Pre-order detected for ${orderNumber} (${preOrderItems.length} item(s)).`);

  // 4. Financial Calculations
  const currency = String(
    order.currency || order.totalPriceSet?.shopMoney?.currencyCode || "USD"
  ).toUpperCase();

  const preOrderTotal = round2(calculatedPreOrderTotal);
  const depositPaid = round2(
    calculatedDepositPaid > 0
      ? calculatedDepositPaid
      : preOrderTotal * (detectedDepositPct / 100)
  );
  const remainingBalance = Math.max(0, round2(preOrderTotal - depositPaid));

  console.log(`[PREORDER EMAIL] Deposit percentage: ${detectedDepositPct}%`);
  console.log(`[PREORDER EMAIL] Original Pre-Order total: ${currency} ${preOrderTotal}`);
  console.log(`[PREORDER EMAIL] Deposit paid: ${currency} ${depositPaid}`);
  console.log(`[PREORDER EMAIL] Remaining balance: ${currency} ${remainingBalance}`);

  // 5. Customer Email Extraction & Validation
  const customerEmail = String(
    order.customer?.email || order.email || order.contact_email || ""
  ).trim().toLowerCase();

  if (!customerEmail) {
    console.warn(`[PREORDER EMAIL] Missing customer email for order ${orderNumber}. Skipping email dispatch.`);
    return { success: false, reason: "Missing customer email" };
  }

  console.log(`[PREORDER EMAIL] Customer email: ${maskEmail(customerEmail)}`);

  const customerName =
    order.customer?.first_name || order.customer?.name
      ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
      : order.shipping_address?.name ||
        order.billing_address?.name ||
        customerEmail.split("@")[0].replace(/[._-]+/g, " ");

  // 6. Idempotency Check (Duplicate Email Protection)
  const existingLog = await PreOrderNotificationLog.findOne({
    shop: cleanShop,
    orderId: cleanOrderId,
    emailType: "DEPOSIT_CONFIRMATION",
    status: "SENT",
  }).lean().catch(() => null);

  if (existingLog) {
    console.log(
      `[PREORDER EMAIL] Duplicate webhook ignored: Deposit confirmation email already sent on ${existingLog.sentAt} for order ${orderNumber}.`
    );
    return {
      success: true,
      alreadySent: true,
      sentAt: existingLog.sentAt,
      messageId: existingLog.messageId,
    };
  }

  // 7. Send Deposit Confirmation Email
  console.log(`[PREORDER EMAIL] Sending confirmation email for ${orderNumber} to ${maskEmail(customerEmail)}...`);

  const emailResult = await sendPreOrderDepositPaymentConfirmationEmail({
    to: customerEmail,
    customerName,
    orderNumber,
    shop: cleanShop,
    items: preOrderItems,
    depositPercentage: detectedDepositPct,
    preOrderTotal,
    depositPaid,
    remainingBalance,
    launchDate: detectedLaunchDate,
    estimatedShippingDate: detectedShippingDate,
    currency,
  });

  const sentSuccess = Boolean(emailResult.success);

  // 8. Record Notification Log & PreOrder Record in Database
  await PreOrderNotificationLog.findOneAndUpdate(
    {
      shop: cleanShop,
      orderId: cleanOrderId,
      emailType: "DEPOSIT_CONFIRMATION",
    },
    {
      $set: {
        shop: cleanShop,
        orderId: cleanOrderId,
        orderNumber,
        emailType: "DEPOSIT_CONFIRMATION",
        recipient: customerEmail,
        depositPercentage: detectedDepositPct,
        depositAmount: depositPaid,
        totalAmount: preOrderTotal,
        remainingBalance,
        currency,
        status: sentSuccess ? "SENT" : "FAILED",
        provider: emailResult.provider || "smtp",
        messageId: emailResult.messageId || "",
        error: emailResult.error || "",
        sentAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  ).catch((err) => console.error("[PREORDER EMAIL] Failed recording notification log:", err.message));

  // Update PreOrder record
  await PreOrder.findOneAndUpdate(
    {
      shop: cleanShop,
      shopifyOrderId: { $in: [rawOrderId, cleanOrderId, `gid://shopify/Order/${cleanOrderId}`] },
    },
    {
      $set: {
        shop: cleanShop,
        shopifyOrderId: cleanOrderId,
        orderNumber,
        shopifyOrderName: orderNumber,
        customer: {
          id: normalizeId(order.customer?.id || ""),
          name: customerName,
          email: customerEmail,
          phone: order.customer?.phone || order.phone || "",
        },
        productId: preOrderItems[0]?.productId || "",
        variantId: preOrderItems[0]?.variantId || "",
        productTitle: preOrderItems[0]?.title || "Pre-Order Product",
        variantTitle: preOrderItems[0]?.variantTitle || "",
        sku: preOrderItems[0]?.sku || "",
        image: preOrderItems[0]?.image || "",
        quantity: preOrderItems.reduce((acc, i) => acc + (i.quantity || 1), 0),
        unitPrice: preOrderItems[0]?.price || preOrderTotal,
        totalPrice: preOrderTotal,
        currency,
        paymentStatus: `${detectedDepositPct}% DEPOSIT PAID`,
        financialStatus: order.financial_status || order.displayFinancialStatus || "PARTIALLY_PAID",
        paymentMethod: paymentGateways.join(", ") || "Credit Card / Online",
        lineItems: preOrderItems,
        confirmationEmailSent: sentSuccess,
        confirmationEmailSentAt: sentSuccess ? new Date() : null,
        source: "shopify_order",
        placedAt: order.created_at ? new Date(order.created_at) : new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  ).catch((err) => console.error("[PREORDER EMAIL] Failed updating pre-order record:", err.message));

  if (sentSuccess) {
    console.log(`[PREORDER EMAIL] Email sent successfully for order ${orderNumber} to ${maskEmail(customerEmail)}.`);
  } else {
    console.error(`[PREORDER EMAIL] Email dispatch failed for order ${orderNumber}: ${emailResult.error}`);
  }

  return {
    success: sentSuccess,
    orderNumber,
    depositPaid,
    remainingBalance,
    customerEmail: maskEmail(customerEmail),
    error: emailResult.error || null,
  };
}

module.exports = {
  processPreOrderDepositWebhook,
};
