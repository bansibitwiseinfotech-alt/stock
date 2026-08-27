const express = require("express");
const { authenticateShop } = require("../middleware/auth");
const {
  scanProducts,
  getRecommendations,
  getSummary,
  applyBadge,
  disableBadge,
  bulkApply,
  applyAll,
  getProductAssignment,
} = require("../controllers/smartBadgeController");

const router = express.Router();

router.use(authenticateShop);

// Core endpoints
router.post("/scan", scanProducts);
router.get("/recommendations", getRecommendations);
router.get("/summary", getSummary);
router.post("/apply-all", applyAll);
router.post("/bulk-apply", bulkApply);

// Product actions
router.get("/:productId", getProductAssignment);
router.patch("/:productId/apply", applyBadge);
router.patch("/:productId/disable", disableBadge);
router.delete("/:productId/remove", disableBadge);

module.exports = router;