const express = require("express");
const router = express.Router();
const deadStockBundleController = require("../controllers/deadStockBundleController");

// POST /api/dead-stock/bundles/create
router.post("/create", deadStockBundleController.createBundle);

// POST /api/dead-stock/bundles (alternative creation path)
router.post("/", deadStockBundleController.createBundle);

// GET /api/dead-stock/bundles?shop=...
router.get("/", deadStockBundleController.getBundles);

// GET /api/dead-stock/bundles/:id
router.get("/:id", deadStockBundleController.getBundle);

// PUT /api/dead-stock/bundles/:id
router.put("/:id", deadStockBundleController.updateBundle);

// DELETE /api/dead-stock/bundles/:id
router.delete("/:id", deadStockBundleController.deleteBundle);

module.exports = router;
