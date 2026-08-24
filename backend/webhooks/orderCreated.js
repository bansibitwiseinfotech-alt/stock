const DeadStock = require("../models/DeadStock");
const { calculateDaysUnsold, determineStatus } = require("../services/deadStock/deadStockCalculator");

async function handleOrderCreated(shopId, orderData) {
  try {
    if (!shopId || !orderData?.line_items) return;

    const orderDate = new Date(orderData.processed_at || Date.now());

    for (const lineItem of orderData.line_items) {
      const variantId = lineItem.admin_graphql_api_id || `gid://shopify/ProductVariant/${lineItem.variant_id}`;
      const existing = await DeadStock.findOne({ shopId, variantId });

      if (existing) {
        const daysUnsold = calculateDaysUnsold(orderDate, null);
        const status = determineStatus(daysUnsold, existing.status, 60);

        await DeadStock.updateOne(
          { shopId, variantId },
          {
            $set: {
              lastSoldAt: orderDate,
              daysUnsold,
              status,
              salesLast30Days: (existing.salesLast30Days || 0) + (Number(lineItem.quantity) || 1),
              salesVelocity: Number((((existing.salesLast30Days || 0) + (Number(lineItem.quantity) || 1)) / 30).toFixed(4)),
            },
          }
        );
      }
    }
  } catch (error) {
    console.error("Webhook handleOrderCreated Error:", error.message);
  }
}

module.exports = handleOrderCreated;
