const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');

async function setPolicy() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const numericVariantId = '42733971636311';

  const store = await Store.findOne({
    $or: [{ shop }, { shop: new RegExp(`^${shop}$`, 'i') }]
  }).lean();

  const restRes = await fetch(`https://${shop}/admin/api/2024-01/variants/${numericVariantId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.accessToken,
    },
    body: JSON.stringify({
      variant: {
        id: Number(numericVariantId),
        inventory_policy: 'continue'
      }
    })
  });

  const restData = await restRes.json();
  console.log('REST Variant Update Result:');
  console.log('Title:', restData.variant?.title);
  console.log('Inventory Policy:', restData.variant?.inventory_policy);
  console.log('Inventory Quantity:', restData.variant?.inventory_quantity);
  process.exit(0);
}
setPolicy();
