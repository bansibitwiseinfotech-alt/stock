const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');
const Inventory = require('../backend/models/Inventory');
const HighDemand = require('../backend/models/highDemand');
const shopifyInventoryService = require('../backend/services/shopifyInventoryService');
const emailService = require('../backend/services/email.service');
const { processBackInStockNotifications } = require('../backend/services/stockoutNotification.service');

async function testCompleteFlow() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const variantId = '42733971636311';

  // 1. Reset subscriber to PENDING
  await StockoutNotification.updateOne(
    { variantId },
    { $set: { status: 'PENDING', notifiedAt: null, lastError: null, retryCount: 0 } }
  );

  console.log('--- Test: Successful Inventory Restock Pipeline Simulation ---');
  // Mock restockShopifyVariantInventory to simulate Shopify returning 10 available units
  const originalRestock = shopifyInventoryService.restockShopifyVariantInventory;
  shopifyInventoryService.restockShopifyVariantInventory = async (s, v, q) => {
    // Update MongoDB caches as the real service does
    await Inventory.findOneAndUpdate(
      { variantId: `gid://shopify/ProductVariant/${v}` },
      { $set: { shop: s, availableQuantity: q, lastSyncedAt: new Date() } },
      { upsert: true }
    );
    return {
      success: true,
      shop: s,
      variantId: v,
      productId: '7634929811543',
      productTitle: 'Apple iPhone 17 Pro',
      variantTitle: 'Default Title',
      productHandle: 'apple-iphone-17-pro',
      locationId: 'gid://shopify/Location/75277008983',
      locationName: 'Shop location',
      previousStock: 0,
      newStock: q,
    };
  };

  // Run the notification dispatch with restocked inventory (10)
  const restockRes = await shopifyInventoryService.restockShopifyVariantInventory(shop, variantId, 10);
  console.log('Shopify Inventory Update Result:', restockRes);

  const notifRes = await processBackInStockNotifications(shop, variantId, restockRes.newStock);
  console.log('Notification Dispatch Result:', JSON.stringify(notifRes, null, 2));

  const doc = await StockoutNotification.findOne({ variantId }).lean();
  console.log('Updated Subscriber in DB:', {
    status: doc.status,
    notifiedAt: doc.notifiedAt,
    lastError: doc.lastError,
  });

  // Verify Storefront Stockout Shield API response when stock is 10
  const storefrontRes = await fetch(
    `http://localhost:5000/api/storefront/stockout-shield?shop=${shop}&variantId=${variantId}`
  );
  const storefrontData = await storefrontRes.json();
  console.log('Storefront Stockout Shield Result (Stock = 10):', {
    success: storefrontData.success,
    stock: storefrontData.stock,
    show: storefrontData.show,
    showNotifyMe: storefrontData.stock <= 0,
  });

  // Restore original service
  shopifyInventoryService.restockShopifyVariantInventory = originalRestock;

  // Reset back to PENDING for merchant
  await StockoutNotification.updateOne(
    { variantId },
    { $set: { status: 'PENDING', notifiedAt: null, lastError: null, retryCount: 0 } }
  );

  await mongoose.disconnect();
  console.log('--- Test Finished Successfully ---');
  process.exit(0);
}

testCompleteFlow();
