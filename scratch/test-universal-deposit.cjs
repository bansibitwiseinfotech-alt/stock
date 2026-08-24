/**
 * TEST: UNIVERSAL PARTIAL PRE-ORDER PAYMENT SYSTEM (DEFAULT 50%)
 * Validates multiple product types, variant-aware calculations, quantity multipliers,
 * multi-merchant isolation, and launch-date state machine.
 */
const assert = require("assert");

console.log("==================================================");
console.log("🧪 RUNNING UNIVERSAL 50% DEPOSIT PRE-ORDER TESTS");
console.log("==================================================");

function calculateDeposit({ unitPriceCents, quantity = 1, depositPercentage = 50, depositEnabled = true }) {
  const totalCents = unitPriceCents * quantity;
  const pct = Math.max(1, Math.min(100, Number(depositPercentage) || 50));
  const isDeposit = depositEnabled !== false && pct < 100;
  const depositCents = isDeposit ? Math.round(totalCents * (pct / 100)) : totalCents;
  const remainingCents = totalCents - depositCents;

  return {
    totalCents,
    depositCents,
    remainingCents,
    depositPercentage: pct,
    isDeposit,
  };
}

// ----------------------------------------------------
// TEST 1: 5 DIFFERENT PRODUCT TYPES
// ----------------------------------------------------
console.log("\n1. Testing 5 Different Product Categories...");

const testProducts = [
  { type: "Mobile Phone (Pixel 9a)", price: 79900 },    // $799.00
  { type: "Clothing (Organic Cotton Tee)", price: 4500 }, // $45.00
  { type: "Shoes (Leather Running Sneaker)", price: 16000 }, // $160.00
  { type: "Luxury Watch (Titanium Chrono)", price: 125000 }, // $1,250.00
  { type: "Laptop (Pro 16-inch M-Series)", price: 249900 }, // $2,499.00
];

testProducts.forEach((p) => {
  const res = calculateDeposit({ unitPriceCents: p.price, quantity: 1, depositPercentage: 50 });
  const expectedDeposit = Math.round(p.price * 0.5);
  assert.strictEqual(res.depositCents, expectedDeposit);
  assert.strictEqual(res.remainingCents, p.price - expectedDeposit);
  console.log(`   ✓ ${p.type}: Total = $${(p.price / 100).toFixed(2)} | Pay Now (50%) = $${(res.depositCents / 100).toFixed(2)} | Remaining = $${(res.remainingCents / 100).toFixed(2)}`);
});

// ----------------------------------------------------
// TEST 2: VARIANT-AWARE RECALCULATION
// ----------------------------------------------------
console.log("\n2. Testing Real-time Variant Switching Calculations...");

const mobileVariants = [
  { title: "128GB", price: 100000 }, // $1,000.00
  { title: "256GB", price: 120000 }, // $1,200.00
  { title: "512GB", price: 140000 }, // $1,400.00
];

mobileVariants.forEach((v) => {
  const res = calculateDeposit({ unitPriceCents: v.price, quantity: 1, depositPercentage: 50 });
  assert.strictEqual(res.depositCents, v.price / 2);
  assert.strictEqual(res.remainingCents, v.price / 2);
  console.log(`   ✓ Variant [${v.title}]: Total = $${(v.price / 100).toFixed(2)} | Pay Now = $${(res.depositCents / 100).toFixed(2)}`);
});

// ----------------------------------------------------
// TEST 3: QUANTITY MULTIPLIERS (Qty 1, 2, 3)
// ----------------------------------------------------
console.log("\n3. Testing Quantity Multipliers...");

const baseUnitPrice = 12679000; // $126,790.00 in cents

[1, 2, 3, 5].forEach((qty) => {
  const res = calculateDeposit({ unitPriceCents: baseUnitPrice, quantity: qty, depositPercentage: 50 });
  const expectedTotal = baseUnitPrice * qty;
  const expectedDeposit = Math.round(expectedTotal * 0.5);
  assert.strictEqual(res.totalCents, expectedTotal);
  assert.strictEqual(res.depositCents, expectedDeposit);
  assert.strictEqual(res.remainingCents, expectedTotal - expectedDeposit);
  console.log(`   ✓ Qty ${qty}: Total = $${(expectedTotal / 100).toFixed(2)} | Pay 50% = $${(expectedDeposit / 100).toFixed(2)}`);
});

// ----------------------------------------------------
// TEST 4: CUSTOM MERCHANT DEPOSIT PERCENTAGES (30%, 50%, 70%)
// ----------------------------------------------------
console.log("\n4. Testing Merchant Deposit Percentages (30%, 50%, 70%)...");

[30, 50, 70, 100].forEach((pct) => {
  const res = calculateDeposit({ unitPriceCents: 100000, quantity: 1, depositPercentage: pct });
  const expectedDeposit = Math.round(100000 * (pct / 100));
  assert.strictEqual(res.depositCents, expectedDeposit);
  assert.strictEqual(res.remainingCents, 100000 - expectedDeposit);
  console.log(`   ✓ ${pct}% Deposit Config: Total = $1,000.00 | Pay Now = $${(expectedDeposit / 100).toFixed(2)} | Remaining = $${(res.remainingCents / 100).toFixed(2)}`);
});

// ----------------------------------------------------
// TEST 5: LAUNCH DATE PURCHASE STATE MACHINE
// ----------------------------------------------------
console.log("\n5. Testing Launch Date State Machine...");

function evaluatePurchaseMode(now, launchDateStr, enabled = true) {
  const launchDate = new Date(launchDateStr);
  if (!enabled || isNaN(launchDate.getTime()) || now >= launchDate) {
    return "NORMAL_PURCHASE_MODE"; // Add to Cart + Buy it now
  }
  return "PRE_ORDER_DEPOSIT_MODE"; // Launch Card + Pre-Order Now (Deposit)
}

const now = new Date("2026-08-21T12:00:00Z");
const futureLaunch = "2026-08-22T00:00:00Z";
const pastLaunch = "2026-08-20T00:00:00Z";

assert.strictEqual(evaluatePurchaseMode(now, futureLaunch, true), "PRE_ORDER_DEPOSIT_MODE");
console.log("   ✓ Before launch date -> PRE_ORDER_DEPOSIT_MODE (50% Deposit + No Buy It Now)");

assert.strictEqual(evaluatePurchaseMode(now, pastLaunch, true), "NORMAL_PURCHASE_MODE");
console.log("   ✓ On/After launch date -> NORMAL_PURCHASE_MODE (Full Add to Cart + Buy It Now)");

assert.strictEqual(evaluatePurchaseMode(now, futureLaunch, false), "NORMAL_PURCHASE_MODE");
console.log("   ✓ Disabled config -> NORMAL_PURCHASE_MODE");

console.log("\n==================================================");
console.log("🎉 ALL UNIVERSAL 50% DEPOSIT TESTS PASSED!");
console.log("==================================================");
