const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const PreOrder = require('../backend/models/PreOrder');

async function clean() {
  await connectDB();
  const deleted = await PreOrder.deleteMany({
    $or: [{ orderNumber: /^PO-/i }, { 'customer.name': 'John Doe' }, { preOrderId: /^PRE-/i }]
  });
  console.log('Cleaned dummy mock pre-orders count =', deleted.deletedCount);
  process.exit(0);
}
clean();
