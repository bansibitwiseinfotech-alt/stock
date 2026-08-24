const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../backend/config/mongodb');
const PreOrder = require('../backend/models/PreOrder');

async function checkOrder() {
  await connectDB();
  const order1055 = await PreOrder.findOne({ orderNumber: '#1055' }).lean();
  console.log('Order #1055 in MongoDB:');
  console.log('Product:', order1055?.productTitle);
  console.log('Total Price:', order1055?.totalPrice);
  console.log('Currency:', order1055?.currency);
  console.log('Line Items:', JSON.stringify(order1055?.lineItems, null, 2));
  process.exit(0);
}
checkOrder();
