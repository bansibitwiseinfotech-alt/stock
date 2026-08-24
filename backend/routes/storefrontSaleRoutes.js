const express = require("express");

const {
  getSaleSettings,
  saveSaleSettings,
  updateSaleSettings,
  deleteSaleSettings,
} = require("../controllers/storefrontSaleController");
const { authenticateShop } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateShop);

// GET
router.get("/sale-settings", getSaleSettings);

// POST
router.post("/sale-settings", saveSaleSettings);

// PUT
router.put("/sale-settings", updateSaleSettings);

// DELETE
router.delete("/sale-settings", deleteSaleSettings);

module.exports = router; 