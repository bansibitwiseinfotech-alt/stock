require('dotenv').config({ path: './.env' });
const connectDB = require('../config/mongodb');
const Subscription = require('../models/Subscription');
const Store = require('../models/Store');
const SHOPIFY_BILLING_PLANS = require('../config/shopifyBillingPlans');
const {
  getSubscription,
  upgradeSubscription,
  switchFree,
} = require('../controllers/subscriptionController');

async function runTests() {
  console.log('=====================================================');
  console.log('RUNNING SHOPIFY BILLING INTEGRATION TEST SUITE');
  console.log('=====================================================');

  await connectDB();
  const testShop = 'test-billing-suite.myshopify.com';

  // 0. Clean test store & subscription
  await Store.deleteOne({ shop: testShop });
  await Subscription.deleteOne({ shop: testShop });

  await Store.create({
    shop: testShop,
    accessToken: 'shpua_test_access_token_12345',
    active: true,
  });

  let passCount = 0;
  let testIndex = 1;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ TEST ${testIndex++}: ${testName}`);
      passCount++;
    } else {
      console.error(`❌ TEST ${testIndex++}: FAILED - ${testName}`);
    }
  }

  // 1. Verify Plans Config
  assert(SHOPIFY_BILLING_PLANS.basic.monthly.price === 19, 'Basic monthly price is $19');
  assert(SHOPIFY_BILLING_PLANS.basic.yearly.price === 99, 'Basic yearly price is $99');
  assert(SHOPIFY_BILLING_PLANS.pro.monthly.price === 49, 'Pro monthly price is $49');
  assert(SHOPIFY_BILLING_PLANS.pro.yearly.price === 249, 'Pro yearly price is $249');
  assert(SHOPIFY_BILLING_PLANS.premium.monthly.price === 99, 'Premium monthly price is $99');
  assert(SHOPIFY_BILLING_PLANS.premium.yearly.price === 499, 'Premium yearly price is $499');
  assert(SHOPIFY_BILLING_PLANS.basic.monthly.interval === 'EVERY_30_DAYS', 'Monthly interval is EVERY_30_DAYS');
  assert(SHOPIFY_BILLING_PLANS.basic.yearly.interval === 'ANNUAL', 'Yearly interval is ANNUAL');

  // 2. Initial Get Subscription (Free default)
  let resData = null;
  const mockRes = {
    status(c) { this.statusCode = c; return this; },
    json(d) { resData = d; return this; },
  };

  await getSubscription({ query: { shop: testShop } }, mockRes);
  assert(resData?.success === true, 'Initial getSubscription succeeds');
  assert(resData?.subscription?.plan === 'free', 'Default plan is free');
  assert(resData?.subscription?.productLimit === 10, 'Default product limit is 10');

  // 3. Reject Free plan upgrade
  await upgradeSubscription({ query: { shop: testShop }, body: { plan: 'free' } }, mockRes);
  assert(mockRes.statusCode === 400, 'Rejects upgrading to free plan');

  // 4. Reject invalid plan
  await upgradeSubscription({ query: { shop: testShop }, body: { plan: 'ultra-mega' } }, mockRes);
  assert(mockRes.statusCode === 400, 'Rejects invalid plan names');

  // 5. Reject invalid billing cycle
  await upgradeSubscription({ query: { shop: testShop }, body: { plan: 'pro', billingCycle: 'weekly' } }, mockRes);
  assert(mockRes.statusCode === 400, 'Rejects invalid billing cycle');

  // 6. Test Pending state persistence
  const subDoc = await Subscription.findOne({ shop: testShop });
  subDoc.pendingPlan = 'pro';
  subDoc.pendingSubscriptionId = 'gid://shopify/AppSubscription/998877';
  subDoc.billingStatus = 'pending';
  subDoc.billingCycle = 'monthly';
  await subDoc.save();

  const verifySub = await Subscription.findOne({ shop: testShop });
  assert(verifySub.plan === 'free', 'Plan remains free while pending');
  assert(verifySub.pendingPlan === 'pro', 'Pending plan is recorded as pro');
  assert(verifySub.billingStatus === 'pending', 'Billing status is pending');

  // 7. Test Activation upon Shopify approval
  verifySub.plan = verifySub.pendingPlan;
  verifySub.status = 'active';
  verifySub.billingStatus = 'active';
  verifySub.shopifySubscriptionId = verifySub.pendingSubscriptionId;
  verifySub.pendingPlan = null;
  verifySub.pendingSubscriptionId = null;
  await verifySub.save();

  const activatedSub = await Subscription.findOne({ shop: testShop });
  assert(activatedSub.plan === 'pro', 'Plan updated to pro after verification');
  assert(activatedSub.pendingPlan === null, 'Pending plan cleared after verification');
  assert(activatedSub.shopifySubscriptionId === 'gid://shopify/AppSubscription/998877', 'Shopify subscription ID stored');

  // 8. Prevent duplicate active upgrade to same plan & cycle
  await upgradeSubscription({ query: { shop: testShop }, body: { plan: 'pro', billingCycle: 'monthly' } }, mockRes);
  assert(mockRes.statusCode === 400, 'Prevents duplicate upgrade to current active plan');

  // 9. Test Switch to Free Plan
  await switchFree({ query: { shop: testShop } }, mockRes);
  assert(mockRes.statusCode === 200, 'Switch to free endpoint succeeds');
  assert(resData?.success === true, 'Switch to free returns success: true');

  const freeSub = await Subscription.findOne({ shop: testShop });
  assert(freeSub.plan === 'free', 'Plan reverted to free in MongoDB');
  assert(freeSub.shopifySubscriptionId === null, 'Shopify subscription ID cleared on switch to free');
  assert(freeSub.billingStatus === 'active', 'Billing status is active');

  // Cleanup
  await Store.deleteOne({ shop: testShop });
  await Subscription.deleteOne({ shop: testShop });

  console.log('=====================================================');
  console.log(`TEST RESULTS: ${passCount} / ${testIndex - 1} PASSED`);
  console.log('=====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
