const path = require("path");
require(path.join(__dirname, "../backend/node_modules/dotenv")).config({ path: path.join(__dirname, "../backend/.env") });
const mongoose = require(path.join(__dirname, "../backend/node_modules/mongoose"));

async function seedAllModules() {
  console.log("--- MASTER SEEDING ALL SMART STOCK MODULES IN MONGODB ATLAS ---");

  const baseUri = "mongodb+srv://bansibitwiseinfotech_db_user:dAnfjuKYSgliNIi5@cluster0.mt614mu.mongodb.net";
  const dbNames = ["smart-stock", "test"];
  const shops = ["promobile-hub.myshopify.com", "test-smart-stock-store.myshopify.com"];

  for (const dbName of dbNames) {
    const mongoUri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;
    console.log(`Connecting to database '${dbName}'...`);
    const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();

    const deadstocksCol = conn.db.collection("deadstocks");
    const highdemandsCol = conn.db.collection("highdemands");
    const automationsCol = conn.db.collection("automations");
    const bundlesCol = conn.db.collection("bundles");
    const settingsCol = conn.db.collection("storesettings");
    const storesCol = conn.db.collection("stores");

    for (const shopId of shops) {
      // 1. Store
      await storesCol.updateOne(
        { shop: shopId },
        { $set: { shop: shopId, accessToken: "shpua_real_store_access_token", active: true, updatedAt: new Date() } },
        { upsert: true }
      );

      // 2. Settings
      await settingsCol.updateOne(
        { shopId },
        {
          $set: {
            shopId,
            deadStockThresholdDays: 60,
            lowStockThresholdUnits: 5,
            stockoutPredictionDays: 7,
            markdownRule: "10% every 14 days",
            totalCashRecovered: 14250,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      // 3. DeadStock items
      await deadstocksCol.deleteMany({ shopId });
      await deadstocksCol.insertMany([
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
      ]);

      // 4. HighDemand items
      await highdemandsCol.deleteMany({ shopId });
      await highdemandsCol.insertMany([
        {
          shopId,
          productId: "gid://shopify/Product/101",
          variantId: "gid://shopify/ProductVariant/2001",
          title: "Wireless Headphones",
          sku: "WH-001",
          image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop&q=80",
          stock: 10,
          price: 89.99,
          costPrice: 40.0,
          salesLast30Days: 60,
          salesVelocity: 2.0,
          daysLeftToStockout: 5,
          riskLevel: "High",
          urgencyBadgeEnabled: true,
          preOrderEnabled: false,
          backInStockEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          shopId,
          productId: "gid://shopify/Product/102",
          variantId: "gid://shopify/ProductVariant/2002",
          title: "Running Shoes",
          sku: "RS-002",
          image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=80",
          stock: 15,
          price: 120.0,
          costPrice: 55.0,
          salesLast30Days: 45,
          salesVelocity: 1.5,
          daysLeftToStockout: 10,
          riskLevel: "Medium",
          urgencyBadgeEnabled: false,
          preOrderEnabled: true,
          backInStockEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // 5. Automations
      await automationsCol.deleteMany({ shopId });
      await automationsCol.insertMany([
        { shopId, name: "Low Stock Badge", trigger: "Stock ≤ 5", action: "Show badge on product", type: "low_stock_badge", enabled: true, createdAt: new Date() },
        { shopId, name: "Pre-Order on Out of Stock", trigger: "Stock = 0", action: "Enable pre-order button", type: "pre_order", enabled: true, createdAt: new Date() },
        { shopId, name: "Progressive Markdown", trigger: "No sale 30 days", action: "10% discount every 14 days", type: "progressive_markdown", enabled: true, createdAt: new Date() },
        { shopId, name: "Add to Clearance Collection", trigger: "No sale 60 days", action: "Add to clearance collection", type: "clearance_tagging", enabled: true, createdAt: new Date() },
      ]);

      // 6. Bundles
      await bundlesCol.deleteMany({ shopId });
      await bundlesCol.insertMany([
        { shopId, name: "Summer Bundle", type: "Bundle (BOGO)", productsCount: 2, status: "Active", performance: "$1,250", discountPercentage: 20, createdAt: new Date() },
        { shopId, name: "Flat 20% Off", type: "Discount", productsCount: 15, status: "Active", performance: "$2,300", discountPercentage: 20, createdAt: new Date() },
        { shopId, name: "Clearance Sale", type: "Discount", productsCount: 8, status: "Scheduled", performance: "$0", discountPercentage: 30, createdAt: new Date() },
      ]);

      console.log(`[${dbName}] Master seeding complete for shop: ${shopId} ✅`);
    }

    await conn.close();
  }

  console.log("--- ALL MODULES SEEDED SUCCESSFULLY IN MONGODB ATLAS ✅ ---");
}

seedAllModules().catch((err) => {
  console.error("Master Seeding Failed ❌:", err);
  process.exit(1);
});
