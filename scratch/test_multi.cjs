const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');
const { processBackInStockNotifications } = require('../backend/services/stockoutNotification.service');
const emailService = require('../backend/services/email.service');

async function testMultiSubscribers() {
  await connectDB();

  const testVariant = '99999999999999';
  const shop = 'promobile-hub.myshopify.com';

  // Clean up any old test records for this variant
  await StockoutNotification.deleteMany({ variantId: testVariant });

  // Create 3 subscribers
  await StockoutNotification.create([
    {
      shop,
      productId: '7634929811543',
      variantId: testVariant,
      email: 'sub1@example.com',
      productTitle: 'Apple iPhone 17 Pro',
      variantTitle: '256GB / Space Black',
      status: 'PENDING',
    },
    {
      shop,
      productId: '7634929811543',
      variantId: testVariant,
      email: 'fail-sub2@example.com',
      productTitle: 'Apple iPhone 17 Pro',
      variantTitle: '256GB / Space Black',
      status: 'PENDING',
    },
    {
      shop,
      productId: '7634929811543',
      variantId: testVariant,
      email: 'sub3@example.com',
      productTitle: 'Apple iPhone 17 Pro',
      variantTitle: '256GB / Space Black',
      status: 'PENDING',
    },
  ]);

  console.log('--- Test 9: Multiple Subscribers (2 succeed, 1 fails) ---');
  const originalSend = emailService.sendBackInStockEmail;
  emailService.sendBackInStockEmail = async ({ to }) => {
    if (to.includes('fail-sub2')) {
      return { success: false, error: 'Recipient domain rejected by provider' };
    }
    return { success: true, messageId: `<msg-${to}@smartstock.app>` };
  };

  const result = await processBackInStockNotifications(shop, testVariant, 10);
  console.log('Multi-subscriber result:', JSON.stringify(result, null, 2));

  const docs = await StockoutNotification.find({ variantId: testVariant }).sort({ email: 1 }).lean();
  console.log('Database statuses after restock:');
  docs.forEach((d) => {
    console.log(`- ${d.email}: status=${d.status}, notifiedAt=${d.notifiedAt ? 'SET' : 'null'}, error=${d.lastError}`);
  });

  // Clean up test records
  await StockoutNotification.deleteMany({ variantId: testVariant });

  emailService.sendBackInStockEmail = originalSend;
  process.exit(0);
}

testMultiSubscribers();
