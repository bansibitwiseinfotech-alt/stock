const express = require("express");
const router = express.Router();

const {
  getHighDemandStorefrontStatus,
} = require("../controllers/highDemandStorefront.controller");

const {
  toggleUrgencyBadge,
  togglePreOrder,
} = require("../controllers/highDemand.controller");

// Storefront Status Check
router.get("/high-demand", getHighDemandStorefrontStatus);
router.get("/high-demand-status", getHighDemandStorefrontStatus);

// Toggle Endpoints
router.post("/toggle-badge", toggleUrgencyBadge);
router.post("/toggle-preorder", togglePreOrder);

module.exports = router;
