const express = require("express");
const router = express.Router();
const preOrderController = require("../controllers/preOrder.controller");
const {
  checkPlanLimit,
} = require("../middleware/checkPlanLimit");

// ==================================================
// LAUNCH PRE-ORDER CONFIGURATION ROUTES
// ==================================================

// GET /api/pre-orders/launch-config - List all launch configs for store
router.get("/launch-config", preOrderController.getLaunchConfigs);

// GET /api/pre-orders/launch-config/:productId - Get config for single product
router.get("/launch-config/:productId", preOrderController.getLaunchConfigByProduct);

// POST /api/pre-orders/launch-config - Save / update launch config
router.post(
  "/launch-config",
  checkPlanLimit("launchPreOrder"),
  preOrderController.saveLaunchConfig
);

// POST /api/pre-orders/launch-config/:productId/toggle - Toggle enabled
router.post(
  "/launch-config/:productId/toggle",
  checkPlanLimit("launchPreOrder"),
  preOrderController.toggleLaunchConfig
);

// DELETE /api/pre-orders/launch-config/:productId - Delete launch config
router.delete("/launch-config/:productId", preOrderController.deleteLaunchConfig);

// GET /api/pre-orders/products - Fetch real store products for selector
router.get("/products", preOrderController.getStoreProductsForLaunch);

// ==================================================
// CUSTOMER PRE-ORDER FULFILLMENT & ORDERS ROUTES
// ==================================================

// GET /api/pre-orders - List and metrics
router.get("/", preOrderController.getPreOrders);

// POST /api/pre-orders/sync - Sync real orders from Shopify Admin API
router.post("/sync", preOrderController.syncPreOrdersController);

// POST /api/pre-orders/webhook/order-create - Webhook handler for instant pre-order email
router.post("/webhook/order-create", preOrderController.handleOrderWebhook);

// PATCH /api/pre-orders/:id/status - Update status
router.patch("/:id/status", preOrderController.updatePreOrderStatus);

// DELETE /api/pre-orders/:id - Delete pre-order
router.delete("/:id", preOrderController.deletePreOrder);

module.exports = router;

