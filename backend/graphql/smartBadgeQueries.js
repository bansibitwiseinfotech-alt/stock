const GET_ACTIVE_PRODUCTS = `#graphql
query GetActiveProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, query: "status:active") {
    nodes {
      id
      title
      handle
      status
      totalInventory
      featuredImage {
        url
        altText
      }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          inventoryQuantity
          inventoryItem {
            id
            tracked
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const GET_RECENT_ORDERS = `#graphql
query GetRecentOrders($first: Int!, $after: String, $query: String!) {
  orders(
    first: $first
    after: $after
    query: $query
    sortKey: CREATED_AT
    reverse: true
  ) {
    nodes {
      id
      name
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      lineItems(first: 100) {
        nodes {
          quantity
          variant {
            id
            product {
              id
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const GET_PRODUCT_BY_ID = `#graphql
query GetProductById($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    status
    totalInventory
    featuredImage {
      url
      altText
    }
    variants(first: 100) {
      nodes {
        id
        title
        sku
        price
        compareAtPrice
        inventoryQuantity
      }
    }
  }
}
`;

module.exports = {
  GET_ACTIVE_PRODUCTS,
  GET_RECENT_ORDERS,
  GET_PRODUCT_BY_ID,
};
