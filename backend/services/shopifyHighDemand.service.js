const shopifyGraphQL = require("./shopifyGraphql");
const { fetchOrders } = require("./shopify/orderService");

async function fetchHighDemandProducts(shop, accessToken) {
  const query = `
    query GetProducts($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          featuredImage {
            url
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              inventoryQuantity
              image {
                url
              }
            }
          }
        }
      }
    }
  `;

  let cursor = null;
  const flattenedVariants = [];

  try {
    do {
      const data = await shopifyGraphQL(shop, accessToken, query, { cursor });
      const productConnection = data?.products;
      const productNodes = productConnection?.nodes || [];

      for (const product of productNodes) {
        const variantNodes = product?.variants?.nodes || [];
        for (const variant of variantNodes) {
          flattenedVariants.push({
            productId: product.id,
            variantId: variant.id,
            productName: product.title || "",
            variantTitle: variant.title || "",
            currentStock: Number(variant.inventoryQuantity) || 0,
            sku: variant.sku || "",
            image: variant.image?.url || product.featuredImage?.url || "",
          });
        }
      }

      if (productConnection?.pageInfo?.hasNextPage) {
        cursor = productConnection.pageInfo.endCursor;
      } else {
        cursor = null;
      }
    } while (cursor);
  } catch (error) {
    console.error("[shopifyHighDemand.service] fetchHighDemandProducts error:", error.message);
    throw error;
  }

  return {
    products: flattenedVariants,
  };
}

async function fetchLast30DaysSalesMap(shop, accessToken) {
  const salesMap = new Map();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const orders = await fetchOrders(shop, accessToken, 30);

    for (const order of orders || []) {
      if (order.cancelledAt) continue;

      const orderDate = new Date(order.processedAt || order.createdAt);
      if (isNaN(orderDate.getTime()) || orderDate < thirtyDaysAgo) continue;

      const lineItemNodes = order.lineItems?.nodes || [];
      for (const lineItem of lineItemNodes) {
        const variantId = lineItem.variant?.id;
        if (!variantId) continue;

        const qty = Number(lineItem.quantity) || 0;
        const currentQty = salesMap.get(variantId) || 0;
        salesMap.set(variantId, currentQty + qty);

        const cleanId = String(variantId).replace(/\D/g, "");
        if (cleanId) {
          salesMap.set(cleanId, (salesMap.get(cleanId) || 0) + qty);
        }
      }
    }
  } catch (error) {
    console.warn("[HighDemand] Notice: Could not aggregate order sales history:", error.message);
  }

  return salesMap;
}

module.exports = {
  fetchHighDemandProducts,
  fetchLast30DaysSalesMap,
};