const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function testInventoryMutation() {
  await connectDB();
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();

  console.log('--- Testing inventorySetQuantities with changeFromQuantity ---');
  const setMutation = `
    mutation SetInventory($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          id
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const setVariables = {
    input: {
      name: "available",
      reason: "correction",
      quantities: [
        {
          inventoryItemId: "gid://shopify/InventoryItem/44846442774615",
          locationId: "gid://shopify/Location/75277008983",
          quantity: 10,
          changeFromQuantity: 0
        }
      ]
    }
  };

  try {
    const data = await shopifyGraphQL(store.shop, store.accessToken, setMutation, setVariables);
    console.log('Set Quantities result:\n', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Set Quantities error:', err);
  }

  process.exit(0);
}

testInventoryMutation();
