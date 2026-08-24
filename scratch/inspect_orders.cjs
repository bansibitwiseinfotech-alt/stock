const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function checkLatestShopifyOrders() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const query = `
    query {
      orders(first: 8, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            paymentGatewayNames
            tags
            customAttributes {
              key
              value
            }
            customer {
              email
              displayName
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  customAttributes {
                    key
                    value
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
  console.log('Latest 8 orders on Shopify:');
  for (const edge of data?.data?.orders?.edges || []) {
    const o = edge.node;
    console.log('\n--------------------------');
    console.log('Order:', o.name, 'Date:', o.createdAt);
    console.log('Customer:', o.customer?.displayName, 'Email:', o.customer?.email);
    console.log('Tags:', o.tags);
    console.log('CustomAttributes:', o.customAttributes);
    console.log('Payment Gateways:', o.paymentGatewayNames);
    console.log('Line items:');
    for (const line of o.lineItems.edges) {
      console.log('  -', line.node.title, 'Qty:', line.node.quantity, 'Properties:', line.node.customAttributes);
    }
  }
  process.exit(0);
}
checkLatestShopifyOrders();
