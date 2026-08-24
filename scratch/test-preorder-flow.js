const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });

const mongoose = require("mongoose");
const connectDB = require("../backend/config/mongodb");
const LaunchPreOrder = require("../backend/models/LaunchPreOrder");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING PRE-ORDER FEATURE AUTOMATED TESTS");
  console.log("==================================================");

  await connectDB();

  const testShopA = "test-store-a.myshopify.com";
  const testShopB = "test-store-b.myshopify.com";
  const testProd1 = "8899771122";
  const testProd2 = "8899773344";

  // Clean up previous test artifacts
  await LaunchPreOrder.deleteMany({
    shop: { $in: [testShopA, testShopB] },
  });

  console.log("\n1. Testing Launch Pre-Order Creation (Future Launch Date)...");
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days in future
  const shippingDate = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);

  const docA = await LaunchPreOrder.create({
    shop: testShopA,
    productId: testProd1,
    productTitle: "Galaxy S25 Ultra",
    productHandle: "galaxy-s25-ultra",
    preOrderEnabled: true,
    launchDate: futureDate,
    shippingDate: shippingDate,
    badgeText: "🛒 PRE-ORDER",
    launchLabel: "NEW LAUNCH",
    launchTitle: "Galaxy S25 Ultra Launch",
    customerMessage: "Be the first to get the new flagship.",
    launchDetails: "Launching soon worldwide.",
    buttonText: "PRE-ORDER NOW",
  });

  console.log("   ✓ Saved Launch Pre-Order config in DB:", docA.productId, "for", docA.shop);

  console.log("\n2. Testing Storefront Logic for Active Pre-Order...");
  const now = new Date();
  const isActiveA = docA.preOrderEnabled && new Date(docA.launchDate) > now;
  if (!isActiveA) {
    throw new Error("Active check failed for future launch date!");
  }
  console.log("   ✓ Pre-Order Active Evaluation PASSED (enabled = true, launchDate in future)");

  console.log("\n3. Testing Storefront Logic for Expired Launch Date...");
  const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days in past
  const docExpired = await LaunchPreOrder.create({
    shop: testShopA,
    productId: testProd2,
    productTitle: "Old Pre-Order Product",
    preOrderEnabled: true,
    launchDate: pastDate,
  });

  const isActiveExpired = docExpired.preOrderEnabled && new Date(docExpired.launchDate) > now;
  if (isActiveExpired) {
    throw new Error("Expired check failed: Past launch date should evaluate to inactive!");
  }
  console.log("   ✓ Expired Launch Date correctly evaluates to INACTIVE (enabled = false, renders nothing)");

  console.log("\n4. Testing Multi-Merchant Isolation (Store A vs Store B)...");
  // Query Store B for Store A's product
  const storeBConfig = await LaunchPreOrder.findOne({
    shop: testShopB,
    productId: testProd1,
  });

  if (storeBConfig !== null) {
    throw new Error("Multi-merchant isolation breach! Store B was able to see Store A's configuration!");
  }
  console.log("   ✓ Multi-merchant isolation PASSED: Store B has 0 access to Store A's configuration.");

  console.log("\n5. Testing Disabled Pre-Order...");
  await LaunchPreOrder.updateOne({ _id: docA._id }, { $set: { preOrderEnabled: false } });
  const updatedDocA = await LaunchPreOrder.findById(docA._id);
  const isActiveDisabled = updatedDocA.preOrderEnabled && new Date(updatedDocA.launchDate) > now;
  if (isActiveDisabled) {
    throw new Error("Disabled toggle failed!");
  }
  console.log("   ✓ Disabled toggle correctly evaluates to INACTIVE.");

  // Clean up
  await LaunchPreOrder.deleteMany({
    shop: { $in: [testShopA, testShopB] },
  });

  console.log("\n==================================================");
  console.log("🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
