const shopifyGraphQL = require("../shopifyGraphql");

const ORDERS_QUERY = `
query OrdersPage($cursor: String, $first: Int!, $query: String!) {
  orders(first: $first, after: $cursor, query: $query, sortKey: PROCESSED_AT, reverse: true) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        processedAt
        cancelledAt
        lineItems(first: 25) {
          nodes {
            quantity
            variant {
              id
              sku
            }
          }
        }
      }
    }
  }
}
`;

async function fetchOrders(shop, accessToken, daysHistory = 90) {
  const orders = [];
  let cursor = null;
  const sinceDate = new Date(Date.now() - daysHistory * 24 * 60 * 60 * 1000);
  const queryFilter = `processed_at:>=${sinceDate.toISOString()}`;

  try {
    while (true) {
      const data = await shopifyGraphQL(shop, accessToken, ORDERS_QUERY, {
        cursor,
        first: 25,
        query: queryFilter,
      });

      const pageEdges = data?.orders?.edges || [];
      for (const edge of pageEdges) {
        if (edge?.node) {
          orders.push(edge.node);
        }
      }

      if (!data?.orders?.pageInfo?.hasNextPage) {
        break;
      }

      cursor = pageEdges[pageEdges.length - 1]?.cursor;
      if (!cursor) {
        break;
      }
    }
  } catch (error) {
    console.warn("[OrderService] Notice: Could not fetch orders from Shopify API (missing read_orders scope or 0 orders). Using variant creation date for daysUnsold.", error.message);
  }

  return orders;
}

module.exports = {
  fetchOrders,
};
