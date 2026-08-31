const express = require("express");

const {
  getDeadStock,
  getDeadStockSummary,
  getStoreProducts,
  syncDeadStockData,
  deleteProductByWebhook,
  getDeadStockByVariantId,
  createClearanceSale,
  deleteClearanceSale,
  addToClearanceCollection,
  createProgressiveMarkdown,
  stopProgressiveMarkdown,
  pauseProgressiveMarkdown,
  getProgressiveMarkdown,
  listProgressiveMarkdownRules,
  createBundle,
  deleteBundle,
  getCompanionProducts,
  getProductActions,
  saveCollectionSaleRecords,
  deleteCollectionSaleRecords,
} = require("../controllers/deadStockController");
const {
  checkPlanLimit,
  requirePremiumFeature,
} = require("../middleware/checkPlanLimit");

const router = express.Router();

// IMPORTANT: fixed routes first
router.get("/", getDeadStock);

router.get("/summary", getDeadStockSummary);

router.get("/store-products", getStoreProducts);

router.get("/markdown/rules", listProgressiveMarkdownRules);

router.post("/sync", syncDeadStockData);

router.post("/webhook/product-delete", deleteProductByWebhook);

// Collection bulk sale — save and delete ClearanceSale records for storefront widget
router.post(
  "/collection-sale-records",
  requirePremiumFeature("collectionBulkSale"),
  saveCollectionSaleRecords
);
router.post(
  "/collection-sale-records/delete",
  requirePremiumFeature("collectionBulkSale"),
  deleteCollectionSaleRecords
);

// Product-specific routes
router.get("/:variantId/actions", getProductActions);

router.get(
  "/:variantId/companion-products",
  getCompanionProducts
);

router.get("/:variantId/markdown", getProgressiveMarkdown);

router.get("/:variantId", getDeadStockByVariantId);

router.post(
  "/:variantId/clearance",
  checkPlanLimit("clearanceSale"),
  createClearanceSale
);

router.delete("/:variantId/clearance", deleteClearanceSale);

router.post(
  "/:variantId/collection",
  addToClearanceCollection
);

router.post(
  "/:variantId/markdown",
  checkPlanLimit("progressiveMarkdown"),
  createProgressiveMarkdown
);

router.delete(
  "/:variantId/markdown",
  stopProgressiveMarkdown
);

router.post(
  "/:variantId/markdown/stop",
  stopProgressiveMarkdown
);

router.post(
  "/:variantId/markdown/pause",
  pauseProgressiveMarkdown
);

router.post(
  "/:variantId/bundle",
  checkPlanLimit("deadStockBundle"),
  createBundle
);

router.delete(
  "/:variantId/bundle",
  deleteBundle
);

module.exports = router;