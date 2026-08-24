const {
  GET_ACTIVE_PRODUCTS,
  GET_PRODUCT_BY_ID,
} = require("../graphql/smartBadgeQueries");

const {
  shopifyGraphql,
} = require("./shopifyGraphqlService");

/**
 * Paginates through all active products directly from Shopify Admin GraphQL API
 */
async function getAllActiveProducts({
  shop,
  accessToken,
}) {
  const products = [];

  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphql({
      shop,
      accessToken,
      query: GET_ACTIVE_PRODUCTS,
      variables: {
        first: 100,
        after,
      },
    });

    if (!data?.products) {
      break;
    }

    const connection = data.products;
    if (connection.nodes && Array.isArray(connection.nodes)) {
      products.push(...connection.nodes);
    }

    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    after = connection.pageInfo?.endCursor || null;
  }

  return products;
}

/**
 * Fetch a single product by Shopify ID
 */
async function getProductById({
  shop,
  accessToken,
  productId,
}) {
  const formattedId = String(productId).startsWith("gid://shopify/Product/")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const data = await shopifyGraphql({
    shop,
    accessToken,
    query: GET_PRODUCT_BY_ID,
    variables: {
      id: formattedId,
    },
  });

  return data?.product || null;
}

module.exports = {
  getAllActiveProducts,
  getProductById,
};