const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const HighDemandStorefront = require('../backend/models/HighDemandStorefront');
const HighDemand = require('../backend/models/highDemand');

async function checkMotorola() {
  await connectDB();
  const moto = await HighDemand.find({ productName: /motorola/i }).lean();
  console.log('HighDemand Motorola items:', moto.map(m => ({
    variantId: m.variantId,
    name: m.productName,
    stock: m.currentStock,
    urgencyBadgeEnabled: m.urgencyBadgeEnabled,
    lowStockBadge: m.lowStockBadge
  })));

  const configs = await HighDemandStorefront.find().lean();
  console.log('All Storefront configs in DB:', configs.map(c => ({
    variantId: c.variantId,
    lowStockBadge: c.lowStockBadge,
    urgencyBadgeEnabled: c.urgencyBadgeEnabled
  })));

  process.exit(0);
}
checkMotorola();
