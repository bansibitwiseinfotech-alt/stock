const shopifyGraphQL = require("./shopifyGraphql");
const DeadStock = require("../models/DeadStock");

const PRODUCTS_PAGE_SIZE = 250;
const ORDERS_PAGE_SIZE = 250;

const PRODUCTS_QUERY = `query ProductsPage($cursor: String, $productsFirst: Int!) {
  shop {
    currencyCode
  }
  products(first: $productsFirst, after: $cursor) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        title
        featuredImage {
          url
        }
        variants(first: 250) {
          nodes {
            id
            sku
            price
            inventoryQuantity
            inventoryItem {
              unitCost {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
}`;

const ORDERS_QUERY = `query OrdersPage($cursor: String, $ordersFirst: Int!, $query: String!) {
  orders(first: $ordersFirst, after: $cursor, query: $query, sortKey: PROCESSED_AT, reverse: true) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        processedAt
        cancelledAt
        lineItems(first: 100) {
          nodes {
            quantity
            variant {
              id
              sku
            }
            originalUnitPriceSet {
              shopMoney {
                amount
              }
            }
          }
        }
      }
    }
  }
}`;

function getStatus(daysUnsold) {
  if (daysUnsold >= 90) {
    return "critical";
  }

  if (daysUnsold >= 60) {
    return "dead";
  }

  if (daysUnsold >= 30) {
    return "at_risk";
  }

  return "healthy";
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function fetchAllProducts(shop, accessToken) {
  const products = [];
  let cursor = null;
  let currency = "USD";

  while (true) {
    const data = await shopifyGraphQL(shop, accessToken, PRODUCTS_QUERY, {
      cursor,
      productsFirst: PRODUCTS_PAGE_SIZE,
    });

    if (data.shop?.currencyCode) {
      currency = data.shop.currencyCode;
    }

    const pageProducts = data.products?.edges || [];

    for (const edge of pageProducts) {
      if (edge?.node) {
        products.push(edge.node);
      }
    }

    if (!data.products?.pageInfo?.hasNextPage) {
      break;
    }

    cursor = data.products.edges[data.products.edges.length - 1]?.cursor;
    if (!cursor) {
      break;
    }
  }

  return { products, currency };
}

async function fetchAllOrders(shop, accessToken, sinceIso) {
  const orders = [];
  let cursor = null;
  const orderQuery = `processed_at:>=${sinceIso} financial_status:paid`;

  while (true) {
    const data = await shopifyGraphQL(shop, accessToken, ORDERS_QUERY, {
      cursor,
      ordersFirst: ORDERS_PAGE_SIZE,
      query: orderQuery,
    });

    const pageOrders = data.orders?.edges || [];
    for (const edge of pageOrders) {
      if (edge?.node) {
        orders.push(edge.node);
      }
    }

    if (!data.orders?.pageInfo?.hasNextPage) {
      break;
    }

    cursor = data.orders.edges[data.orders.edges.length - 1]?.cursor;
    if (!cursor) {
      break;
    }
  }

  return orders;
}

async function syncDeadStock(shop, accessToken) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sinceIso = thirtyDaysAgo.toISOString();

  const { products, currency } = await fetchAllProducts(shop, accessToken);
  const orders = await fetchAllOrders(shop, accessToken, sinceIso);

  const salesMap = new Map();
  const lastSaleMap = new Map();

  for (const order of orders) {
    if (order.cancelledAt) {
      continue;
    }

    const orderDate = new Date(order.processedAt);
    for (const lineItem of order.lineItems?.nodes || []) {
      const variant = lineItem.variant;
      if (!variant?.id) {
        continue;
      }

      const quantity = normalizeNumber(lineItem.quantity);
      const variantId = variant.id;
      const previousSales = salesMap.get(variantId) || 0;
      salesMap.set(variantId, previousSales + quantity);

      const existingLastSale = lastSaleMap.get(variantId);
      if (!existingLastSale || orderDate > existingLastSale) {
        lastSaleMap.set(variantId, orderDate);
      }
    }
  }

  const operations = [];
  const calculated = [];

  for (const product of products) {
    const productTitle = product.title || "";
    const image = product.featuredImage?.url || "";

    for (const variant of product.variants?.nodes || []) {
      const stock = normalizeNumber(variant.inventoryQuantity);
      if (stock <= 0) {
        continue;
      }

      const salesLast30Days = salesMap.get(variant.id) || 0;
      const salesVelocity = Number((salesLast30Days / 30).toFixed(4));
      const lastSaleDate = lastSaleMap.get(variant.id) || null;
      const daysUnsold = lastSaleDate
        ? Math.max(
            0,
            Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : 999;
      const costPrice = normalizeNumber(variant.inventoryItem?.unitCost?.amount) || normalizeNumber(variant.price);
      const currentPrice = normalizeNumber(variant.price);
      const cashTiedUp = Number((stock * costPrice).toFixed(2));
      const daysOfInventory = salesVelocity > 0 ? Number((stock / salesVelocity).toFixed(2)) : null;
      const status = getStatus(daysUnsold);

      const record = {
        shopId: shop,
        productId: product.id,
        variantId: variant.id,
        productTitle,
        sku: variant.sku || "",
        image,
        stock,
        costPrice,
        currentPrice,
        salesLast30Days,
        salesVelocity,
        daysOfInventory,
        daysUnsold,
        cashTiedUp,
        lastSaleDate,
        status,
        currency,
      };

      operations.push({
        updateOne: {
          filter: {
            shopId: shop,
            variantId: variant.id,
          },
          update: {
            $set: record,
          },
          upsert: true,
        },
      });

      calculated.push(record);
    }
  }

  if (operations.length > 0) {
    await DeadStock.bulkWrite(operations);
  }

  return { results: calculated, currency };
}

module.exports = {
  syncDeadStock,
};
