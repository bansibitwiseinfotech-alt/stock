const assert = require("assert");
const connectDB = require("../config/mongodb");
const SmartBadgeApplication = require("../models/SmartBadgeApplication");
const { applyBadgeToProduct, disableBadgeForProduct } = require("../services/smartBadgeApplyService");

async function testApplyAndDisablePersistence() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const testShop = "promobile-hub.myshopify.com";
  const testProductId = "gid://shopify/Product/987654321";
  const numericId = "987654321";

  console.log("--------------------------------------------------");
  console.log("TESTING APPLY & DISABLE PERSISTENCE ACROSS REFRESH");
  console.log("--------------------------------------------------");

  // 1. Clean previous test data
  await SmartBadgeApplication.deleteMany({ shop: testShop, productId: { $in: [testProductId, numericId] } });

  // 2. Apply badge using full GID
  const applyRes = await applyBadgeToProduct({
    shop: testShop,
    productId: testProductId,
    badgeType: "CLEARANCE",
  });
  console.log("✓ Applied badge:", applyRes.application.badgeType, "to", applyRes.application.productId);
  assert.strictEqual(applyRes.application.enabled, true);

  // 3. Verify it shows as enabled in DB
  const docAfterApply = await SmartBadgeApplication.findOne({
    shop: testShop,
    productId: { $in: [testProductId, numericId] },
    enabled: true,
  });
  assert.ok(docAfterApply, "Should find active application in DB");
  console.log("✓ Verified active in DB after apply");

  // 4. Disable using numeric ID (as sent from frontend URL param)
  const disableRes = await disableBadgeForProduct({
    shop: testShop,
    productId: numericId,
    badgeType: "CLEARANCE",
  });
  console.log("✓ Disabled badge via numeric ID:", disableRes);

  // 5. Verify NO enabled document exists in DB (simulate Refresh)
  const docAfterDisable = await SmartBadgeApplication.findOne({
    shop: testShop,
    productId: { $in: [testProductId, numericId] },
    enabled: true,
  });
  assert.strictEqual(docAfterDisable, null, "Should NOT find active application in DB after disable");
  console.log("✓ Verified application is disabled in DB across refresh (doc is null / disabled)");

  console.log("--------------------------------------------------");
  console.log("✓ ALL APPLY & DISABLE PERSISTENCE TESTS PASSED 100%");
  console.log("--------------------------------------------------");
  process.exit(0);
}

testApplyAndDisablePersistence().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
