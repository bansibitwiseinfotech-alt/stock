const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const Inventory = require('../backend/models/Inventory');
const HighDemand = require('../backend/models/highDemand');
const HighDemandStorefront = require('../backend/models/HighDemandStorefront');

async function checkStock() {
  await connectDB();
  const variantId = '42733971636311';
  const inv = await Inventory.findOne({
    $or: [{ variantId: variantId }, { variantId: 'gid://shopify/ProductVariant/' + variantId }]
  }).lean();
  console.log('Inventory availableQuantity =', inv?.availableQuantity);

  const hd = await HighDemand.findOne({
    $or: [{ variantId: variantId }, { variantId: 'gid://shopify/ProductVariant/' + variantId }]
  }).lean();
  console.log('HighDemand currentStock =', hd?.currentStock);

  const st = await HighDemandStorefront.findOne({
    $or: [{ variantId: variantId }, { variantId: 'gid://shopify/ProductVariant/' + variantId }]
  }).lean();
  console.log('HighDemandStorefront preOrder =', st?.preOrder, 'preOrderEnabled =', st?.preOrderEnabled);

  process.exit(0);
}
checkStock();
