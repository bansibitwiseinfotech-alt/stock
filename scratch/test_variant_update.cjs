const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function testVariantUpdate() {
  await connectDB();
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();

  console.log('--- Testing productVariantUpdate with inventoryQuantities / inventoryItem ---');
  const variantMutation = `
    mutation productVariantUpdate($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
          id
          inventoryQuantity
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variantVariables = {
    input: {
      id: "gid://shopify/ProductVariant/42733971636311",
      inventoryQuantities: [
        {
          availableQuantity: 10,
          locationId: "gid://shopify/Location/75277008983"
        }
      ]
    }
  };

  try {
    const data = await shopifyGraphQL(store.shop, store.accessToken, variantMutation, variantVariables);
    console.log('productVariantUpdate result:\n', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('productVariantUpdate error:', err);
  }

  process.exit(0);
}

testVariantUpdate();
