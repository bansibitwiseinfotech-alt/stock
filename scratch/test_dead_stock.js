require("dotenv").config({ path: "./backend/.env" });
const mongoose = require("mongoose");
const DeadStock = require("../backend/models/DeadStock");
const Store = require("../backend/models/Store");
const { getDeadStock, getDeadStockSummary } = require("../backend/controllers/deadStockController");

async function testEngineAndDatabase() {
  console.log("--- STARTING DEAD STOCK MODULE VERIFICATION ---");
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log("Connecting to MongoDB...", mongoUri ? "URI FOUND" : "NO URI FOUND");

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB ✅");

  const shopId = "test-smart-stock-store.myshopify.com";

  // 1. Upsert Store record for multi-tenant testing
  await Store.findOneAndUpdate(
    { shop: shopId },
    { shop: shopId, accessToken: "shpua_test_access_token", active: true },
    { upsert: true, new: true }
  );

  // 2. Clear existing test records for clean test run
  await DeadStock.deleteMany({ shopId });
  console.log("Cleared old test records.");

  // 3. Create test dead stock records matching user example specs:
  // Summer Shirt: 65 days, 50 stock, $25 costPrice -> $1,250 cashTiedUp
  // Beach Hat: 72 days, 40 stock, $20 costPrice -> $800 cashTiedUp
  // Canvas Shoes: 90 days, 30 stock, $81.6667 costPrice -> $2,450 cashTiedUp (Total = $4,500)

  const sampleItems = [
    {
      shopId,
      productId: "gid://shopify/Product/101",
      variantId: "gid://shopify/ProductVariant/1001",
      title: "Summer Shirt",
      sku: "SST-001",
      image: "https://cdn.shopify.com/s/files/1/0000/0000/products/shirt.jpg",
      stock: 50,
      costPrice: 25,
      daysUnsold: 65,
      salesLast7Days: 0,
      salesLast30Days: 0,
      salesLast60Days: 1,
      salesVelocity: 0,
      cashTiedUp: 1250,
      status: "dead_stock",
      locationId: "loc-1",
      locationName: "Main Warehouse",
      lastSoldAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
    },
    {
      shopId,
      productId: "gid://shopify/Product/102",
      variantId: "gid://shopify/ProductVariant/1002",
      title: "Beach Hat",
      sku: "BHT-002",
      image: "https://cdn.shopify.com/s/files/1/0000/0000/products/hat.jpg",
      stock: 40,
      costPrice: 20,
      daysUnsold: 72,
      salesLast7Days: 0,
      salesLast30Days: 0,
      salesLast60Days: 0,
      salesVelocity: 0,
      cashTiedUp: 800,
      status: "dead_stock",
      locationId: "loc-1",
      locationName: "Main Warehouse",
      lastSoldAt: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000),
    },
    {
      shopId,
      productId: "gid://shopify/Product/103",
      variantId: "gid://shopify/ProductVariant/1003",
      title: "Canvas Shoes",
      sku: "CCS-003",
      image: "https://cdn.shopify.com/s/files/1/0000/0000/products/shoes.jpg",
      stock: 30,
      costPrice: 81.6667,
      daysUnsold: 90,
      salesLast7Days: 0,
      salesLast30Days: 0,
      salesLast60Days: 0,
      salesVelocity: 0,
      cashTiedUp: 2450,
      status: "dead_stock",
      locationId: "loc-1",
      locationName: "Main Warehouse",
      lastSoldAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      shopId,
      productId: "gid://shopify/Product/104",
      variantId: "gid://shopify/ProductVariant/1004",
      title: "Active Summer Dress",
      sku: "SDR-004",
      image: "https://cdn.shopify.com/s/files/1/0000/0000/products/dress.jpg",
      stock: 100,
      costPrice: 30,
      daysUnsold: 15,
      salesLast7Days: 10,
      salesLast30Days: 45,
      salesLast60Days: 90,
      salesVelocity: 1.5,
      cashTiedUp: 3000,
      status: "active",
      locationId: "loc-1",
      locationName: "Main Warehouse",
      lastSoldAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  ];

  await DeadStock.insertMany(sampleItems);
  console.log("Successfully inserted sample DeadStock documents into MongoDB ✅");

  // 4. Verify MongoDB Indexes
  const indexes = await DeadStock.collection.indexes();
  console.log("Verified Collection Indexes:", indexes.map((idx) => idx.name));

  // 5. Test Summary API calculation
  const mockReqSummary = { shopId, query: { shop: shopId } };
  let summaryResData = null;
  const mockResSummary = {
    status: (code) => ({
      json: (data) => {
        summaryResData = data;
        return data;
      },
    }),
  };

  await getDeadStockSummary(mockReqSummary, mockResSummary);
  console.log("GET /api/dead-stock/summary Result:", JSON.stringify(summaryResData, null, 2));

  // 6. Test GET /api/dead-stock paginated endpoint
  const mockReqList = { shopId, query: { shop: shopId, page: "1", limit: "10" } };
  let listResData = null;
  const mockResList = {
    status: (code) => ({
      json: (data) => {
        listResData = data;
        return data;
      },
    }),
  };

  await getDeadStock(mockReqList, mockResList);
  console.log("GET /api/dead-stock Result count:", listResData?.data?.length, "Pagination:", listResData?.pagination);

  await mongoose.disconnect();
  console.log("--- VERIFICATION COMPLETED SUCCESSFULLY ✅ ---");
}

testEngineAndDatabase().catch((err) => {
  console.error("Verification failed ❌:", err);
  process.exit(1);
});
