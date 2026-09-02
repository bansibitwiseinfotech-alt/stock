const DeadStock = require("../../models/DeadStock");
const { fetchProducts } = require("../shopify/productService");
const { fetchLocations } = require("../shopify/inventoryService");
const { fetchOrders } = require("../shopify/orderService");
const {
  calculateDaysUnsold,
  calculateCashTiedUp,
  calculateSalesVelocity,
  determineStatus,
} = require("./deadStockCalculator");

async function runDeadStockEngine(shopId, accessToken, thresholdDays = 60) {
  if (!shopId || !accessToken) {
    throw new Error("Missing shopId or accessToken for Dead Stock engine sync.");
  }

  console.log(`[DeadStock] Starting Shopify sync`);
  console.log(`[DeadStock] Shop: ${shopId}`);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Fetch Shopify Data with Cursor Pagination
  const products = await fetchProducts(shopId, accessToken);
  const locations = await fetchLocations(shopId, accessToken);
  const orders = await fetchOrders(shopId, accessToken, 90);

  console.log(`[DeadStock] Products fetched: ${products.length}`);
  console.log(`[DeadStock] Locations fetched: ${locations.length}`);
  console.log(`[DeadStock] Orders fetched: ${orders.length}`);

  // Build maps for order sales history per variant ID
  const lastSoldMap = new Map();
  const sales7Map = new Map();
  const sales30Map = new Map();
  const sales60Map = new Map();

  for (const order of orders) {
    if (order.cancelledAt) continue;

    const orderDate = new Date(order.processedAt);
    const isValidDate = !isNaN(orderDate.getTime());

    for (const lineItem of order.lineItems?.nodes || []) {
      const variantId = lineItem.variant?.id;
      if (!variantId) continue;

      const qty = Number(lineItem.quantity) || 0;

      if (isValidDate) {
        const currentLastSold = lastSoldMap.get(variantId);
        if (!currentLastSold || orderDate > currentLastSold) {
          lastSoldMap.set(variantId, orderDate);
        }

        if (orderDate >= sevenDaysAgo) {
          sales7Map.set(variantId, (sales7Map.get(variantId) || 0) + qty);
        }
        if (orderDate >= thirtyDaysAgo) {
          sales30Map.set(variantId, (sales30Map.get(variantId) || 0) + qty);
        }
        if (orderDate >= sixtyDaysAgo) {
          sales60Map.set(variantId, (sales60Map.get(variantId) || 0) + qty);
        }
      }
    }
  }

  // Retrieve existing records to preserve status transitions
  const existingRecords = await DeadStock.find({ shopId }).select("variantId locationId status").lean();
  const existingStatusMap = new Map(existingRecords.map((r) => [`${r.variantId}_${r.locationId}`, r.status]));

  const bulkOps = [];
  let totalVariants = 0;
  let deadStockFoundCount = 0;
  const processedKeys = new Set();
  const activeVariantIds = new Set();

  for (const product of products) {
    const productId = product.id;
    const title = product.title || "Untitled Product";
    const image = product.featuredImage?.url || "";
    const collectionIds = (product.collections?.nodes || []).map((c) => c.id);

    for (const variant of product.variants?.nodes || []) {
      totalVariants++;
      const variantId = variant.id;
      activeVariantIds.add(variantId);

      const createdAt = variant.createdAt || product.createdAt || null;
      const unitCostAmount = Number(variant.inventoryItem?.unitCost?.amount);
      const variantPrice = Number(variant.price) || 0;
      const costPrice = Number.isFinite(unitCostAmount) && unitCostAmount > 0 ? unitCostAmount : variantPrice;

      const locationLevels = variant.inventoryItem?.inventoryLevels?.nodes || [];
      const locationId = locationLevels[0]?.location?.id || locations[0]?.id || "main-location";
      const locationName = locationLevels[0]?.location?.name || locations[0]?.name || "Main Location";
      const stock = Number(variant.inventoryQuantity) || 0;

      if (processedKeys.has(variantId)) continue;
      processedKeys.add(variantId);

      const lastSoldAt = lastSoldMap.get(variantId) || null;
      const salesLast7Days = sales7Map.get(variantId) || 0;
      const salesLast30Days = sales30Map.get(variantId) || 0;
      const salesLast60Days = sales60Map.get(variantId) || 0;

      const daysUnsold = calculateDaysUnsold(lastSoldAt, createdAt);
      const salesVelocity = calculateSalesVelocity(salesLast30Days);
      const cashTiedUp = calculateCashTiedUp(stock, costPrice);
      const previousStatus = existingStatusMap.get(variantId) || null;
      const status = determineStatus(daysUnsold, previousStatus, thresholdDays);

      if (status === "dead_stock") {
        deadStockFoundCount++;
      }

      bulkOps.push({
        updateOne: {
          filter: { shopId, productId, variantId },
          update: {
            $set: {
              shop: shopId,
              shopId,
              productId,
              variantId,
              title,
              sku: variant.sku || "",
              image,
              locationId,
              locationName,
              collectionIds,
              stock,
              costPrice,
              currentPrice: variantPrice,
              lastSoldAt,
              daysUnsold,
              salesLast7Days,
              salesLast30Days,
              salesLast60Days,
              salesVelocity,
              cashTiedUp,
              status,
            },
          },
          upsert: true,
        },
      });
    }
  }

  console.log(`[DeadStock] Variants fetched: ${totalVariants}`);
  console.log(`[DeadStock] Dead stock variants found: ${deadStockFoundCount}`);

  if (bulkOps.length > 0) {
    await DeadStock.bulkWrite(bulkOps);
    console.log(`[DeadStock] MongoDB upsert completed: ${bulkOps.length} records processed.`);
  }

  // Remove stale products/variants from MongoDB that were deleted in Shopify
  if (activeVariantIds.size > 0) {
    const deleteResult = await DeadStock.deleteMany({
      shopId,
      variantId: { $nin: Array.from(activeVariantIds) },
    });
    console.log(`[DeadStock] Removed ${deleteResult.deletedCount} deleted products/variants from MongoDB.`);
  }

  return {
    success: true,
    totalSynced: bulkOps.length,
    productsProcessed: products.length,
    variantsProcessed: totalVariants,
    deadStockFound: deadStockFoundCount,
    activeProducts: totalVariants - deadStockFoundCount,
  };
}

module.exports = {
  runDeadStockEngine,
};
