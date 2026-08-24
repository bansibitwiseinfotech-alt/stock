require('dotenv').config();
const { sendPreOrderConfirmationEmail } = require('../backend/services/email.service');

async function sendOrder1055Email() {
  const testRecipient = process.env.EMAIL || 'bansi.bitwiseinfotech@gmail.com';

  console.log('Sending real Order #1055 email with Total $88,753.00...');
  const res = await sendPreOrderConfirmationEmail({
    to: testRecipient,
    customerName: 'Bansi',
    orderNumber: '#1055',
    shop: 'promobile-hub.myshopify.com',
    paymentMethod: 'Credit Card',
    isPaid: true,
    items: [
      {
        title: 'Apple iPhone 17 Pro',
        variantTitle: 'Default Title',
        quantity: 1,
        price: 88753.00,
        image: 'https://cdn.shopify.com/s/files/1/0666/6941/2439/files/iphone171.webp?v=1777443135'
      }
    ],
    totalPrice: 88753.00,
    currency: 'USD'
  });

  console.log('Order #1055 Email Result:', res);
  process.exit(0);
}

sendOrder1055Email();
