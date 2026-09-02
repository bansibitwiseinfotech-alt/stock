const express = require("express");
const router = express.Router();
const {
  getClearanceSaleConfig,
  updateClearanceSaleConfig,
  resetClearanceSaleConfig,
  getBundleConfig,
  updateBundleConfig,
  resetBundleConfig,
  getMarkdownConfig,
  updateMarkdownConfig,
  resetMarkdownConfig,
  getLowStockConfig,
  updateLowStockConfig,
  resetLowStockConfig,
  getPreOrderCustomizationConfig,
  updatePreOrderCustomizationConfig,
  resetPreOrderCustomizationConfig,
} = require("../controllers/customizationController");
const { authenticateShop } = require("../middleware/auth");
const {
  checkCustomizationPermission,
} = require("../middleware/checkPlanLimit");

router.use(authenticateShop);

router.get("/clearance-sale", getClearanceSaleConfig);
router.post("/clearance-sale", checkCustomizationPermission("clearanceSale"), updateClearanceSaleConfig);
router.post("/clearance-sale/reset", checkCustomizationPermission("clearanceSale"), resetClearanceSaleConfig);

router.get("/bundle", getBundleConfig);
router.post("/bundle", checkCustomizationPermission("deadStockBundle"), updateBundleConfig);
router.post("/bundle/reset", checkCustomizationPermission("deadStockBundle"), resetBundleConfig);

router.get("/markdown", getMarkdownConfig);
router.post("/markdown", checkCustomizationPermission("progressiveMarkdown"), updateMarkdownConfig);
router.post("/markdown/reset", checkCustomizationPermission("progressiveMarkdown"), resetMarkdownConfig);

router.get("/low-stock", getLowStockConfig);
router.post("/low-stock", checkCustomizationPermission("lowStockBadge"), updateLowStockConfig);
router.post("/low-stock/reset", checkCustomizationPermission("lowStockBadge"), resetLowStockConfig);

router.get("/pre-order", getPreOrderCustomizationConfig);
router.post("/pre-order", checkCustomizationPermission("launchPreOrder"), updatePreOrderCustomizationConfig);
router.post("/pre-order/reset", checkCustomizationPermission("launchPreOrder"), resetPreOrderCustomizationConfig);

module.exports = router;

