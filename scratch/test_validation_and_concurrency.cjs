const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');
const emailService = require('../backend/services/email.service');
const { processBackInStockNotifications } = require('../backend/services/stockoutNotification.service');
const { restockShopifyVariantInventory } = require('../backend/services/shopifyInventoryService');

async function runValidationTests() {
  await connectDB();
  const shop = 'promobile-hub.myshopify.com';
  const variantId = '42733971636311';

  console.log('=== TEST 1: Invalid Quantity Validation ===');
  const invalidQuantities = [0, -5, 'abc', null, undefined, -1.5];
  for (const q of invalidQuantities) {
    const res = await fetch('http://localhost:5000/api/notifications/test-restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, variantId, quantity: q }),
    });
    const data = await res.json();
    console.log(`Quantity "${q}" -> HTTP ${res.status}: ${data.message}`);
    if (res.status !== 400) {
      console.error('FAILED: Invalid quantity did not return 400');
    }
  }

  console.log('\n=== TEST 2: Missing Variant Validation ===');
  const resMissingVar = await fetch('http://localhost:5000/api/notifications/test-restock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shop, quantity: 10 }),
  });
  const dataMissingVar = await resMissingVar.json();
  console.log(`Missing variant -> HTTP ${resMissingVar.status}: ${dataMissingVar.message}`);

  console.log('\n=== TEST 3: Concurrency / Race Condition Protection ===');
  // Create a single test subscriber
  const testVariant = '88888888888888';
  await StockoutNotification.deleteMany({ variantId: testVariant });
  await StockoutNotification.create({
    shop,
    productId: '7634929811543',
    variantId: testVariant,
    email: 'concurrent-user@example.com',
    productTitle: 'Apple iPhone 17 Pro',
    variantTitle: 'Default Title',
    status: 'PENDING',
  });

  // Mock email service to count how many times sendBackInStockEmail is invoked
  let sendCount = 0;
  const originalSend = emailService.sendBackInStockEmail;
  emailService.sendBackInStockEmail = async () => {
    sendCount++;
    // Add small delay to simulate network latency
    await new Promise((r) => setTimeout(r, 100));
    return { success: true, messageId: `<concurrent-${Date.now()}@smartstock.app>` };
  };

  // Trigger two simultaneous concurrent notification batches for the same variant
  console.log('Spawning 2 concurrent batch restock notifications...');
  const [batch1, batch2] = await Promise.all([
    processBackInStockNotifications(shop, testVariant, 10),
    processBackInStockNotifications(shop, testVariant, 10),
  ]);

  console.log('Batch 1 result:', { processed: batch1.processed, sent: batch1.sent });
  console.log('Batch 2 result:', { processed: batch2.processed, sent: batch2.sent });
  console.log(`Total emails actually dispatched: ${sendCount} (Expected exactly 1)`);

  const doc = await StockoutNotification.findOne({ variantId: testVariant }).lean();
  console.log('Final DB Status:', { status: doc.status, notifiedAt: doc.notifiedAt ? 'SET' : 'null' });

  // Cleanup test record and restore email service
  await StockoutNotification.deleteMany({ variantId: testVariant });
  emailService.sendBackInStockEmail = originalSend;

  if (sendCount === 1 && doc.status === 'NOTIFIED') {
    console.log('✓ CONCURRENCY TEST PASSED: Exactly 1 email sent, no duplicates!');
  } else {
    console.error('✗ CONCURRENCY TEST FAILED');
  }

  await mongoose.disconnect();
  process.exit(0);
}

runValidationTests();
