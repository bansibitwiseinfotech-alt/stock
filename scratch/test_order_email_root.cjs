const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function testOrderEmail() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const query = `
    query {
      orders(first: 3, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            email
            phone
            customer {
              email
              displayName
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
  console.log('Order Email Query Result:', JSON.stringify(data, null, 2));
  process.exit(0);
}
testOrderEmail();
