const assert = require("assert");

function testDepositCalculation(productPrice, depositPercentage) {
  const depositPrice = ((productPrice * depositPercentage) / 100).toFixed(2);
  const remainingPrice = (productPrice - parseFloat(depositPrice)).toFixed(2);
  return { depositPrice, remainingPrice };
}

function testPriceToPercentage(productPrice, depositPrice) {
  return Math.max(1, Math.min(100, Math.round((depositPrice / productPrice) * 100)));
}

console.log("==================================================");
console.log("🧪 TESTING DEPOSIT PERCENTAGE & PRICE-WISE INPUTS");
console.log("==================================================");

// Case 1: Apple iPhone 17 Pro ($126,790.00) @ 50%
const c1 = testDepositCalculation(126790, 50);
console.log(`✓ $126,790.00 @ 50% -> Deposit: $${c1.depositPrice} | Remaining: $${c1.remainingPrice}`);
assert.strictEqual(c1.depositPrice, "63395.00");
assert.strictEqual(c1.remainingPrice, "63395.00");

// Case 2: Enter $63,395.00 -> Converts back to 50%
const p1 = testPriceToPercentage(126790, 63395);
console.log(`✓ $63,395.00 of $126,790.00 -> Percentage: ${p1}%`);
assert.strictEqual(p1, 50);

// Case 3: $55,799.10 @ 30%
const c2 = testDepositCalculation(55799.10, 30);
console.log(`✓ $55,799.10 @ 30% -> Deposit: $${c2.depositPrice} | Remaining: $${c2.remainingPrice}`);
assert.strictEqual(c2.depositPrice, "16739.73");

// Case 4: $100.00 @ 25%
const c3 = testDepositCalculation(100, 25);
console.log(`✓ $100.00 @ 25% -> Deposit: $${c3.depositPrice} | Remaining: $${c3.remainingPrice}`);
assert.strictEqual(c3.depositPrice, "25.00");
assert.strictEqual(c3.remainingPrice, "75.00");

console.log("\n🎉 ALL PRICE-WISE DEPOSIT TESTS PASSED!");
console.log("==================================================");
