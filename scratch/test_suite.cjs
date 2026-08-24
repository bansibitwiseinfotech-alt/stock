const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');
const { processBackInStockNotifications } = require('../backend/services/stockoutNotification.service');
const emailService = require('../backend/services/email.service');

async function testSuite() {
  await connectDB();
  
  // 1. Reset doc to PENDING
  await StockoutNotification.updateOne(
    { variantId: '42733971636311' },
    { $set: { status: 'PENDING', notifiedAt: null, lastError: null, retryCount: 0 } }
  );

  console.log('--- Test 8: Failure Handling (Provider fails) ---');
  const originalSend = emailService.sendBackInStockEmail;
  emailService.sendBackInStockEmail = async () => {
    return { success: false, error: 'Simulated Email Provider Error (500)' };
  };

  const failResult = await processBackInStockNotifications('promobile-hub.myshopify.com', '42733971636311', 10);
  console.log('Failure result output:', JSON.stringify(failResult, null, 2));

  const docAfterFail = await StockoutNotification.findOne({ variantId: '42733971636311' }).lean();
  console.log('Doc state after fail (must remain PENDING):', {
    status: docAfterFail.status,
    notifiedAt: docAfterFail.notifiedAt,
    lastError: docAfterFail.lastError,
    retryCount: docAfterFail.retryCount
  });

  // Restore original real email function
  emailService.sendBackInStockEmail = originalSend;

  console.log('\n--- Test 4 & 5: Real Live Dispatch (Live Gmail SMTP) ---');
  const liveResult = await processBackInStockNotifications('promobile-hub.myshopify.com', '42733971636311', 10);
  console.log('Live result output:', JSON.stringify(liveResult, null, 2));

  const docAfterLive = await StockoutNotification.findOne({ variantId: '42733971636311' }).lean();
  console.log('Doc state after live send (must be NOTIFIED):', {
    status: docAfterLive.status,
    notifiedAt: docAfterLive.notifiedAt,
    lastError: docAfterLive.lastError,
    retryCount: docAfterLive.retryCount
  });

  process.exit(0);
}

testSuite();
