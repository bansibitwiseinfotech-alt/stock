const shopifyGraphQL = require("../shopifyGraphql");

const PRODUCTS_QUERY = `
query ProductsPage($cursor: String, $first: Int!) {
  products(first: $first, after: $cursor) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        title
        handle
        status
        createdAt
        featuredImage {
          url
        }
        collections(first: 50) {
          nodes {
            id
            title
          }
        }
        variants(first: 250) {
          nodes {
            id
            title
            sku
            price
            createdAt
            inventoryQuantity
            inventoryItem {
              unitCost {
                amount
                currencyCode
              }
              inventoryLevels(first: 10) {
                nodes {
                  location {
                    id
                    name
                  }
                  quantities(names: ["available", "on_hand"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

async function fetchProducts(shop, accessToken, pageSize = 250) {
  const products = [];
  let cursor = null;

  while (true) {
    const data = await shopifyGraphQL(shop, accessToken, PRODUCTS_QUERY, {
      cursor,
      first: pageSize,
    });

    const pageEdges = data?.products?.edges || [];
    for (const edge of pageEdges) {
      if (edge?.node) {
        products.push(edge.node);
      }
    }

    if (!data?.products?.pageInfo?.hasNextPage) {
      break;
    }

    cursor = pageEdges[pageEdges.length - 1]?.cursor;
    if (!cursor) {
      break;
    }
  }

  return products;
}

module.exports = {
  fetchProducts,
};
