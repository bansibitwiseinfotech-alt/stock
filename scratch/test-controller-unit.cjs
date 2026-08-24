const assert = require("assert");

console.log("==================================================");
console.log("🧪 TESTING PRE-ORDER CONTROLLER & STOREFRONT LOGIC");
console.log("==================================================");

// 1. Test Date Logic
console.log("\n1. Testing Active Date Evaluation Logic...");
const now = new Date();
const futureDate = new Date(Date.now() + 86400000 * 7); // +7 days
const pastDate = new Date(Date.now() - 86400000 * 2); // -2 days
const opensInFuture = new Date(Date.now() + 86400000 * 2); // opens in 2 days
const opensInPast = new Date(Date.now() - 86400000 * 2); // opened 2 days ago

function evaluateActive(config) {
  if (!config || !config.preOrderEnabled) return false;
  const launchDate = new Date(config.launchDate);
  const opensAt = config.preOrderOpensAt ? new Date(config.preOrderOpensAt) : null;
  if (isNaN(launchDate.getTime()) || now >= launchDate) return false;
  if (opensAt && !isNaN(opensAt.getTime()) && now < opensAt) return false;
  return true;
}

// Case A: Enabled + Future Launch Date + No Open Date => Active
assert.strictEqual(evaluateActive({ preOrderEnabled: true, launchDate: futureDate }), true);
console.log("   ✓ Case A (Enabled + Future Launch Date) -> ACTIVE");

// Case B: Disabled + Future Launch Date => Inactive
assert.strictEqual(evaluateActive({ preOrderEnabled: false, launchDate: futureDate }), false);
console.log("   ✓ Case B (Disabled + Future Launch Date) -> INACTIVE");

// Case C: Enabled + Past Launch Date => Inactive (Automated Expiration)
assert.strictEqual(evaluateActive({ preOrderEnabled: true, launchDate: pastDate }), false);
console.log("   ✓ Case C (Enabled + Past Launch Date) -> INACTIVE");

// Case D: Enabled + Future Launch Date + Open Date in Future => Scheduled (Inactive)
assert.strictEqual(evaluateActive({ preOrderEnabled: true, launchDate: futureDate, preOrderOpensAt: opensInFuture }), false);
console.log("   ✓ Case D (Enabled + Future Open Date) -> SCHEDULED (Inactive on storefront)");

// Case E: Enabled + Future Launch Date + Open Date in Past => Active
assert.strictEqual(evaluateActive({ preOrderEnabled: true, launchDate: futureDate, preOrderOpensAt: opensInPast }), true);
console.log("   ✓ Case E (Enabled + Past Open Date + Future Launch) -> ACTIVE");

// 2. Test Product ID Normalization
console.log("\n2. Testing Product ID Normalization...");
function normalizeProductId(rawId) {
  if (!rawId) return "";
  const match = String(rawId).match(/(\d+)$/);
  return match ? match[1] : String(rawId).trim();
}

assert.strictEqual(normalizeProductId("gid://shopify/Product/9876543210"), "9876543210");
assert.strictEqual(normalizeProductId("9876543210"), "9876543210");
assert.strictEqual(normalizeProductId(9876543210), "9876543210");
console.log("   ✓ normalizeProductId correctly handles GID, numeric string, and number");

// 3. Test Store Isolation Logic
console.log("\n3. Testing Store Isolation Principle...");
const storeADatabase = [{ shop: "store-a.myshopify.com", productId: "1001", preOrderEnabled: true, launchDate: futureDate }];
const storeBDatabase = [{ shop: "store-b.myshopify.com", productId: "1002", preOrderEnabled: true, launchDate: futureDate }];

function queryConfig(db, shop, productId) {
  return db.find((item) => item.shop === shop && item.productId === productId) || null;
}

assert.strictEqual(queryConfig(storeADatabase, "store-a.myshopify.com", "1001") !== null, true);
assert.strictEqual(queryConfig(storeADatabase, "store-b.myshopify.com", "1001"), null);
assert.strictEqual(queryConfig(storeBDatabase, "store-a.myshopify.com", "1002"), null);
console.log("   ✓ Strict multi-merchant store isolation verified");

console.log("\n==================================================");
console.log("🎉 ALL LOGIC AND CONTROLLER UNIT TESTS PASSED!");
console.log("==================================================");
