const express = require("express");
const router = express.Router();
const deadStockController = require("../controllers/deadStockController");
const { authenticateShop } = require("../middleware/auth");

// Public webhook — no auth required (Shopify signs the payload)
router.post("/webhook/product-delete", deadStockController.deleteProductByWebhook);

// All routes below require shop authentication
router.use(authenticateShop);

// Summary (MongoDB dead-stock aggregate)
router.get("/summary", deadStockController.getDeadStockSummary);

// Manual sync trigger
router.post("/sync", deadStockController.syncDeadStockData);

// Bulk Clearance Sale
router.post("/bulk-sale", deadStockController.createBulkSale);

// Collection bulk sale — save ClearanceSale records for storefront widget
router.post("/collection-sale-records", deadStockController.saveCollectionSaleRecords);

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY: Shopify GraphQL cursor-paginated product listing
// GET /api/dead-stock/store-products?shop=&limit=50&cursor=&search=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/store-products", deadStockController.getStoreProducts);

// Action endpoints
router.get("/markdown/rules", deadStockController.listProgressiveMarkdownRules);                 
router.post("/:variantId/clearance", deadStockController.createClearanceSale);
router.delete("/:variantId/clearance", deadStockController.deleteClearanceSale);
router.post("/:variantId/collection", deadStockController.addToClearanceCollection);
router.get("/:variantId/markdown", deadStockController.getProgressiveMarkdown);
router.post("/:variantId/markdown", deadStockController.createProgressiveMarkdown);
router.delete("/:variantId/markdown", deadStockController.stopProgressiveMarkdown);
router.post("/:variantId/markdown/stop", deadStockController.stopProgressiveMarkdown);
router.post("/:variantId/markdown/pause", deadStockController.pauseProgressiveMarkdown);
router.post("/:variantId/bundle", deadStockController.createBundle);
router.delete("/:variantId/bundle", deadStockController.deleteBundle);
router.get("/:variantId/companion-products", deadStockController.getCompanionProducts);
router.get("/:variantId/actions", deadStockController.getProductActions);

// Single product / variant detail
router.get("/variant/:variantId", deadStockController.getDeadStockByVariantId);
router.get("/:variantId", deadStockController.getDeadStockByVariantId);

// MongoDB dead stock list (used in Dead Stock mode, not Shopify products mode)
router.get("/", deadStockController.getDeadStock);

module.exports = router;