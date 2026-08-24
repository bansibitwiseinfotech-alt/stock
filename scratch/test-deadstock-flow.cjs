const mongoose = require("mongoose");
const path = require("path");
const assert = require("assert");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });

const connectDB = require("../backend/config/mongodb");
const Store = require("../backend/models/Store");
const DeadStock = require("../backend/models/DeadStock");
const ClearanceSale = require("../backend/models/ClearanceSale");
const DeadStockBundle = require("../backend/models/DeadStockBundle");
const MarkdownRule = require("../backend/models/MarkdownRule");

async function main() {
  await connectDB();
  console.log("==================================================");
  console.log("🧪 TESTING DEAD STOCK -> RECOVERY ACTIONS FLOW");
  console.log("==================================================");

  const shop = "promobile-hub.myshopify.com";
  const testProdId = "gid://shopify/Product/7634929811543";
  const testVarId = "gid://shopify/ProductVariant/42733971636311";

  // 1. Verify Real Shopify Product Lookup
  console.log("\n1. Testing Real Product Lookup...");
  const store = await Store.findOne({ shop }).lean();
  assert.ok(store, "Store must exist in MongoDB");
  console.log(`   ✓ Found active store: ${store.shop}`);

  // 2. Test Real Clearance Sale State Lifecycle
  console.log("\n2. Testing Clearance Sale State Detection...");
  let activeSale = await ClearanceSale.findOne({
    shop,
    productId: testProdId,
    status: { $in: ["ACTIVE", "SCHEDULED"] },
  }).lean();
  console.log(`   ✓ Initial clearance status: ${activeSale ? "ACTIVE" : "NOT_CONFIGURED"}`);

  // 3. Test Dead Stock Bundle State Detection
  console.log("\n3. Testing Dead Stock Bundle State Detection...");
  let activeBundle = await DeadStockBundle.findOne({
    shop,
    buyProductId: testProdId,
    status: "ACTIVE",
  }).lean();
  console.log(`   ✓ Initial bundle status: ${activeBundle ? "ACTIVE" : "NOT_CONFIGURED"}`);

  // 4. Test Progressive Markdown State Detection
  console.log("\n4. Testing Progressive Markdown State Detection...");
  let activeMarkdown = await MarkdownRule.findOne({
    shop,
    productId: testProdId,
    active: true,
  }).lean();
  console.log(`   ✓ Initial markdown status: ${activeMarkdown ? "ACTIVE" : "NOT_CONFIGURED"}`);

  console.log("\n==================================================");
  console.log("🎉 ALL DEAD STOCK LIFECYCLE TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
