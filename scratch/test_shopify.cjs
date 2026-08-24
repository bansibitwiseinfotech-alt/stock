const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function testShopifyQuery() {
  await connectDB();
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();
  console.log('Found store:', store.shop);

  const query = `
    query GetVariantAndLocations($variantId: ID!) {
      node(id: $variantId) {
        ... on ProductVariant {
          id
          title
          inventoryQuantity
          product {
            id
            title
            handle
          }
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 10) {
              nodes {
                id
                location {
                  id
                  name
                  isActive
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
      locations(first: 10, includeInactive: false) {
        nodes {
          id
          name
          isActive
        }
      }
    }
  `;

  try {
    const data = await shopifyGraphQL(
      store.shop,
      store.accessToken,
      query,
      { variantId: 'gid://shopify/ProductVariant/42733971636311' }
    );
    console.log('Shopify GraphQL Result:\n', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('GraphQL Error:', err);
  }
  process.exit(0);
}
testShopifyQuery();
