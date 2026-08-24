const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function checkVariant() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const query = `
    query {
      node(id: "gid://shopify/ProductVariant/42739026559063") {
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
            inventoryLevels(first: 5) {
              nodes {
                id
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
  `;

  const res = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.accessToken,
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log('Variant 42739026559063 on Shopify:', JSON.stringify(data?.data?.node, null, 2));
  process.exit(0);
}
checkVariant();
