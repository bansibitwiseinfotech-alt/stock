const assert = require("assert");
const connectDB = require("../config/mongodb");
const SmartBadgeApplication = require("../models/SmartBadgeApplication");
const { applyBadgeToProduct, disableBadgeForProduct } = require("../services/smartBadgeApplyService");
const { getProductWidgetData, getStorefrontLaunchPreOrder } = require("../controllers/storefrontController");

async function testStorefrontIntegration() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const testShop = "promobile-hub.myshopify.com";
  const testProductId = "7634929811543";
  const gid = `gid://shopify/Product/${testProductId}`;

  console.log("==================================================");
  console.log("TESTING STOREFRONT BADGE DISPLAY ON APPLY & DELETE");
  console.log("==================================================");

  // 1. Clean previous applications
  await SmartBadgeApplication.deleteMany({
    shop: testShop,
    productId: { $in: [testProductId, gid] },
  });

  // 2. Mock storefront request before applying badge
  let mockResJson = null;
  const mockReq = {
    query: { shop: testShop, productId: testProductId },
    headers: {},
  };
  const mockRes = {
    set: () => {},
    status: () => ({
      json: (data) => { mockResJson = data; return data; },
    }),
  };

  // Test Pre-Order before apply (should be enabled only if configured in LaunchPreOrder)
  await getStorefrontLaunchPreOrder(mockReq, mockRes);
  console.log("✓ Initial Storefront Pre-Order status checked:", Boolean(mockResJson?.enabled));

  // 3. Apply PRE_ORDER badge via Smart Badges
  await applyBadgeToProduct({
    shop: testShop,
    productId: testProductId,
    badgeType: "PRE_ORDER",
  });
  console.log("✓ Applied PRE_ORDER badge via Smart Badges");

  // Verify storefront pre-order endpoint returns enabled: true
  mockResJson = null;
  await getStorefrontLaunchPreOrder(mockReq, mockRes);
  assert.strictEqual(mockResJson?.enabled, true, "Storefront Pre-Order must be enabled after applying badge");
  console.log("✓ Verified Storefront Pre-Order is ACTIVE on product page after Apply (buttonText:", mockResJson?.buttonText, ")");

  // 4. Test CLEARANCE badge apply
  await applyBadgeToProduct({
    shop: testShop,
    productId: testProductId,
    badgeType: "CLEARANCE",
  });
  console.log("✓ Applied CLEARANCE badge via Smart Badges");

  // Verify getProductWidgetData returns deadStockOffer.hasClearance: true
  mockResJson = null;
  await getProductWidgetData(mockReq, mockRes);
  assert.strictEqual(mockResJson?.deadStockOffer?.hasClearance, true, "Storefront must show clearance after applying badge");
  console.log("✓ Verified Storefront Clearance Sale is ACTIVE on product page after Apply (badgeText:", mockResJson?.deadStockOffer?.badgeText, ")");

  // 5. Test PROGRESSIVE_MARKDOWN badge apply
  await applyBadgeToProduct({
    shop: testShop,
    productId: testProductId,
    badgeType: "PROGRESSIVE_MARKDOWN",
  });
  console.log("✓ Applied PROGRESSIVE_MARKDOWN badge via Smart Badges");

  // Verify getProductWidgetData returns progressiveMarkdown.enabled: true
  mockResJson = null;
  await getProductWidgetData(mockReq, mockRes);
  assert.strictEqual(mockResJson?.progressiveMarkdown?.enabled, true, "Storefront must show progressive markdown after applying badge");
  console.log("✓ Verified Storefront Progressive Markdown is ACTIVE on product page after Apply (discount:", mockResJson?.progressiveMarkdown?.currentDiscount, "%)");

  // 6. Test DELETE / Disable badge
  await disableBadgeForProduct({
    shop: testShop,
    productId: testProductId,
    badgeType: "PROGRESSIVE_MARKDOWN",
  });
  console.log("✓ Clicked Delete / disabled badge via Smart Badges");

  // Verify storefront no longer returns markdown
  mockResJson = null;
  await getProductWidgetData(mockReq, mockRes);
  assert.strictEqual(mockResJson?.smartBadge, null, "Smart Badge must be null after Delete");
  assert.strictEqual(mockResJson?.progressiveMarkdown?.enabled, false, "Progressive Markdown must be disabled after Delete");
  console.log("✓ Verified Storefront Badge is completely REMOVED after Delete");

  console.log("==================================================");
  console.log("✓ ALL STOREFRONT SMART BADGE INTEGRATION TESTS PASSED 100%");
  console.log("==================================================");
  process.exit(0);
}

testStorefrontIntegration().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
