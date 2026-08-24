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

router.use(authenticateShop);

router.get("/clearance-sale", getClearanceSaleConfig);
router.post("/clearance-sale", updateClearanceSaleConfig);
router.post("/clearance-sale/reset", resetClearanceSaleConfig);

router.get("/bundle", getBundleConfig);
router.post("/bundle", updateBundleConfig);
router.post("/bundle/reset", resetBundleConfig);

router.get("/markdown", getMarkdownConfig);
router.post("/markdown", updateMarkdownConfig);
router.post("/markdown/reset", resetMarkdownConfig);

router.get("/low-stock", getLowStockConfig);
router.post("/low-stock", updateLowStockConfig);
router.post("/low-stock/reset", resetLowStockConfig);

router.get("/pre-order", getPreOrderCustomizationConfig);
router.post("/pre-order", updatePreOrderCustomizationConfig);
router.post("/pre-order/reset", resetPreOrderCustomizationConfig);

module.exports = router;

