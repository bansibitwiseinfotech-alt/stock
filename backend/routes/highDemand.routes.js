const express = require("express");

const router = express.Router();

const highDemandController = require(
  "../controllers/highDemand.controller"
);

const highDemandReorderController = require(
  "../controllers/highDemandReorder.controller"
);

// ==================================================
// HIGH DEMAND ANALYSIS
// ==================================================

router.get(
  "/",
  highDemandController.analyzeHighDemand
);

// ==================================================
// VARIANT / PRODUCT DETAIL
// ==================================================

router.get(
  "/variant/:variantId",
  highDemandController.getHighDemandVariantDetail
);

router.get(
  "/product/:variantId",
  highDemandController.getHighDemandVariantDetail
);

// ==================================================
// REORDER REQUESTS
// ==================================================

router.post(
  "/reorder",
  highDemandReorderController.createReorder
);

router.post(
  "/reorder/:variantId",
  highDemandReorderController.createReorder
);

router.get(
  "/reorders",
  highDemandReorderController.getReorders
);

router.get(
  "/reorder/:id",
  highDemandReorderController.getReorderById
);

router.patch(
  "/reorder/:id/confirm",
  highDemandReorderController.confirmReorder
);

router.patch(
  "/reorder/:id/cancel",
  highDemandReorderController.cancelReorder
);

// ==================================================
// STOREFRONT CONFIG, BADGE & PRE-ORDER TOGGLES
// ==================================================

router.get(
  "/storefront/:variantId",
  highDemandController.getStorefrontConfig
);

router.patch(
  "/storefront/:variantId",
  highDemandController.updateStorefrontConfig
);

router.post(
  "/storefront/:variantId",
  highDemandController.updateStorefrontConfig
);

router.post(
  "/monitor/:variantId",
  highDemandController.toggleMonitor
);

router.post(
  "/toggle-badge",
  highDemandController.toggleUrgencyBadge
);

router.post(
  "/toggle-preorder",
  highDemandController.togglePreOrder
);

router.post(
  "/preorder/:variantId",
  highDemandController.togglePreOrder
);

router.post(
  "/toggle-notify-me",
  highDemandController.toggleNotifyMe
);

router.post(
  "/notify-me/:variantId",
  highDemandController.toggleNotifyMe
);

module.exports = router;