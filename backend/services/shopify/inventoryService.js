const shopifyGraphQL = require("../shopifyGraphql");

const LOCATIONS_QUERY = `
query InventoryLocations($cursor: String, $first: Int!) {
  locations(first: $first, after: $cursor) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        name
        isActive
      }
    }
  }
}
`;

async function fetchLocations(shop, accessToken) {
  try {
    const locations = [];
    let cursor = null;

    while (true) {
      const data = await shopifyGraphQL(shop, accessToken, LOCATIONS_QUERY, {
        cursor,
        first: 250,
      });

      const pageEdges = data?.locations?.edges || [];
      for (const edge of pageEdges) {
        if (edge?.node) {
          locations.push(edge.node);
        }
      }

      if (!data?.locations?.pageInfo?.hasNextPage) {
        break;
      }

      cursor = pageEdges[pageEdges.length - 1]?.cursor;
      if (!cursor) {
        break;
      }
    }

    return locations;
  } catch (error) {
    console.error("Error fetching Shopify inventory locations:", error.message);
    return [];
  }
}

module.exports = {
  fetchLocations,
};
