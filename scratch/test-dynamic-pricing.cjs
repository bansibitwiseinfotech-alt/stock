const assert = require("assert");

console.log("==================================================");
console.log("🧪 VALIDATING SHOPIFY DATA-DRIVEN PAYMENT ENGINE");
console.log("==================================================");

function parseVariantPriceCents(rawPrice) {
  if (rawPrice === null || rawPrice === undefined) return 0;
  if (typeof rawPrice === "number") {
    if (Number.isInteger(rawPrice)) {
      return rawPrice;
    }
    return Math.round(rawPrice * 100);
  }
  var str = String(rawPrice).trim();
  if (str.includes(".")) {
    var f = parseFloat(str);
    return isNaN(f) ? 0 : Math.round(f * 100);
  }
  var n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

function calculatePaymentBreakdown(unitPriceCents, quantity, depositPercentage = 50) {
  var qty = Math.max(1, parseInt(quantity, 10) || 1);
  var unitCents = Math.max(0, parseInt(unitPriceCents, 10) || 0);
  var totalCents = unitCents * qty;

  var pct = Math.max(1, Math.min(100, Number(depositPercentage) || 50));
  var isPartial = pct < 100;

  var depositCents = isPartial ? Math.round(totalCents * (pct / 100)) : totalCents;
  var remainingCents = totalCents - depositCents;

  return {
    quantity: qty,
    unitPriceCents: unitCents,
    totalCents: totalCents,
    depositPercentage: pct,
    depositCents: depositCents,
    remainingCents: remainingCents,
    formattedTotal: (totalCents / 100).toFixed(2),
    formattedDeposit: (depositCents / 100).toFixed(2),
    formattedRemaining: (remainingCents / 100).toFixed(2),
  };
}

// 1. Validation: $126,790.00
const test1 = calculatePaymentBreakdown(parseVariantPriceCents("126790.00"), 1, 50);
assert.strictEqual(test1.formattedTotal, "126790.00");
assert.strictEqual(test1.formattedDeposit, "63395.00");
assert.strictEqual(test1.formattedRemaining, "63395.00");
console.log(`✓ $126,790.00 -> Total: $${test1.formattedTotal} | 50%: $${test1.formattedDeposit} | Rem: $${test1.formattedRemaining}`);

// 2. Validation: $100.00
const test2 = calculatePaymentBreakdown(parseVariantPriceCents("100.00"), 1, 50);
assert.strictEqual(test2.formattedTotal, "100.00");
assert.strictEqual(test2.formattedDeposit, "50.00");
assert.strictEqual(test2.formattedRemaining, "50.00");
console.log(`✓ $100.00 -> Total: $${test2.formattedTotal} | 50%: $${test2.formattedDeposit} | Rem: $${test2.formattedRemaining}`);

// 3. Validation: $99.99
const test3 = calculatePaymentBreakdown(parseVariantPriceCents("99.99"), 1, 50);
assert.strictEqual(test3.formattedTotal, "99.99");
assert.strictEqual(test3.formattedDeposit, "50.00");
assert.strictEqual(test3.formattedRemaining, "49.99");
assert.strictEqual(test3.depositCents + test3.remainingCents, test3.totalCents);
console.log(`✓ $99.99 -> Total: $${test3.formattedTotal} | 50%: $${test3.formattedDeposit} | Rem: $${test3.formattedRemaining}`);

// 4. Validation: $1,250.50
const test4 = calculatePaymentBreakdown(parseVariantPriceCents("1250.50"), 1, 50);
assert.strictEqual(test4.formattedTotal, "1250.50");
assert.strictEqual(test4.formattedDeposit, "625.25");
assert.strictEqual(test4.formattedRemaining, "625.25");
console.log(`✓ $1,250.50 -> Total: $${test4.formattedTotal} | 50%: $${test4.formattedDeposit} | Rem: $${test4.formattedRemaining}`);

// 5. Validation: Quantity 2 for $126,790.00
const test5 = calculatePaymentBreakdown(parseVariantPriceCents("126790.00"), 2, 50);
assert.strictEqual(test5.formattedTotal, "253580.00");
assert.strictEqual(test5.formattedDeposit, "126790.00");
assert.strictEqual(test5.formattedRemaining, "126790.00");
console.log(`✓ $126,790.00 x Qty 2 -> Total: $${test5.formattedTotal} | 50%: $${test5.formattedDeposit} | Rem: $${test5.formattedRemaining}`);

console.log("\n🎉 ALL DYNAMIC PRICING VALIDATIONS PASSED!");
