const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../backend/config/mongodb');
const Store = require('../backend/models/Store');
const shopifyGraphQL = require('../backend/services/shopifyGraphql');

async function checkScopes() {
  await connectDB();
  const store = await Store.findOne({ shop: 'promobile-hub.myshopify.com' }).lean();

  const query = `
    query {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
    }
  `;

  try {
    const data = await shopifyGraphQL(store.shop, store.accessToken, query);
    console.log('Granted Scopes:', data.currentAppInstallation.accessScopes.map(s => s.handle));
  } catch (err) {
    console.error('Scope check error:', err);
  }
  process.exit(0);
}

checkScopes();
