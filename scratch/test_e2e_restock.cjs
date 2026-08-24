const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function testE2ERestock() {
  await connectDB();

  // 1. Ensure test subscription is PENDING
  await StockoutNotification.updateOne(
    { variantId: '42733971636311' },
    { $set: { status: 'PENDING', notifiedAt: null, lastError: null, retryCount: 0 } }
  );

  console.log('--- Step 1: Query initial Shopify inventory for variant 42733971636311 ---');
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();
  const query = `
    query GetVariant($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          id
          title
          inventoryQuantity
          inventoryItem {
            id
            inventoryLevels(first: 5) {
              nodes {
                location {
                  name
                }
                quantities(names: ["available"]) {
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  const beforeData = await shopifyGraphQL(store.shop, store.accessToken, query, {
    id: 'gid://shopify/ProductVariant/42733971636311',
  });
  console.log('Initial Shopify State:', JSON.stringify(beforeData, null, 2));

  console.log('\n--- Step 2: Trigger Test Restock via HTTP POST /api/notifications/test-restock ---');
  const res = await fetch('http://localhost:5000/api/notifications/test-restock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shop: 'promobile-hub.myshopify.com',
      variantId: '42733971636311',
      quantity: 10,
    }),
  });

  console.log('HTTP Status:', res.status);
  const responseData = await res.json();
  console.log('API Response:\n', JSON.stringify(responseData, null, 2));

  console.log('\n--- Step 3: Query updated Shopify inventory after restock ---');
  const afterData = await shopifyGraphQL(store.shop, store.accessToken, query, {
    id: 'gid://shopify/ProductVariant/42733971636311',
  });
  console.log('Updated Shopify State:', JSON.stringify(afterData, null, 2));

  console.log('\n--- Step 4: Verify MongoDB subscription record status ---');
  const doc = await StockoutNotification.findOne({ variantId: '42733971636311' }).lean();
  console.log('Updated DB Document:', {
    status: doc.status,
    notifiedAt: doc.notifiedAt,
    lastError: doc.lastError,
  });

  console.log('\n--- Step 5: Verify Storefront Stockout Shield API ---');
  const storefrontRes = await fetch(
    'http://localhost:5000/api/storefront/stockout-shield?shop=promobile-hub.myshopify.com&variantId=42733971636311'
  );
  const storefrontData = await storefrontRes.json();
  console.log('Storefront Shield API Response:', {
    success: storefrontData.success,
    stock: storefrontData.stock,
    show: storefrontData.show,
    lowStockBadge: storefrontData.lowStockBadge,
  });

  process.exit(0);
}

testE2ERestock();
