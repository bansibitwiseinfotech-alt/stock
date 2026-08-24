const express = require("express");
const router = express.Router();
const {
  getProductWidgetData,
  getStorefrontBundles,
  getProgressiveMarkdownStorefront,
  getStorefrontLaunchPreOrder,
  getStorefrontBadge,
} = require("../controllers/storefrontController");
const {
  getHighDemandStorefrontWidget,
  subscribeStockoutNotification,
} = require("../controllers/storefrontHighDemandController");
const {
  getHighDemandStorefrontStatus,
} = require("../controllers/highDemandStorefront.controller");

router.get("/product-widget", getProductWidgetData);
router.get("/bundles", getStorefrontBundles);
router.get("/progressive-markdown", getProgressiveMarkdownStorefront);
router.get("/badge", getStorefrontBadge);

// New Product Launch Pre-Order Storefront Endpoint
router.get("/pre-order", getStorefrontLaunchPreOrder);
router.get("/launch-pre-order", getStorefrontLaunchPreOrder);

// High Demand Stockout Shield Storefront Widget & Notifications
router.get("/stockout-shield", getHighDemandStorefrontWidget);
router.get("/high-demand", getHighDemandStorefrontWidget);
router.get("/high-demand-status", getHighDemandStorefrontStatus);
router.post("/stockout-notify", subscribeStockoutNotification);
router.post("/back-in-stock", subscribeStockoutNotification);
router.post("/notify", subscribeStockoutNotification);

module.exports = router;

