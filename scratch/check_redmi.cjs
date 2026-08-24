const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const StockoutNotification = require('../backend/models/StockoutNotification');

async function checkRedmiA1() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const query = `
    query {
      products(first: 5, query: "title:'Redmi A1'") {
        edges {
          node {
            id
            title
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  inventoryQuantity
                  inventoryItem {
                    id
                    tracked
                  }
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
  console.log('Redmi A1 product:', JSON.stringify(data?.data?.products?.edges?.[0]?.node, null, 2));

  const subs = await StockoutNotification.find({ shop }).lean();
  console.log('\nAll Notifications in DB (' + subs.length + '):');
  for (const s of subs) {
    console.log({
      id: s._id,
      email: s.email,
      product: s.productTitle,
      variant: s.variantTitle,
      variantId: s.variantId,
      status: s.status
    });
  }

  process.exit(0);
}

checkRedmiA1();
