require('dotenv').config();
const { sendPreOrderConfirmationEmail } = require('../backend/services/email.service');

async function testCurrencyFormat() {
  const testRecipient = process.env.EMAIL || 'bansi.bitwiseinfotech@gmail.com';

  console.log('Sending test email with $ currency formatting...');
  const res = await sendPreOrderConfirmationEmail({
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
        image: 'https://cdn.shopify.com/s/files/1/0666/6941/2439/files/iphone171.webp?v=1777443135'
      }
    ],
    totalPrice: 126790.00,
    currency: 'USD'
  });

  console.log('Result:', res);
  process.exit(0);
}

testCurrencyFormat();
