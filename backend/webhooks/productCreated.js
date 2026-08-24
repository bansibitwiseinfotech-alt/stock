const DeadStock = require("../models/DeadStock");
const { calculateDaysUnsold, calculateCashTiedUp, determineStatus } = require("../services/deadStock/deadStockCalculator");

async function handleProductCreated(shopId, productData) {
  try {
    if (!shopId || !productData?.id) return;

    const productId = productData.id;
    const title = productData.title || "";
    const image = productData.image?.src || productData.featuredImage?.url || "";
    const createdAt = productData.created_at || new Date();

    const variants = productData.variants || [];
    const bulkOps = [];

    for (const variant of variants) {
      const variantId = variant.admin_graphql_api_id || `gid://shopify/ProductVariant/${variant.id}`;
      const stock = Number(variant.inventory_quantity) || 0;
      const costPrice = Number(variant.cost_price || variant.price) || 0;
      const daysUnsold = calculateDaysUnsold(null, createdAt);
      const cashTiedUp = calculateCashTiedUp(stock, costPrice);
      const status = determineStatus(daysUnsold, null, 60);

      bulkOps.push({
        updateOne: {
          filter: { shopId, variantId },
          update: {
            $set: {
              shopId,
              productId,
              variantId,
              title,
              sku: variant.sku || "",
              image,
              stock,
              costPrice,
              daysUnsold,
              cashTiedUp,
              status,
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await DeadStock.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error("Webhook handleProductCreated Error:", error.message);
  }
}

module.exports = handleProductCreated;
