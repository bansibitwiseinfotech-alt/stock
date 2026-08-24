const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const StockoutNotification = require('../backend/models/StockoutNotification');

async function resetPending() {
  await connectDB();
  await StockoutNotification.updateOne(
    { variantId: '42733971636311' },
    { $set: { status: 'PENDING', notifiedAt: null, lastError: null, retryCount: 0 } }
  );
  const doc = await StockoutNotification.findOne({ variantId: '42733971636311' }).lean();
  console.log('Test record ready in PENDING state:\n', JSON.stringify(doc, null, 2));
  process.exit(0);
}
resetPending();
