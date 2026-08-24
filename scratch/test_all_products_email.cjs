require('dotenv').config();
const { sendPreOrderConfirmationEmail } = require('../backend/services/email.service');

async function testMultipleRealProducts() {
  const testRecipient = process.env.EMAIL || 'bansi.bitwiseinfotech@gmail.com';

  console.log('1. Sending real email for Order #1058 (Vivo V60e 5G)...');
  await sendPreOrderConfirmationEmail({
    to: testRecipient,
    customerName: 'Bansi',
    orderNumber: '#1058',
    shop: 'promobile-hub.myshopify.com',
    paymentMethod: 'Credit Card',
    isPaid: true,
    items: [
      {
        title: 'Vivo V60e 5G',
        variantTitle: 'Default Title',
        quantity: 2,
        price: 59376.00,
        image: 'https://cdn.shopify.com/s/files/1/0666/6941/2439/files/V1_cd583be4-79e2-4d39-a853-2d9f39e3d7ee.webp?v=1777453442'
      }
    ],
    totalPrice: 118752.00,
    currency: 'USD'
  });

  console.log('\n2. Sending real email for Order #1057 (Motorola Edge 60 Fusion 5G)...');
  await sendPreOrderConfirmationEmail({
    to: testRecipient,
    customerName: 'Bansi',
    orderNumber: '#1057',
    shop: 'promobile-hub.myshopify.com',
    paymentMethod: 'Cash on Delivery (COD)',
    isPaid: false,
    items: [
      {
        title: 'Motorola Edge 60 Fusion 5G (Pantone Slipstream, 12GB RAM, 256GB Storage)',
        variantTitle: 'Default Title',
        quantity: 1,
        price: 18424.00,
        image: 'https://cdn.shopify.com/s/files/1/0666/6941/2439/files/motorolaedge601.webp?v=1777445017'
      }
    ],
    totalPrice: 18424.00,
    currency: 'USD'
  });

  console.log('\nAll product emails successfully sent!');
  process.exit(0);
}

testMultipleRealProducts();
