const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("../config/mongodb");
const Subscription = require("../models/Subscription");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const HighDemand = require("../models/highDemand");
const PLAN_LIMITS = require("../config/planLimits");
const {
       checkPlanLimit,
  checkCustomizationPermission,
  requirePremiumFeature,
  incrementFeatureUsage,
  getOrCreateSubscription,
} = require("../middleware/checkPlanLimit");

// Helper to run middleware simulating express req/res
async function runMiddleware(middlewareFn, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, body: data });
      },
    };

    const next = () => {
      resolve({ status: 200, nextCalled: true, req });
    };

    middlewareFn(req, res, next).catch((err) => {
      resolve({ status: 500, error: err.message });
    });
  });
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 STARTING SMART STOCK BILLING PLANS TEST SUITE");
  console.log("=======================================================\n");

  await connectDB();

  const testShop = "billing-test-store.myshopify.com";

  // Clean up any test subscriptions and storefront records
  await Subscription.deleteMany({ shop: testShop });
  await HighDemandStorefront.deleteMany({ shop: testShop });
  await HighDemand.deleteMany({ shop: testShop });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name, details = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } else {
      console.error(`  ❌ FAIL: ${name} ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: FREE PLAN
    // -------------------------------------------------------------------------
    console.log("--- TEST SUITE 1: FREE PLAN ---");

    // Auto-create Free plan
    const subFree = await getOrCreateSubscription(testShop);
    assert(subFree.plan === "free" && subFree.status === "active", "Auto-creates Free subscription with status active");

    // Product limit check
    const freePlanLimits = PLAN_LIMITS.free;
    const requested50 = 50;
    const finalFreeLimit = Math.min(requested50, freePlanLimits.products);
    assert(finalFreeLimit === 10, "Free plan product limit is 10 (requested 50 -> capped to 10)");

    // Clearance Sale limit check (3 uses allowed)
    for (let i = 1; i <= 3; i++) {
      const res = await runMiddleware(checkPlanLimit("clearanceSale"), {
        shop: testShop,
        body: {},
      });
      assert(res.nextCalled === true, `Clearance sale check #${i} allowed`);
      await incrementFeatureUsage(testShop, "clearanceSale");
    }

    // 4th Clearance Sale attempt should be blocked
    const resClearance4th = await runMiddleware(checkPlanLimit("clearanceSale"), {
      shop: testShop,
      body: {},
    });
    assert(
      resClearance4th.status === 403 && resClearance4th.body?.upgradeRequired === true,
      "4th Clearance Sale attempt is blocked with 403 and upgradeRequired: true",
      JSON.stringify(resClearance4th.body)
    );

    // Bundle creation blocked on Free plan
    const resBundleFree = await runMiddleware(checkPlanLimit("deadStockBundle"), {
      shop: testShop,
      body: {},
    });
    assert(
      resBundleFree.status === 403 && resBundleFree.body?.currentPlan === "free",
      "Dead Stock Bundle creation blocked on Free plan (403)",
      JSON.stringify(resBundleFree.body)
    );

    // Low Stock Badge activation blocked on Free plan
    const resBadgeFree = await runMiddleware(checkPlanLimit("lowStockBadge"), {
      shop: testShop,
      body: { enabled: true },
    });
    assert(
      resBadgeFree.status === 403 && resBadgeFree.body?.currentPlan === "free",
      "Low Stock Badge activation blocked on Free plan (403)",
      JSON.stringify(resBadgeFree.body)
    );

    // Disabling Low Stock Badge should NOT be blocked even on Free plan
    const resBadgeDisableFree = await runMiddleware(checkPlanLimit("lowStockBadge"), {
      shop: testShop,
      body: { enabled: false },
    });
    assert(
      resBadgeDisableFree.nextCalled === true,
      "Disabling Low Stock Badge bypasses block and is allowed on Free plan"
    );

    // Customization permissions on Free plan
    const resCustClearanceFree = await runMiddleware(checkCustomizationPermission("clearanceSale"), { shop: testShop });
    assert(resCustClearanceFree.nextCalled === true, "Clearance Sale customization allowed on Free plan");

    const resCustBundleFree = await runMiddleware(checkCustomizationPermission("deadStockBundle"), { shop: testShop });
    assert(resCustBundleFree.status === 403, "Dead Stock Bundle customization blocked on Free plan");

    const resCustBadgeFree = await runMiddleware(checkCustomizationPermission("lowStockBadge"), { shop: testShop });
    assert(resCustBadgeFree.status === 403, "Low Stock Badge customization blocked on Free plan");

    // Premium features blocked on Free plan
    const resBulkSaleFree = await runMiddleware(requirePremiumFeature("collectionBulkSale"), { shop: testShop });
    assert(resBulkSaleFree.status === 403, "Collection Bulk Sale blocked on Free plan");

    const resEmailFree = await runMiddleware(requirePremiumFeature("emailSchedule"), { shop: testShop });
    assert(resEmailFree.status === 403, "Email Schedule blocked on Free plan");

    const resSmartBadgeFree = await runMiddleware(requirePremiumFeature("smartBadges"), { shop: testShop });
    assert(resSmartBadgeFree.status === 403, "Smart Badges blocked on Free plan");

    // -------------------------------------------------------------------------
    // TEST 2: BASIC PLAN
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: BASIC PLAN ---");

    await Subscription.findOneAndUpdate(
      { shop: testShop },
      { plan: "basic", usage: { clearanceSale: 0, deadStockBundle: 0, lowStockBadge: 0 } }
    );

    const basicPlanLimits = PLAN_LIMITS.basic;
    const finalBasicLimit = Math.min(requested50, basicPlanLimits.products);
    assert(finalBasicLimit === 25, "Basic plan product limit is 25 (requested 50 -> capped to 25)");

    // 10 bundles allowed, 11th blocked
    for (let i = 1; i <= 10; i++) {
      const res = await runMiddleware(checkPlanLimit("deadStockBundle"), { shop: testShop, body: {} });
      assert(res.nextCalled === true, `Basic bundle check #${i} allowed`);
      await incrementFeatureUsage(testShop, "deadStockBundle");
    }

    const resBundle11th = await runMiddleware(checkPlanLimit("deadStockBundle"), { shop: testShop, body: {} });
    assert(resBundle11th.status === 403, "11th Bundle attempt on Basic plan is blocked (403)");

    // Customization permissions on Basic plan
    const resCustClearanceBasic = await runMiddleware(checkCustomizationPermission("clearanceSale"), { shop: testShop });
    assert(resCustClearanceBasic.nextCalled === true, "Clearance Sale customization allowed on Basic plan");

    const resCustBundleBasic = await runMiddleware(checkCustomizationPermission("deadStockBundle"), { shop: testShop });
    assert(resCustBundleBasic.nextCalled === true, "Dead Stock Bundle customization allowed on Basic plan");

    const resCustBadgeBasic = await runMiddleware(checkCustomizationPermission("lowStockBadge"), { shop: testShop });
    assert(resCustBadgeBasic.status === 403, "Low Stock Badge customization blocked on Basic plan");

    // -------------------------------------------------------------------------
    // TEST 3: PRO PLAN
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: PRO PLAN ---");

    await Subscription.findOneAndUpdate(
      { shop: testShop },
      { plan: "pro", usage: { clearanceSale: 0, deadStockBundle: 0, lowStockBadge: 0 } }
    );

    const proPlanLimits = PLAN_LIMITS.pro;
    const finalProLimit = Math.min(requested50, proPlanLimits.products);
    assert(finalProLimit === 50, "Pro plan product limit is 50");

    // 15 Low Stock Badge activations allowed
    for (let i = 1; i <= 15; i++) {
      const res = await runMiddleware(checkPlanLimit("lowStockBadge"), { shop: testShop, body: { enabled: true } });
      assert(res.nextCalled === true, `Pro low stock badge check #${i} allowed`);
      await incrementFeatureUsage(testShop, "lowStockBadge");
    }

    const resBadge16th = await runMiddleware(checkPlanLimit("lowStockBadge"), { shop: testShop, body: { enabled: true } });
    assert(resBadge16th.status === 403, "16th Low Stock Badge activation on Pro plan is blocked (403)");

    // Customization permissions on Pro plan
    const resCustBadgePro = await runMiddleware(checkCustomizationPermission("lowStockBadge"), { shop: testShop });
    assert(resCustBadgePro.nextCalled === true, "Low Stock Badge customization allowed on Pro plan");

    const resCustMarkdownPro = await runMiddleware(checkCustomizationPermission("progressiveMarkdown"), { shop: testShop });
    assert(resCustMarkdownPro.status === 403, "Progressive Markdown customization blocked on Pro plan");

    // -------------------------------------------------------------------------
    // TEST 4: PREMIUM PLAN
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: PREMIUM PLAN ---");

    await Subscription.findOneAndUpdate(
      { shop: testShop },
      { plan: "premium", usage: { clearanceSale: 99, deadStockBundle: 99, lowStockBadge: 99 } }
    );

    const premiumPlanLimits = PLAN_LIMITS.premium;
    assert(premiumPlanLimits.products === Infinity, "Premium plan product limit is Infinity (unlimited)");

    // Unlimited checks
    const resClearancePrem = await runMiddleware(checkPlanLimit("clearanceSale"), { shop: testShop, body: {} });
    assert(resClearancePrem.nextCalled === true, "Clearance Sale unlimited on Premium plan");

    const resBundlePrem = await runMiddleware(checkPlanLimit("deadStockBundle"), { shop: testShop, body: {} });
    assert(resBundlePrem.nextCalled === true, "Dead Stock Bundle unlimited on Premium plan");

    const resBadgePrem = await runMiddleware(checkPlanLimit("lowStockBadge"), { shop: testShop, body: { enabled: true } });
    assert(resBadgePrem.nextCalled === true, "Low Stock Badge unlimited on Premium plan");

    const resMarkdownPrem = await runMiddleware(checkPlanLimit("progressiveMarkdown"), { shop: testShop, body: {} });
    assert(resMarkdownPrem.nextCalled === true, "Progressive Markdown unlimited on Premium plan");

    const resPreOrderPrem = await runMiddleware(checkPlanLimit("launchPreOrder"), { shop: testShop, body: {} });
    assert(resPreOrderPrem.nextCalled === true, "Launch Pre-Order unlimited on Premium plan");

    // Premium features allowed
    const resBulkSalePrem = await runMiddleware(requirePremiumFeature("collectionBulkSale"), { shop: testShop });
    assert(resBulkSalePrem.nextCalled === true, "Collection Bulk Sale allowed on Premium plan");

    const resEmailPrem = await runMiddleware(requirePremiumFeature("emailSchedule"), { shop: testShop });
    assert(resEmailPrem.nextCalled === true, "Email Schedule allowed on Premium plan");

    const resSmartBadgePrem = await runMiddleware(requirePremiumFeature("smartBadges"), { shop: testShop });
    assert(resSmartBadgePrem.nextCalled === true, "Smart Badges allowed on Premium plan");

    // All customizations allowed
    for (const feat of ["clearanceSale", "deadStockBundle", "lowStockBadge", "progressiveMarkdown", "launchPreOrder"]) {
      const resCust = await runMiddleware(checkCustomizationPermission(feat), { shop: testShop });
      assert(resCust.nextCalled === true, `${feat} customization allowed on Premium plan`);
    }

    // Clean up test data
    await Subscription.deleteMany({ shop: testShop });
    await HighDemandStorefront.deleteMany({ shop: testShop });
    await HighDemand.deleteMany({ shop: testShop });

    console.log("\n=======================================================");
    console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runTests();
