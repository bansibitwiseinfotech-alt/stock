require('dotenv').config();
const { sendPreOrderConfirmationEmail } = require('../backend/services/email.service');

async function testEmails() {
  const testRecipient = process.env.EMAIL || 'bansi.bitwiseinfotech@gmail.com';

  console.log('1. Testing Pre-Order + Credit Card (Paid)...');
  const res1 = await sendPreOrderConfirmationEmail({
    to: testRecipient,
    customerName: 'Bansi Test',
    orderNumber: '#1001',
    shop: 'promobile-hub.myshopify.com',
    paymentMethod: 'Credit Card',
    isPaid: true,
    items: [
      {
        title: 'Apple iPhone 17 Pro',
        variantTitle: '256GB / Deep Blue',
        quantity: 1,
        price: 126790.00,
        image: 'https://cdn.shopify.com/s/files/1/0688/1755/1543/files/iphone.jpg?v=1'
      }
    ],
    totalPrice: 126790.00,
    currency: 'USD'
  });
  console.log('Credit Card Email Result:', res1);

  console.log('\n2. Testing Pre-Order + Cash on Delivery (COD Pending)...');
  const res2 = await sendPreOrderConfirmationEmail({
    to: testRecipient,
    customerName: 'Bansi Test',
    orderNumber: '#1002',
    shop: 'promobile-hub.myshopify.com',
    paymentMethod: 'Cash on Delivery (COD)',
    isPaid: false,
    items: [
      {
        title: 'Motorola Edge 60 Fusion 5G',
        variantTitle: '128GB / Marshmallow Blue',
        quantity: 1,
        price: 349.99,
        image: 'https://cdn.shopify.com/s/files/1/0688/1755/1543/files/moto.jpg?v=1'
      }
    ],
    totalPrice: 349.99,
    currency: 'USD'
  });
  console.log('COD Email Result:', res2);

  process.exit(0);
}

testEmails();
