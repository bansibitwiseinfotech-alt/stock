const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const { restockShopifyVariantInventory } = require('../backend/services/shopifyInventoryService');
const { processBackInStockNotifications } = require('../backend/services/stockoutNotification.service');
const StockoutNotification = require('../backend/models/StockoutNotification');

async function testRestockSimulation() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const variantId = '42739026559063';
  const restockQuantity = 10;

  console.log('1. Testing restockShopifyVariantInventory...');
  const invRes = await restockShopifyVariantInventory(shop, variantId, restockQuantity);
  console.log('Inventory restock result:', invRes);

  console.log('\n2. Testing processBackInStockNotifications...');
  const notifRes = await processBackInStockNotifications(shop, variantId, invRes.newStock);
  console.log('Notification dispatch result:', notifRes);

  const sub = await StockoutNotification.findOne({ shop, variantId }).lean();
  console.log('\nSubscriber status in DB:', {
    email: sub?.email,
    product: sub?.productTitle,
    status: sub?.status,
    notifiedAt: sub?.notifiedAt
  });

  process.exit(0);
}

testRestockSimulation();
