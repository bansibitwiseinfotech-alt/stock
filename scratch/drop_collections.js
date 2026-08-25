require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to DB:', mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n--- Current Collections in DB ---');
  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`- ${c.name} (${count} documents)`);
  }

  const targetsToDrop = [
    'tbl_deadstockbundles',
    'tbl_deadstock',
    'tbl_highdemand_reorders',
    'tbl_orders'
  ];

  console.log('\n--- Checking Target Collections To Drop ---');
  for (const target of targetsToDrop) {
    const exists = collections.some((c) => c.name === target);
    if (exists) {
      const docCount = await mongoose.connection.db.collection(target).countDocuments();
      console.log(`Found collection: ${target} (docs: ${docCount}) -> Dropping...`);
      await mongoose.connection.db.dropCollection(target);
      console.log(`✅ Successfully dropped: ${target}`);
    } else {
      console.log(`ℹ️ Collection not found in DB: ${target}`);
    }
  }

  console.log('\n--- Remaining Collections in DB ---');
  const remaining = await mongoose.connection.db.listCollections().toArray();
  for (const c of remaining.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`- ${c.name} (${count} documents)`);
  }

  await mongoose.disconnect();
  console.log('\nDone! Disconnected.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
