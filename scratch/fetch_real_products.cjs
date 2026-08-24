const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function getRealImages() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const store = await Store.findOne({ shop }).lean();

  const query = `
    query {
      products(first: 10) {
        edges {
          node {
            id
            title
            featuredImage {
              url
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  image {
                    url
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
  const products = data?.data?.products?.edges || [];
  for (const p of products) {
    console.log('Product:', p.node.title);
    console.log('Featured Image:', p.node.featuredImage?.url);
    for (const v of p.node.variants.edges) {
      console.log('  Variant:', v.node.title, 'Image:', v.node.image?.url);
    }
  }
  process.exit(0);
}
getRealImages();
