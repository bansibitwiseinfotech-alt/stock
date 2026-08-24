const path = require("path");
require(path.join(__dirname, "../backend/node_modules/dotenv")).config({ path: path.join(__dirname, "../backend/.env") });
const mongoose = require(path.join(__dirname, "../backend/node_modules/mongoose"));

async function seedMongoDB() {
  console.log("--- SEEDING BOTH SMART-STOCK AND TEST DATABASES IN MONGO ATLAS ---");
  const baseUri = "mongodb+srv://bansibitwiseinfotech_db_user:dAnfjuKYSgliNIi5@cluster0.mt614mu.mongodb.net";

  const dbNames = ["smart-stock", "test"];

  for (const dbName of dbNames) {
    const mongoUri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;
    console.log(`Connecting to database '${dbName}'...`);
    const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    console.log(`Connected to database '${dbName}' ✅`);

    const deadstocksCol = conn.db.collection("deadstocks");
    const storesCol = conn.db.collection("stores");

    const shops = ["promobile-hub.myshopify.com", "test-smart-stock-store.myshopify.com"];

    for (const shopId of shops) {
      await storesCol.updateOne(
        { shop: shopId },
        { $set: { shop: shopId, accessToken: "shpua_real_store_access_token", active: true, updatedAt: new Date() } },
        { upsert: true }
      );

      await deadstocksCol.deleteMany({ shopId });

      const sampleItems = [
        {
          shopId,
          productId: "gid://shopify/Product/1001",
          variantId: "gid://shopify/ProductVariant/2001",
          title: "Summer Shirt",
          sku: "SST-001",
          image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&auto=format&fit=crop&q=80",
          stock: 50,
          costPrice: 25,
          daysUnsold: 65,
          salesLast7Days: 0,
          salesLast30Days: 0,
          salesLast60Days: 1,
          salesVelocity: 0,
          cashTiedUp: 1250,
          status: "dead_stock",
          locationId: "main-warehouse",
          locationName: "Main Warehouse",
          lastSoldAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          shopId,
          productId: "gid://shopify/Product/1002",
          variantId: "gid://shopify/ProductVariant/2002",
          title: "Beach Hat",
          sku: "BHT-002",
          image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=150&auto=format&fit=crop&q=80",
          stock: 40,
          costPrice: 20,
          daysUnsold: 72,
          salesLast7Days: 0,
          salesLast30Days: 0,
          salesLast60Days: 0,
          salesVelocity: 0,
          cashTiedUp: 800,
          status: "dead_stock",
          locationId: "main-warehouse",
          locationName: "Main Warehouse",
          lastSoldAt: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          shopId,
          productId: "gid://shopify/Product/1003",
          variantId: "gid://shopify/ProductVariant/2003",
          title: "Canvas Shoes",
          sku: "CCS-003",
          image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=150&auto=format&fit=crop&q=80",
          stock: 30,
          costPrice: 81.6667,
          daysUnsold: 90,
          salesLast7Days: 0,
          salesLast30Days: 0,
          salesLast60Days: 0,
          salesVelocity: 0,
          cashTiedUp: 2450,
          status: "dead_stock",
          locationId: "main-warehouse",
          locationName: "Main Warehouse",
          lastSoldAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await deadstocksCol.insertMany(sampleItems);
      console.log(`[${dbName}] Inserted ${sampleItems.length} DeadStock documents for shop: ${shopId} ✅`);
    }

    await conn.close();
  }

  console.log("--- SEEDING COMPLETED SUCCESSFULLY FOR ALL DATABASES ✅ ---");
}

seedMongoDB().catch((err) => {
  console.error("Seeding failed ❌:", err);
  process.exit(1);
});
