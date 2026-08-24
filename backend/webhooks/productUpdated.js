const DeadStock = require("../models/DeadStock");
const { calculateCashTiedUp } = require("../services/deadStock/deadStockCalculator");

async function handleProductUpdated(shopId, productData) {
  try {
    if (!shopId || !productData?.id) return;

    const title = productData.title || "";
    const image = productData.image?.src || productData.featuredImage?.url || "";

    const variants = productData.variants || [];
    for (const variant of variants) {
      const variantId = variant.admin_graphql_api_id || `gid://shopify/ProductVariant/${variant.id}`;
      const stock = Number(variant.inventory_quantity) || 0;
      const costPrice = Number(variant.cost_price || variant.price) || 0;
      const cashTiedUp = calculateCashTiedUp(stock, costPrice);

      await DeadStock.updateOne(
        { shopId, variantId },
        {
          $set: {
            title,
            image,
            sku: variant.sku || "",
            stock,
            costPrice,
            cashTiedUp,
          },
        }
      );
    }
  } catch (error) {
    console.error("Webhook handleProductUpdated Error:", error.message);
  }
}

module.exports = handleProductUpdated;
