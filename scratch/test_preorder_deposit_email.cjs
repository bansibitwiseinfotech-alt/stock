const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../backend/config/mongodb");
const { processPreOrderDepositWebhook } = require("../backend/services/preOrderDepositWebhookService");
const PreOrderNotificationLog = require("../backend/models/PreOrderNotificationLog");

async function runFreshTest() {
  await connectDB();
  console.log("=== RUNNING FRESH DEPOSIT EMAIL TEST WITH ORDER #1062 PAYLOAD ===\n");

  const testShop = "promobile-hub.myshopify.com";
  const testOrderId = "1062";

  // Clean up order 1062 test log
  await PreOrderNotificationLog.deleteMany({ shop: testShop, orderId: testOrderId });

  const orderPayload = {
    id: testOrderId,
    name: "#1062",
    email: "customer@example.com",
    customer: {
      first_name: "Bansi",
      last_name: "Patel",
      email: "customer@example.com",
    },
    financial_status: "partially_paid",
    currency: "USD",
    total_price: "30999.50",
    created_at: new Date().toISOString(),
    line_items: [
      {
        id: "line_1062_1",
        product_id: "7636734869591",
        title: "OnePlus 9 Pro 5G 128GB Morning Mist",
        variant_title: "128GB Morning Mist",
        quantity: 1,
        price: "61999.00",
        properties: [
          { name: "_preorder", value: "true" },
          { name: "_preorder_launch", value: "true" },
          { name: "_deposit_percentage", value: "50%" },
          { name: "_total_price_cents", value: "6199900" },
          { name: "_deposit_cents", value: "3099950" },
          { name: "_remaining_cents", value: "3099950" },
          { name: "Launch Date", value: "Sep 5, 2026" },
          { name: "Estimated Shipping", value: "Sep 5, 2026" },
        ],
      },
    ],
  };

  const res = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload });
  console.log("Order 1062 Result:", res);
  console.log("Calculated Pre-Order Total:", 61999);
  console.log("Calculated Deposit Paid (50%):", res.depositPaid);
  console.log("Calculated Remaining Balance:", res.remainingBalance);

  console.assert(res.depositPaid === 30999.50, `Expected depositPaid 30999.50, got ${res.depositPaid}`);
  console.assert(res.remainingBalance === 30999.50, `Expected remainingBalance 30999.50, got ${res.remainingBalance}`);
  console.log("\n✓ ORDER 1062 TEST PASSED PERFECTLY!");
  process.exit(0);
}

runFreshTest().catch((err) => {
  console.error("Fresh test failed:", err);
  process.exit(1);
});
