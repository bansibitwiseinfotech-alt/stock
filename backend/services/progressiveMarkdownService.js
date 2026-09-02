const MarkdownRule = require("../models/MarkdownRule");
const DeadStockAction = require("../models/DeadStockAction");
const Store = require("../models/Store");
const shopifyGraphQL = require("./shopifyGraphql");

const VARIANT_QUERY = `
query getVariant($id: ID!) {
  productVariant(id: $id) {
    id
    price
    compareAtPrice
    inventoryQuantity
    availableForSale
    product {
      id
      title
    }
  }
}
`;

const UPDATE_VARIANT_PRICE_MUTATION = `
mutation UpdateVariantPrice(
  $productId: ID!
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId
    variants: $variants
  ) {
    productVariants {
      id
      price
      compareAtPrice
    }
    userErrors {
      field
      message
    }
  }   
}
`;

const RECENT_ORDERS_QUERY = `
query getRecentOrders($first: Int!, $query: String!) {
  orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        createdAt
        cancelledAt
        lineItems(first: 50) {
          nodes {
            quantity
            variant {
              id
            }
            product {
              id
            }
          }
        }
      }
    }
  }
}
`;

function ensureGid(id, type = "Product") {
  if (!id) return "";
  const value = String(id).trim();
  if (value.startsWith("gid://shopify/")) {
    return value;
  }
  const numericId = value.replace(/\D/g, "");
  if (!numericId) {
    throw new Error(`Invalid ${type} ID: ${id}`);
  }
  return `gid://shopify/${type}/${numericId}`;
}

function cleanIdNumber(id) {
  if (!id) return "";
  return String(id).replace(/\D/g, "");
}

function roundPrice(price) {
  return Math.round((Number(price) + Number.EPSILON) * 100) / 100;
}

function calculateMarkdownPrice(originalPrice, discountPercent) {
  const price = Number(originalPrice);
  const discount = Number(discountPercent);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid original price");
  }

  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new Error("Invalid discount percentage");
  }

  return roundPrice(price - (price * discount) / 100);
}

/**
 * Validates Progressive Markdown configuration settings.
 * Enforces mandatory 5% - 50% strict range and min <= start <= max.
 */
function validateMarkdownSettings({
  startingDiscount = 10,
  increasePercent = 10,
  decreasePercent = 3,
  minimumDiscount = 5,
  maximumDiscount = 50,
}) {
  const start = Number(startingDiscount);
  const inc = Number(increasePercent);
  const dec = Number(decreasePercent);
  const min = Number(minimumDiscount);
  const max = Number(maximumDiscount);

  if (isNaN(start) || start < 5 || start > 50) {
    throw new Error("Starting discount must be between 5% and 50%.");
  }
  if (isNaN(min) || min < 5 || min > 50) {
    throw new Error("Minimum discount must be between 5% and 50%.");
  }
  if (isNaN(max) || max < 5 || max > 50) {
    throw new Error("Maximum discount must be between 5% and 50%.");
  }
  if (isNaN(inc) || inc < 0 || inc > 50) {
    throw new Error("Increase by percentage must be between 0% and 50%.");
  }
  if (isNaN(dec) || dec < 0 || dec > 50) {
    throw new Error("Decrease by percentage must be between 0% and 50%.");
  }
  if (min > max) {
    throw new Error("Minimum discount cannot be greater than maximum discount.");
  }
  if (start < min || start > max) {
    throw new Error("Starting discount must be between minimum and maximum discount.");
  }

  return {
    startingDiscount: start,
    increasePercent: inc,
    decreasePercent: dec,
    minimumDiscount: min,
    maximumDiscount: max,
  };
}

/**
 * Calculates new discount based on 24h sales performance.
 * Case 1: 0 units sold -> increase discount by increasePercent (capped at maximumDiscount)
 * Case 2: 1 unit sold  -> keep discount unchanged (status = NO_CHANGE)
 * Case 3: 2+ units sold -> decrease discount by decreasePercent (floored at minimumDiscount)
 */
function calculateNextDiscount({
  currentDiscount,
  unitsSold,
  increasePercent,
  decreasePercent,
  minimumDiscount,
  maximumDiscount,
}) {
  const current = Number(currentDiscount);
  const sales = Number(unitsSold) || 0;
  const inc = Number(increasePercent);
  const dec = Number(decreasePercent);
  const min = Number(minimumDiscount);
  const max = Number(maximumDiscount);

  if (sales === 0) {
    const raw = current + inc;
    const bounded = Math.min(raw, max);
    return {
      newDiscount: bounded,
      reason: raw > max ? "NO_SALES_MAX_DISCOUNT" : "NO_SALES",
      actionStatus: bounded === current ? "NO_CHANGE" : "SUCCESS",
    };
  }

  if (sales === 1) {
    return {
      newDiscount: current,
      reason: "ONE_SALE",
      actionStatus: "NO_CHANGE",
    };
  }

  // 2+ units sold
  const raw = current - dec;
  const bounded = Math.max(raw, min);
  return {
    newDiscount: bounded,
    reason: raw < min ? "STRONG_SALES_MIN_DISCOUNT" : "STRONG_SALES",
    actionStatus: bounded === current ? "NO_CHANGE" : "SUCCESS",
  };
}

/**
 * Fetch current Shopify variant details.
 */
async function getShopifyVariant(shop, accessToken, variantId) {
  const formattedVariantId = ensureGid(variantId, "ProductVariant");

  const data = await shopifyGraphQL(
    shop,
    accessToken,
    VARIANT_QUERY,
    { id: formattedVariantId }
  );

  const variant = data?.productVariant;
  if (!variant) {
    throw new Error(`Shopify variant not found: ${formattedVariantId}`);
  }

  return variant;
}

/**
 * Update actual Shopify variant price directly using productVariantsBulkUpdate.
 * Includes automated retry mechanism (up to 3 attempts) for network resilience.
 */
async function updateShopifyVariantPrice({
  shop,
  accessToken,
  productId,
  variantId,
  price,
  compareAtPrice,
}) {
  const formattedProductId = ensureGid(productId, "Product");
  const formattedVariantId = ensureGid(variantId, "ProductVariant");

  const formattedPrice = Number(price).toFixed(2);

  const variantInput = {
    id: formattedVariantId,
    price: formattedPrice,
  };

  if (compareAtPrice !== undefined) {
    variantInput.compareAtPrice =
      compareAtPrice === null
        ? null
        : Number(compareAtPrice).toFixed(2);
  }

  let lastError = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await shopifyGraphQL(
        shop,
        accessToken,
        UPDATE_VARIANT_PRICE_MUTATION,
        {
          productId: formattedProductId,
          variants: [variantInput],
        }
      );

      const result = data?.productVariantsBulkUpdate;

      if (!result) {
        throw new Error("Invalid response from Shopify price update.");
      }

      if (result.userErrors?.length) {
        const errors = result.userErrors
          .map((error) => {
            const field = error.field ? `${error.field.join(".")}: ` : "";
            return `${field}${error.message}`;
          })
          .join(", ");

        throw new Error(`Shopify price update failed: ${errors}`);
      }

      const updatedVariant = result.productVariants?.[0];
      if (!updatedVariant) {
        throw new Error("Shopify did not return the updated product variant.");
      }

      return updatedVariant;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Brief exponential backoff before retry
        await new Promise((res) => setTimeout(res, attempt * 500));
      }
    }
  }

  throw lastError || new Error("Shopify price update failed after 3 attempts.");
}

/**
 * Determines exact number of units sold for a product variant in the last 24 hours.
 * Authoritative: checks local Order sync + live Shopify GraphQL Orders API.
 */
async function getUnitsSoldLast24Hours(shop, accessToken, variantId, productId = "") {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const cleanVarNum = cleanIdNumber(variantId);
    const formattedVarId = ensureGid(variantId, "ProductVariant");
    const cleanProdNum = cleanIdNumber(productId);
    const formattedProdId = productId ? ensureGid(productId, "Product") : "";

    let totalSold = 0;

    // 1. Check local MongoDB Order collection
    try {
      const orders = await Order.find({
        shop,
        orderDate: { $gte: twentyFourHoursAgo },
      }).lean();

      if (orders && orders.length > 0) {
        for (const o of orders) {
          if (!Array.isArray(o.items)) continue;
          for (const item of o.items) {
            const itemVar = cleanIdNumber(item.variantId);
            const itemProd = cleanIdNumber(item.productId);
            if (
              (cleanVarNum && itemVar === cleanVarNum) ||
              (cleanProdNum && itemProd === cleanProdNum && !itemVar)
            ) {
              totalSold += Number(item.quantity || 0);
            }
          }
        }
        return totalSold;
      }
    } catch (dbErr) {
      console.warn("[ProgressiveMarkdown] DB Order query warning:", dbErr.message);
    }

    // 2. Query Shopify GraphQL Orders API if token is provided
    if (shop && accessToken) {
      try {
        const queryFilter = `created_at:>=${twentyFourHoursAgo.toISOString()}`;
        const data = await shopifyGraphQL(
          shop,
          accessToken,
          RECENT_ORDERS_QUERY,
          { first: 50, query: queryFilter }
        );

        const edges = data?.orders?.edges || [];
        for (const edge of edges) {
          const order = edge?.node;
          if (order?.cancelledAt) continue;
          const lineItems = order?.lineItems?.nodes || [];
          for (const item of lineItems) {
            const lineVarId = cleanIdNumber(item?.variant?.id);
            const lineProdId = cleanIdNumber(item?.product?.id);
            if (
              (cleanVarNum && lineVarId === cleanVarNum) ||
              (cleanProdNum && lineProdId === cleanProdNum && !lineVarId)
            ) {
              totalSold += Number(item?.quantity || 0);
            }
          }
        }
      } catch (gqlErr) {
        console.warn("[ProgressiveMarkdown] Shopify Orders GraphQL check warning:", gqlErr.message);
      }
    }

    return totalSold;
  } catch (err) {
    console.error("[ProgressiveMarkdown] Sales check error:", err.message);
    return 0;
  }
}

/**
 * Creates and initializes a Progressive Markdown rule for a product variant.
 * Directly applies starting discount on Shopify variant price.
 * Next evaluation is scheduled for now + 24 hours.
 */
async function createMarkdownRule(
  shop,
  accessToken,
  {
    productId,
    variantId,
    startingDiscount = 10,
    increasePercent = 10,
    incrementPercent,
    decreasePercent = 3,
    minimumDiscount = 5,
    maximumDiscount = 50,
  }
) {
  try {
    if (!shop) throw new Error("Shop domain is required.");
    if (!productId) throw new Error("Product ID is required.");
    if (!variantId) throw new Error("Variant ID is required.");

    const validated = validateMarkdownSettings({
      startingDiscount,
      increasePercent: increasePercent ?? incrementPercent ?? 10,
      decreasePercent,
      minimumDiscount,
      maximumDiscount,
    });

    const formattedProductId = ensureGid(productId, "Product");
    const formattedVariantId = ensureGid(variantId, "ProductVariant");

    let validToken = accessToken;
    if (!validToken) {
      const storeRecord = await Store.findOne({
        $or: [{ shop }, { shop: String(shop).replace(/^https?:\/\//i, "") }],
      }).lean();
      validToken = storeRecord?.accessToken;
    }

    if (!validToken) {
      throw new Error(`Shopify access token not found for ${shop}.`);
    }

    // 1. Check for existing active rule for the same variant
    const cleanVarNum = cleanIdNumber(formattedVariantId);
    const existingRule = await MarkdownRule.findOne({
      shop,
      $or: [{ status: "ACTIVE" }, { active: true }],
      $or: [
        { variantId: formattedVariantId },
        { variantId: cleanVarNum },
        { variantId: `gid://shopify/ProductVariant/${cleanVarNum}` },
      ],
    });

    if (existingRule) {
      // Update existing rule configuration
      const originalPrice = existingRule.originalPrice;
      const firstMarkdownPrice = calculateMarkdownPrice(originalPrice, validated.startingDiscount);
      const updatedVariant = await updateShopifyVariantPrice({
        shop,
        accessToken: validToken,
        productId: formattedProductId,
        variantId: formattedVariantId,
        price: firstMarkdownPrice,
        compareAtPrice: originalPrice,
      });

      const now = new Date();
      const nextEvaluationAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      existingRule.startingDiscount = validated.startingDiscount;
      existingRule.increasePercent = validated.increasePercent;
      existingRule.incrementPercent = validated.increasePercent;
      existingRule.decreasePercent = validated.decreasePercent;
      existingRule.minimumDiscount = validated.minimumDiscount;
      existingRule.maximumDiscount = validated.maximumDiscount;
      existingRule.currentDiscount = validated.startingDiscount;
      existingRule.currentPrice = Number(updatedVariant.price);
      existingRule.status = "ACTIVE";
      existingRule.active = true;
      existingRule.processing = false;
      existingRule.isProcessing = false;
      existingRule.nextEvaluationAt = nextEvaluationAt;
      existingRule.nextRunAt = nextEvaluationAt;
      existingRule.lastExecutedAt = now;
      existingRule.lastEvaluationReason = "RULE_UPDATED";
      existingRule.lastError = "";

      await existingRule.save();

      await DeadStockAction.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        actionType: "PROGRESSIVE_MARKDOWN",
        status: "ACTIVE",
        discountPercent: validated.startingDiscount,
        executedAt: now,
        error: "",
        metadata: {
          ruleId: existingRule._id,
          originalPrice: existingRule.originalPrice,
          currentPrice: Number(updatedVariant.price),
          startingDiscount: validated.startingDiscount,
          increasePercent: validated.increasePercent,
          decreasePercent: validated.decreasePercent,
          minimumDiscount: validated.minimumDiscount,
          maximumDiscount: validated.maximumDiscount,
          nextEvaluationAt,
          evaluationIntervalHours: 24,
          pricingMode: "DIRECT_VARIANT_PRICE",
        },
      }).catch(() => { });

      return {
        success: true,
        message: `Progressive markdown updated. Starting discount: ${validated.startingDiscount}%, Current price: ₹${Number(updatedVariant.price)}. Next 24h evaluation: ${nextEvaluationAt.toLocaleString()}`,
        rule: existingRule,
        price: {
          originalPrice: existingRule.originalPrice,
          currentPrice: Number(updatedVariant.price),
          discountPercent: validated.startingDiscount,
        },
      };
    }

    // 2. Fetch current Shopify variant info (capture original price before markdown)
    const variant = await getShopifyVariant(shop, validToken, formattedVariantId);
    const originalPrice = Number(variant.compareAtPrice || variant.price);

    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      throw new Error("Could not read valid Shopify variant price.");
    }

    // 3. Calculate first markdown price strictly from originalPrice
    const firstMarkdownPrice = calculateMarkdownPrice(originalPrice, validated.startingDiscount);
    if (firstMarkdownPrice < 0) {
      throw new Error("Calculated price cannot be negative.");
    }

    // 4. Update actual Shopify variant price FIRST (setting price and compareAtPrice)
    const updatedVariant = await updateShopifyVariantPrice({
      shop,
      accessToken: validToken,
      productId: formattedProductId,
      variantId: formattedVariantId,
      price: firstMarkdownPrice,
      compareAtPrice: originalPrice,
    });

    const actualCurrentPrice = Number(updatedVariant.price);
    const now = new Date();
    // Rule evaluation is scheduled strictly 24 hours later
    const nextEvaluationAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 5. Create MarkdownRule in MongoDB ONLY after Shopify price update succeeds
    const rule = await MarkdownRule.create({
      shop,
      productId: formattedProductId,
      variantId: formattedVariantId,
      actionType: "PROGRESSIVE_MARKDOWN",
      originalPrice,
      currentPrice: actualCurrentPrice,
      startingDiscount: validated.startingDiscount,
      increasePercent: validated.increasePercent,
      incrementPercent: validated.increasePercent,
      decreasePercent: validated.decreasePercent,
      minimumDiscount: validated.minimumDiscount,
      maximumDiscount: validated.maximumDiscount,
      currentDiscount: validated.startingDiscount,
      evaluationIntervalHours: 24,
      intervalDays: 1,
      status: "ACTIVE",
      active: true,
      processing: false,
      isProcessing: false,
      lastProcessingAt: now,
      lastEvaluatedAt: null,
      nextEvaluationAt,
      nextRunAt: nextEvaluationAt,
      lastExecutedAt: now,
      lastSalesCount: 0,
      lastEvaluationReason: "RULE_INITIALIZED",
      lastError: "",
    });

    // 6. Record audit action log
    await DeadStockAction.create({
      shop,
      productId: formattedProductId,
      variantId: formattedVariantId,
      actionType: "PROGRESSIVE_MARKDOWN",
      status: "ACTIVE",
      discountPercent: validated.startingDiscount,
      executedAt: now,
      error: "",
      metadata: {
        ruleId: rule._id,
        originalPrice,
        currentPrice: actualCurrentPrice,
        startingDiscount: validated.startingDiscount,
        increasePercent: validated.increasePercent,
        decreasePercent: validated.decreasePercent,
        minimumDiscount: validated.minimumDiscount,
        maximumDiscount: validated.maximumDiscount,
        nextEvaluationAt,
        evaluationIntervalHours: 24,
        pricingMode: "DIRECT_VARIANT_PRICE",
      },
    }).catch((logErr) => {
      console.warn("[ProgressiveMarkdown] Audit log warning:", logErr.message);
    });

    console.log(
      `[ProgressiveMarkdown] Enabled rule ${rule._id} for ${formattedVariantId}: ` +
      `Original ₹${originalPrice} → Current ₹${actualCurrentPrice} (${validated.startingDiscount}% discount). Next 24h evaluation: ${nextEvaluationAt.toISOString()}`
    );

    return {
      success: true,
      message: `Progressive markdown enabled. Starting discount: ${validated.startingDiscount}%, Current price: ₹${actualCurrentPrice}. Next 24h evaluation: ${nextEvaluationAt.toLocaleString()}`,
      rule,
      price: {
        originalPrice,
        currentPrice: actualCurrentPrice,
        discountPercent: validated.startingDiscount,
      },
    };
  } catch (err) {
    console.error("[ProgressiveMarkdown] Create error:", err.message);

    try {
      await DeadStockAction.create({
        shop,
        productId: ensureGid(productId, "Product"),
        variantId: ensureGid(variantId, "ProductVariant"),
        actionType: "PROGRESSIVE_MARKDOWN",
        status: "FAILED",
        discountPercent: Number(startingDiscount) || 10,
        executedAt: new Date(),
        error: err.message,
        metadata: { pricingMode: "DIRECT_VARIANT_PRICE" },
      });
    } catch { }

    return {
      success: false,
      message: err.message || "Failed to enable progressive markdown.",
    };
  }
}

/**
 * 24-Hour Evaluation Worker called periodically (every 5 mins).
 * Finds all rules where nextEvaluationAt <= now, atomically locks them, checks 24h sales,
 * applies new discount to Shopify, updates DB state, and schedules next 24h cycle.
 */
async function processActiveMarkdownRules(shop = null) {
  try {
    const now = new Date();
    // Stale lock threshold: 15 minutes
    const lockExpiryWindow = new Date(now.getTime() - 15 * 60 * 1000);

    const queryFilter = {
      $or: [{ status: "ACTIVE" }, { active: true }],
      $or: [
        { nextEvaluationAt: { $lte: now } },
        { nextRunAt: { $lte: now } },
      ],
      $or: [
        { processing: false, isProcessing: false },
        { processing: { $exists: false } },
        { lastProcessingAt: { $lt: lockExpiryWindow } },
      ],
    };

    if (shop) {
      queryFilter.shop = shop;
    }

    const dueRules = await MarkdownRule.find(queryFilter).lean();
    if (!dueRules.length) {
      return { success: true, processed: 0 };
    }


    let processed = 0;

    for (const rawRule of dueRules) {
      // Atomic MongoDB acquisition lock to prevent concurrent executions
      const rule = await MarkdownRule.findOneAndUpdate(
        {
          _id: rawRule._id,
          $or: [{ status: "ACTIVE" }, { active: true }],
          $or: [
            { processing: false, isProcessing: false },
            { processing: { $exists: false } },
            { lastProcessingAt: { $lt: lockExpiryWindow } },
          ],
        },
        {
          $set: {
            processing: true,
            isProcessing: true,
            processingStartedAt: now,
            lastProcessingAt: now,
          },
        },
        { returnDocument: "after" }
      );

      if (!rule) {
        // Skipped: another concurrent worker already acquired this rule
        continue;
      }

      try {
        const store = await Store.findOne({
          $or: [{ shop: rule.shop }, { shop: String(rule.shop).replace(/^https?:\/\//i, "") }],
        }).lean();

        if (!store?.accessToken) {
          throw new Error(`Shopify access token not found for shop ${rule.shop}`);
        }

        const accessToken = store.accessToken;

        // Legacy / Migration safety check: ensure originalPrice is valid
        if (!Number.isFinite(rule.originalPrice) || rule.originalPrice <= 0) {
          console.warn(
            `[ProgressiveMarkdown Worker] Rule ${rule._id} missing originalPrice. Skipping to prevent price corruption.`
          );
          rule.processing = false;
          rule.isProcessing = false;
          rule.lastError = "Migration required: originalPrice is missing or invalid.";
          await rule.save();
          continue;
        }

        // Fetch current variant from Shopify
        const variant = await getShopifyVariant(rule.shop, accessToken, rule.variantId);
        const currentStock = Number(variant.inventoryQuantity ?? 0);
        const availableForSale = variant.availableForSale !== false;

        // 1. Stock = 0 check: if inventory reached 0, complete rule
        if (currentStock <= 0 || !availableForSale) {
          rule.status = "COMPLETED";
          rule.active = false;
          rule.processing = false;
          rule.isProcessing = false;
          rule.nextEvaluationAt = null;
          rule.nextRunAt = null;
          rule.lastEvaluatedAt = now;
          rule.lastExecutedAt = now;
          rule.lastEvaluationReason = "OUT_OF_STOCK";
          rule.lastError = "";
          await rule.save();

          await DeadStockAction.create({
            shop: rule.shop,
            productId: rule.productId,
            variantId: rule.variantId,
            actionType: "PROGRESSIVE_MARKDOWN",
            status: "COMPLETED",
            discountPercent: rule.currentDiscount,
            executedAt: now,
            metadata: {
              ruleId: rule._id,
              reason: "OUT_OF_STOCK",
              currentStock,
              pricingMode: "DIRECT_VARIANT_PRICE",
            },
          }).catch(() => { });


          processed++;
          continue;
        }

        // 2. Query 24-hour sales for this product variant
        const unitsSoldLast24Hours = await getUnitsSoldLast24Hours(
          rule.shop,
          accessToken,
          rule.variantId,
          rule.productId
        );

        // 3. Decision Engine: calculate next discount
        const { newDiscount, reason, actionStatus } = calculateNextDiscount({
          currentDiscount: rule.currentDiscount,
          unitsSold: unitsSoldLast24Hours,
          increasePercent: rule.increasePercent ?? rule.incrementPercent ?? 5,
          decreasePercent: rule.decreasePercent ?? 5,
          minimumDiscount: rule.minimumDiscount ?? 5,
          maximumDiscount: rule.maximumDiscount ?? 50,
        });

        // 4. Update Shopify variant price if discount changed
        let actualPrice = rule.currentPrice;
        if (newDiscount !== rule.currentDiscount) {
          const nextPrice = calculateMarkdownPrice(rule.originalPrice, newDiscount);

          console.log(
            `[ProgressiveMarkdown Worker] Updating price for rule ${rule._id} (${reason}): ` +
            `${rule.currentDiscount}% → ${newDiscount}% (₹${rule.originalPrice} → ₹${nextPrice})`
          );

          const updatedVariant = await updateShopifyVariantPrice({
            shop: rule.shop,
            accessToken,
            productId: rule.productId,
            variantId: rule.variantId,
            price: nextPrice,
            compareAtPrice: rule.originalPrice,
          });

          actualPrice = Number(updatedVariant.price);
        } else {

        }

        // 5. Update DB record and schedule next 24h evaluation
        const nextEval = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        rule.currentDiscount = newDiscount;
        rule.currentPrice = actualPrice;
        rule.lastEvaluatedAt = now;
        rule.lastExecutedAt = now;
        rule.nextEvaluationAt = nextEval;
        rule.nextRunAt = nextEval;
        rule.lastSalesCount = unitsSoldLast24Hours;
        rule.lastEvaluationReason = reason;
        rule.lastError = "";
        rule.processing = false;
        rule.isProcessing = false;
        rule.status = "ACTIVE";
        rule.active = true;

        await rule.save();

        // 6. Record audit action log
        await DeadStockAction.create({
          shop: rule.shop,
          productId: rule.productId,
          variantId: rule.variantId,
          actionType: "PROGRESSIVE_MARKDOWN",
          status: actionStatus,
          discountPercent: newDiscount,
          executedAt: now,
          metadata: {
            ruleId: rule._id,
            oldDiscount: rawRule.currentDiscount,
            newDiscount,
            unitsSoldLast24Hours,
            reason,
            originalPrice: rule.originalPrice,
            currentPrice: actualPrice,
            nextEvaluationAt: nextEval,
            pricingMode: "DIRECT_VARIANT_PRICE",
          },
        }).catch(() => { });



        processed++;
      } catch (ruleErr) {
        console.error(`[ProgressiveMarkdown Worker] Rule ${rule._id} failed:`, ruleErr.message);

        // Release lock on failure without corrupting current discount
        rule.processing = false;
        rule.isProcessing = false;
        rule.lastError = ruleErr.message || "Unknown error";
        await rule.save().catch(() => { });

        await DeadStockAction.create({
          shop: rule.shop,
          productId: rule.productId,
          variantId: rule.variantId,
          actionType: "PROGRESSIVE_MARKDOWN",
          status: "FAILED",
          discountPercent: rule.currentDiscount,
          executedAt: now,
          error: ruleErr.message,
          metadata: { pricingMode: "DIRECT_VARIANT_PRICE", ruleId: rule._id },
        }).catch(() => { });
      }
    }

    return { success: true, processed };
  } catch (err) {
    console.error("[ProgressiveMarkdown Worker] General worker error:", err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Manually stop Progressive Markdown:
 * Restores actual Shopify variant price to originalPrice, clears compareAtPrice, and marks rule COMPLETED.
 */
async function stopMarkdownRule(shop, ruleIdOrVariantId, accessToken = null, extraIds = {}) {
  try {
    if (!shop) throw new Error("Shop domain is required.");
    if (!ruleIdOrVariantId && !extraIds?.productId && !extraIds?.variantId) {
      throw new Error("Rule ID, Variant ID, or Product ID is required.");
    }

    const isObjectId =
      String(ruleIdOrVariantId).trim().length === 24 &&
      /^[0-9a-fA-F]{24}$/.test(String(ruleIdOrVariantId).trim());
    const cleanId = ruleIdOrVariantId ? String(ruleIdOrVariantId).replace(/\D/g, "") : "";
    const extraCleanProd = extraIds?.productId ? String(extraIds.productId).replace(/\D/g, "") : "";
    const extraCleanVar = extraIds?.variantId ? String(extraIds.variantId).replace(/\D/g, "") : "";
    const extraRuleId = extraIds?.ruleId || "";

    const allCleanIds = [cleanId, extraCleanProd, extraCleanVar].filter(Boolean);

    let validToken = accessToken;
    if (!validToken) {
      const storeRecord = await Store.findOne({
        $or: [{ shop }, { shop: String(shop).replace(/^https?:\/\//i, "") }],
      }).lean();
      validToken = storeRecord?.accessToken;
    }

    if (!validToken) {
      throw new Error(`Shopify access token not found for ${shop}.`);
    }

    const shopFilter = {
      $or: [
        { shop },
        { shop: String(shop).replace(/^https?:\/\//i, "") },
        { shop: new RegExp(`^${shop}$`, "i") },
      ],
    };

    const idOrList = [];
    if (isObjectId) idOrList.push({ _id: ruleIdOrVariantId });
    if (extraRuleId && String(extraRuleId).length === 24) idOrList.push({ _id: extraRuleId });
    if (ruleIdOrVariantId) {
      idOrList.push(
        { variantId: ruleIdOrVariantId },
        { productId: ruleIdOrVariantId }
      );
    }
    for (const cId of allCleanIds) {
      idOrList.push(
        { variantId: `gid://shopify/ProductVariant/${cId}` },
        { variantId: cId },
        { variantId: { $regex: cId } },
        { productId: `gid://shopify/Product/${cId}` },
        { productId: cId },
        { productId: { $regex: cId } }
      );
    }

    const idFilter = { $or: idOrList };

    const rules = await MarkdownRule.find({
      $and: [shopFilter, idFilter],
    }).sort({ active: -1, createdAt: -1 });

    let restoredPrice = null;

    if (!rules || rules.length === 0) {
      try {
        const targetVarGid = cleanId ? `gid://shopify/ProductVariant/${cleanId}` : "";
        if (targetVarGid) {
          const liveVar = await getShopifyVariant(shop, validToken, targetVarGid).catch(() => null);
          if (liveVar && liveVar.compareAtPrice) {
            await updateShopifyVariantPrice({
              shop,
              accessToken: validToken,
              productId: liveVar.product?.id || `gid://shopify/Product/${cleanId}`,
              variantId: targetVarGid,
              price: Number(liveVar.compareAtPrice),
              compareAtPrice: null,
            });
          }
        }
      } catch (err) {
        console.warn("[ProgressiveMarkdown] Fallback variant check skipped:", err.message);
      }
    } else {
      for (const rule of rules) {
        const priceToRestore =
          Number.isFinite(rule.originalPrice) && rule.originalPrice > 0
            ? rule.originalPrice
            : null;

        if (priceToRestore) {
          const updatedVariant = await updateShopifyVariantPrice({
            shop,
            accessToken: validToken,
            productId: rule.productId,
            variantId: rule.variantId,
            price: priceToRestore,
            compareAtPrice: null,
          }).catch((err) => {
            console.warn("[ProgressiveMarkdown] Restore variant price error:", err.message);
            return null;
          });

          if (updatedVariant) {
            restoredPrice = Number(updatedVariant.price);
          }
        }
      }
    }

    // Permanently deactivate all matching markdown rules in DB
    await MarkdownRule.updateMany(
      {
        $and: [shopFilter, idFilter],
      },
      {
        $set: {
          status: "COMPLETED",
          active: false,
          currentDiscount: 0,
          processing: false,
          isProcessing: false,
          nextEvaluationAt: null,
          nextRunAt: null,
          lastExecutedAt: new Date(),
          lastEvaluationReason: "MANUALLY_STOPPED",
          lastError: "",
        },
      }
    );

    // Also deactivate SmartBadgeAssignment and SmartBadgeApplication so storefront does not re-enable
    try {
      const SmartBadgeAssignment = require("../models/SmartBadgeAssignment");
      const SmartBadgeApplication = require("../models/SmartBadgeApplication");
      await Promise.all([
        SmartBadgeAssignment.updateMany(
          {
            $and: [shopFilter, idFilter],
            badgeType: "PROGRESSIVE_MARKDOWN",
          },
          {
            $set: { status: "REMOVED", isActive: false },
          }
        ),
        SmartBadgeApplication.updateMany(
          {
            $and: [shopFilter],
            badgeType: "PROGRESSIVE_MARKDOWN",
            productId: {
              $in: allCleanIds
                .map((c) => `gid://shopify/Product/${c}`)
                .concat(allCleanIds)
                .concat(allCleanIds.map((c) => `gid://shopify/ProductVariant/${c}`)),
            },
          },
          {
            $set: { enabled: false, active: false },
          }
        ),
      ]);
    } catch (assignErr) {
      // ignore
    }

    const targetRule = rules && rules.length > 0 ? rules[0] : null;
    const finalProdId = targetRule?.productId || (extraIds?.productId ? `gid://shopify/Product/${String(extraIds.productId).replace(/\D/g, "")}` : "");
    const finalVarId = targetRule?.variantId || (extraIds?.variantId ? `gid://shopify/ProductVariant/${String(extraIds.variantId).replace(/\D/g, "")}` : "");

    // Record audit log
    if (finalProdId || finalVarId) {
      await DeadStockAction.create({
        shop,
        productId: finalProdId,
        variantId: finalVarId,
        actionType: "PROGRESSIVE_MARKDOWN",
        status: "COMPLETED",
        discountPercent: 0,
        executedAt: new Date(),
        metadata: {
          ruleId: targetRule?._id || null,
          reason: "Markdown manually stopped and original price restored.",
          restoredPrice: restoredPrice || targetRule?.originalPrice || null,
          pricingMode: "DIRECT_VARIANT_PRICE",
        },
      }).catch(() => { });
    }

    return {
      success: true,
      message: "Progressive Markdown stopped and original price restored successfully.",
      rule: targetRule,
    };
  } catch (err) {
    console.error("[ProgressiveMarkdown] Stop error:", err.message);
    return { success: false, message: err.message || "Failed to stop markdown rule." };
  }
}

/**
 * Manually pause Progressive Markdown (keeps current discounted price on Shopify).
 */
async function pauseMarkdownRule(shop, ruleIdOrVariantId) {
  try {
    if (!shop) throw new Error("Shop domain is required.");
    const cleanId = String(ruleIdOrVariantId).replace(/\D/g, "");
    const formattedVarId = `gid://shopify/ProductVariant/${cleanId}`;
    const formattedProdId = `gid://shopify/Product/${cleanId}`;

    const shopFilter = {
      $or: [
        { shop },
        { shop: String(shop).replace(/^https?:\/\//i, "") },
        { shop: new RegExp(`^${shop}$`, "i") },
      ],
    };

    const idFilter = {
      $or: [
        ...(isObjectId ? [{ _id: ruleIdOrVariantId }] : []),
        { variantId: formattedVarId },
        { variantId: cleanId },
        { variantId: ruleIdOrVariantId },
        { productId: formattedProdId },
        { productId: cleanId },
        { productId: ruleIdOrVariantId },
        ...(cleanId ? [{ variantId: { $regex: cleanId } }, { productId: { $regex: cleanId } }] : []),
      ],
    };

    const rule = await MarkdownRule.findOneAndUpdate(
      {
        $and: [shopFilter, idFilter],
      },
      {
        $set: {
          status: "PAUSED",
          active: false,
          processing: false,
          isProcessing: false,
          nextEvaluationAt: null,
          nextRunAt: null,
          lastEvaluationReason: "MANUALLY_PAUSED",
          lastError: "",
        },
      },
      { returnDocument: "after" }
    );

    if (!rule) {
      return { success: false, message: "Markdown rule not found." };
    }

    return {
      success: true,
      message: "Progressive Markdown paused (current price kept).",
      rule,
    };
  } catch (err) {
    return { success: false, message: err.message || "Failed to pause markdown rule." };
  }
}

/**
 * List all markdown rules for a shop.
 */
async function getMarkdownRules(shop) {
  const shopFilter = {
    $or: [
      { shop },
      { shop: String(shop).replace(/^https?:\/\//i, "") },
      { shop: new RegExp(`^${shop}$`, "i") },
    ],
  };
  return await MarkdownRule.find(shopFilter).sort({ createdAt: -1 }).lean();
}

/**
 * Get single markdown rule for a variant.
 */
async function getMarkdownRuleByVariant(shop, variantId) {
  const cleanVarNum = cleanIdNumber(variantId);
  const formattedVariantId = ensureGid(variantId, "ProductVariant");

  const shopFilter = {
    $or: [
      { shop },
      { shop: String(shop).replace(/^https?:\/\//i, "") },
      { shop: new RegExp(`^${shop}$`, "i") },
    ],
  };

  return await MarkdownRule.findOne({
    $and: [
      shopFilter,
      {
        $or: [
          { variantId: formattedVariantId },
          { variantId: cleanVarNum },
          { variantId: String(variantId) },
        ],
      },
    ],
  }).lean();
}

/**
 * Safe customer-facing storefront payload for Progressive Markdown.
 */
async function getStorefrontMarkdownData(shop, productId, variantId) {
  if (!shop) return { enabled: false };

  const MarkdownConfig = require("../models/MarkdownConfig");
  const shopFilter = {
    $or: [
      { shop },
      { shop: String(shop).replace(/^https?:\/\//i, "") },
      { shop: new RegExp(`^${shop}$`, "i") },
    ],
  };

  const markdownConfig = (await MarkdownConfig.findOne(shopFilter).lean().catch(() => null)) || {
    enabled: true,
    badgeText: "{discount}% OFF",
    showStrikethroughPrice: true,
    badgeBackgroundColor: "#E53935",
    badgeTextColor: "#FFFFFF",
    priceColor: "#111111",
    strikethroughColor: "#757575",
    borderRadius: 4,
  };

  if (markdownConfig.enabled === false) {
    return { enabled: false };
  }

  const cleanVarNum = cleanIdNumber(variantId);
  const cleanProdNum = cleanIdNumber(productId);

  const orConditions = [];
  if (cleanVarNum) {
    orConditions.push(
      { variantId: cleanVarNum },
      { variantId: `gid://shopify/ProductVariant/${cleanVarNum}` },
      { variantId: String(variantId) }
    );
  }
  if (cleanProdNum) {
    orConditions.push(
      { productId: cleanProdNum },
      { productId: `gid://shopify/Product/${cleanProdNum}` },
      { productId: String(productId) }
    );
  }

  const query = {
    $and: [
      shopFilter,
      { $or: [{ status: "ACTIVE" }, { active: true }] },
      { status: { $ne: "COMPLETED" } },
      { active: { $ne: false } },
      ...(orConditions.length > 0 ? [{ $or: orConditions }] : []),
    ],
  };

  const rule = await MarkdownRule.findOne(query).sort({ createdAt: -1 }).lean();
  if (!rule || rule.currentDiscount <= 0 || rule.active === false || rule.status !== "ACTIVE") {
    return { enabled: false };
  }

  return {
    enabled: true,
    productId: rule.productId,
    variantId: rule.variantId,
    originalPrice: rule.originalPrice,
    currentPrice: rule.currentPrice,
    currentDiscount: rule.currentDiscount,
    label: "Progressive Markdown",
    nextEvaluationAt: rule.nextEvaluationAt || rule.nextRunAt,
    config: {
      badgeText: markdownConfig.badgeText || "{discount}% OFF",
      showStrikethroughPrice: markdownConfig.showStrikethroughPrice !== false,
      badgeBackgroundColor: markdownConfig.badgeBackgroundColor || "#E53935",
      badgeTextColor: markdownConfig.badgeTextColor || "#FFFFFF",
      priceColor: markdownConfig.priceColor || "#111111",
      strikethroughColor: markdownConfig.strikethroughColor || "#757575",
      borderRadius: markdownConfig.borderRadius != null ? Number(markdownConfig.borderRadius) : 4,
    },
  };
}

module.exports = {
  validateMarkdownSettings,
  calculateNextDiscount,
  calculateMarkdownPrice,
  getUnitsSoldLast24Hours,
  createMarkdownRule,
  processActiveMarkdownRules,
  processDueMarkdownRules: processActiveMarkdownRules,
  stopMarkdownRule,
  pauseMarkdownRule,
  getMarkdownRules,
  getMarkdownRuleByVariant,
  getStorefrontMarkdownData,
  updateShopifyVariantPrice,
  getShopifyVariant,
};
