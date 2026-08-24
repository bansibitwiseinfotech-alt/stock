require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const ClearanceSale = require('../backend/models/ClearanceSale');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.log('NO_MONGO_URI');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
    const docs = await ClearanceSale.find({}).sort({ createdAt: -1 }).limit(10).lean();
    console.log('COUNT', docs.length);
    console.log(JSON.stringify(docs, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error('ERR', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
