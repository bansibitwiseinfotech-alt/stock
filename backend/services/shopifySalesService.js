const {
  GET_RECENT_ORDERS,
} = require("../graphql/smartBadgeQueries");

const {
  shopifyGraphql,
} = require("./shopifyGraphqlService");

/**
 * Fetches real Shopify order data and calculates sales metrics & co-purchase matrix
 * @param {Object} params
 * @param {string} params.shop
 * @param {string} params.accessToken
 * @param {number} params.days - Analysis window in days (default: 30)
 */
async function getProductSalesAndCoPurchases({
  shop,
  accessToken,
  days = 30,
}) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const queryDate = since.toISOString();

  const salesMap = {};
  const coPurchasesMap = {}; // { [productId]: { [otherProductId]: count } }
  const totalOrdersWithProduct = {}; // { [productId]: count }

  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    let data;
    try {
      data = await shopifyGraphql({
        shop,
        accessToken,
        query: GET_RECENT_ORDERS,
        variables: {
          first: 100,
          after,
          query: `created_at:>=${queryDate}`,
        },
      });
    } catch (err) {
      if (
        err.message?.includes("Access denied") ||
        err.message?.includes("ACCESS_DENIED") ||
        err.status === 403
      ) {
        const orderScopeErr = new Error("Order access is required to calculate sales-based recommendations.");
        orderScopeErr.code = "SHOPIFY_ORDER_SCOPE_REQUIRED";
        orderScopeErr.status = 403;
        throw orderScopeErr;
      }
      throw err;
    }

    if (!data?.orders) {
      break;
    }

    const orderNodes = data.orders.nodes || [];

    for (const order of orderNodes) {
      // Ignore cancelled or invalid orders
      if (order.cancelledAt) continue;

      const orderProductsInOrder = new Set();
      const lineItemNodes = order.lineItems?.nodes || [];

      for (const lineItem of lineItemNodes) {
        const rawProductId = lineItem.variant?.product?.id;
        if (!rawProductId) continue;

        const quantity = Number(lineItem.quantity) || 1;
        orderProductsInOrder.add(rawProductId);

        if (!salesMap[rawProductId]) {
          salesMap[rawProductId] = {
            unitsSold: 0,
            lastSaleDate: null,
          };
        }

        salesMap[rawProductId].unitsSold += quantity;

        const orderDate = new Date(order.createdAt);
        if (
          !salesMap[rawProductId].lastSaleDate ||
          orderDate > new Date(salesMap[rawProductId].lastSaleDate)
        ) {
          salesMap[rawProductId].lastSaleDate = order.createdAt;
        }
      }

      // Build co-purchase matrix for multi-item orders
      const productList = Array.from(orderProductsInOrder);
      for (const pId of productList) {
        totalOrdersWithProduct[pId] = (totalOrdersWithProduct[pId] || 0) + 1;
      }

      if (productList.length >= 2) {
        for (let i = 0; i < productList.length; i++) {
          const pA = productList[i];
          if (!coPurchasesMap[pA]) coPurchasesMap[pA] = {};

          for (let j = 0; j < productList.length; j++) {
            if (i === j) continue;
            const pB = productList[j];
            coPurchasesMap[pA][pB] = (coPurchasesMap[pA][pB] || 0) + 1;
          }
        }
      }
    }

    hasNextPage = Boolean(data.orders.pageInfo?.hasNextPage);
    after = data.orders.pageInfo?.endCursor || null;
  }

  const now = new Date();

  // Format sales map
  const productSales = {};
  for (const [productId, stats] of Object.entries(salesMap)) {
    const unitsSold30d = stats.unitsSold;
    const salesVelocity = parseFloat((unitsSold30d / days).toFixed(2));
    let daysSinceLastSale = null;

    if (stats.lastSaleDate) {
      const diffMs = now.getTime() - new Date(stats.lastSaleDate).getTime();
      daysSinceLastSale = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    productSales[productId] = {
      unitsSold30d,
      salesVelocity,
      averageUnitsPerDay: salesVelocity,
      lastSaleDate: stats.lastSaleDate,
      daysSinceLastSale,
    };
  }

  return {
    productSales,
    coPurchasesMap,
    totalOrdersWithProduct,
  };
}

async function getProductSales(params) {
  const result = await getProductSalesAndCoPurchases(params);
  return result.productSales;
}

module.exports = {
  getProductSalesAndCoPurchases,
  getProductSales,
};