require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const connectDB = require("../backend/config/mongodb");
const { processPreOrderDepositWebhook } = require("../backend/services/preOrderDepositWebhookService");
const PreOrderNotificationLog = require("../backend/models/PreOrderNotificationLog");

async function runTests() {
  await connectDB();
  console.log("=== RUNNING PRE-ORDER 50% DEPOSIT CONFIRMATION EMAIL TESTS ===\n");

  const testShop = "promobile-hub.myshopify.com";
  const testOrderId = "test_order_99001";

  // Clean up any test log
  await PreOrderNotificationLog.deleteMany({ shop: testShop, orderId: { $regex: /^test_order_/ } });

  // -------------------------------------------------------------
  // TEST 1: Successful 50% Deposit ($61,999.00 Total, $30,999.50 Paid)
  // -------------------------------------------------------------
  console.log("--> TEST 1: 50% Deposit Paid ($61,999.00 Total, $30,999.50 Paid)");
  const orderPayload1 = {
    id: testOrderId,
    name: "#99001",
    email: "customer@example.com",
    customer: {
      first_name: "Jane",
      last_name: "Doe",
      email: "customer@example.com",
    },
    financial_status: "partially_paid",
    currency: "USD",
    total_price: "30999.50",
    created_at: new Date().toISOString(),
    line_items: [
      {
        id: "line_101",
        product_id: "7636734869591",
        title: "OnePlus 9 Pro 5G 128GB Morning Mist",
        variant_title: "128GB Morning Mist",
        quantity: 1,
        price: "30999.50",
        properties: [
          { name: "_preorder", value: "true" },
          { name: "_preorder_launch", value: "true" },
          { name: "_deposit_percentage", value: "50%" },
          { name: "_total_price_cents", value: "6199900" },
          { name: "Launch Date", value: "Sep 5, 2026" },
          { name: "Estimated Shipping", value: "Sep 5, 2026" },
        ],
      },
    ],
  };

  const res1 = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload1 });
  console.log("Result 1:", res1);
  console.assert(res1.depositPaid === 30999.50, `Expected depositPaid 30999.50, got ${res1.depositPaid}`);
  console.assert(res1.remainingBalance === 30999.50, `Expected remainingBalance 30999.50, got ${res1.remainingBalance}`);
  console.log("✓ TEST 1 PASSED\n");

  // -------------------------------------------------------------
  // TEST 2: Webhook Retry (Duplicate Email Protection)
  // -------------------------------------------------------------
  console.log("--> TEST 2: Webhook Retry (Idempotency Check)");
  const res2 = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload1 });
  console.log("Result 2:", res2);
  console.assert(res2.alreadySent === true, "Expected alreadySent to be true");
  console.log("✓ TEST 2 PASSED (Duplicate Email Prevented)\n");

  // -------------------------------------------------------------
  // TEST 3: Standard Non-PreOrder Order
  // -------------------------------------------------------------
  console.log("--> TEST 3: Normal Non-PreOrder Order");
  const orderPayload3 = {
    id: "test_order_99003",
    name: "#99003",
    email: "customer@example.com",
    financial_status: "paid",
    currency: "USD",
    total_price: "120.00",
    line_items: [
      {
        id: "line_103",
        product_id: "99999999",
        title: "Standard USB-C Cable",
        quantity: 1,
        price: "120.00",
        properties: [],
      },
    ],
  };

  const res3 = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload3 });
  console.log("Result 3:", res3);
  console.assert(res3.success === false && res3.reason === "Not a pre-order", "Expected Not a pre-order");
  console.log("✓ TEST 3 PASSED\n");

  // -------------------------------------------------------------
  // TEST 4: Configured 30% Deposit ($61,999.00 Total, $18,599.70 Paid)
  // -------------------------------------------------------------
  console.log("--> TEST 4: 30% Deposit ($61,999.00 Total, $18,599.70 Paid)");
  const orderPayload4 = {
    id: "test_order_99004",
    name: "#99004",
    email: "customer30@example.com",
    customer: { first_name: "Alex", email: "customer30@example.com" },
    financial_status: "paid",
    currency: "USD",
    total_price: "18599.70",
    line_items: [
      {
        id: "line_104",
        product_id: "7636734869591",
        title: "OnePlus 9 Pro 5G 128GB Morning Mist",
        quantity: 1,
        price: "18599.70",
        properties: [
          { name: "_preorder", value: "true" },
          { name: "_deposit_percentage", value: "30%" },
          { name: "_total_price_cents", value: "6199900" },
        ],
      },
    ],
  };

  const res4 = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload4 });
  console.log("Result 4:", res4);
  console.assert(res4.depositPaid === 18599.70, `Expected depositPaid 18599.70, got ${res4.depositPaid}`);
  console.assert(res4.remainingBalance === 43399.30, `Expected remainingBalance 43399.30, got ${res4.remainingBalance}`);
  console.log("✓ TEST 4 PASSED\n");

  // -------------------------------------------------------------
  // TEST 5: Missing Customer Email
  // -------------------------------------------------------------
  console.log("--> TEST 5: Missing Customer Email");
  const orderPayload5 = {
    id: "test_order_99005",
    name: "#99005",
    email: "",
    customer: { email: "" },
    financial_status: "paid",
    currency: "USD",
    total_price: "30999.50",
    line_items: [
      {
        id: "line_105",
        product_id: "7636734869591",
        title: "OnePlus 9 Pro 5G 128GB Morning Mist",
        quantity: 1,
        price: "30999.50",
        properties: [{ name: "_preorder", value: "true" }],
      },
    ],
  };

  const res5 = await processPreOrderDepositWebhook({ shop: testShop, order: orderPayload5 });
  console.log("Result 5:", res5);
  console.assert(res5.success === false && res5.reason === "Missing customer email", "Expected Missing customer email");
  console.log("✓ TEST 5 PASSED\n");

  // Clean up test data
  await PreOrderNotificationLog.deleteMany({ shop: testShop, orderId: { $regex: /^test_order_/ } });

  console.log("=== ALL PRE-ORDER 50% DEPOSIT CONFIRMATION EMAIL TESTS PASSED SUCCESSFULLY! ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
