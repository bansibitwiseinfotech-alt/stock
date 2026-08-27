const express = require("express");

const {
    getSubscription,
    upgradeSubscription,
    confirmSubscription,
    verifySubscription,
    switchFree,
} = require("../controllers/subscriptionController");

const router = express.Router();

// =====================================================
// SUBSCRIPTION & SHOPIFY BILLING ENDPOINTS
// =====================================================

// GET /api/subscription?shop=store.myshopify.com
router.get("/", getSubscription);

// POST /api/subscription/upgrade
router.post("/upgrade", upgradeSubscription);

// GET /api/subscription/confirm (Shopify redirect callback)
router.get("/confirm", confirmSubscription);

// POST /api/subscription/verify (in-app fallback verification)
router.post("/verify", verifySubscription);

// POST /api/subscription/switch-free (cancel paid Shopify sub and revert to free)
router.post("/switch-free", switchFree);

module.exports = router;