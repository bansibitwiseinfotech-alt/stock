const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function testBulkInputFields() {
  await connectDB();
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();

  const bulkMutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          inventoryQuantity
          inventoryPolicy
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const bulkVariables = {
    productId: "gid://shopify/Product/7634929811543",
    variants: [
      {
        id: "gid://shopify/ProductVariant/42733971636311",
        inventoryPolicy: "DENY"
      }
    ]
  };

  try {
    const data = await shopifyGraphQL(store.shop, store.accessToken, bulkMutation, bulkVariables);
    console.log('productVariantsBulkUpdate fields result:\n', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Field error:', err);
  }

  process.exit(0);
}

testBulkInputFields();
