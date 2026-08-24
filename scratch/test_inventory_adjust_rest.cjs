const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function testInventoryAdjust() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const locationId = 75277041751;
  const inventoryItemId = 44851546259543;

  console.log('1. Testing REST inventory_levels/adjust.json...');
  const restRes = await fetch(`https://${shop}/admin/api/2024-01/inventory_levels/adjust.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.accessToken,
    },
    body: JSON.stringify({
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available_adjustment: 10
    })
  });

  const restData = await restRes.json();
  console.log('REST Adjust Result:', JSON.stringify(restData, null, 2));

  // Also query live variant stock
  const query = `
    query {
      node(id: "gid://shopify/ProductVariant/42739026559063") {
        ... on ProductVariant {
          id
          title
          inventoryQuantity
        }
      }
    }
  `;
  const gqlRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.accessToken,
    },
    body: JSON.stringify({ query })
  });
  const gqlData = await gqlRes.json();
  console.log('Live Variant Stock on Shopify:', JSON.stringify(gqlData?.data?.node, null, 2));

  process.exit(0);
}

testInventoryAdjust();
