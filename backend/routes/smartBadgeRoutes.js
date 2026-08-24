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
const {
  sendWeeklyDigest,
  getWeeklyDigestStatus,
} = require("../controllers/mondayBadgeDigest.controller");

const router = express.Router();

router.use(authenticateShop);

// Core endpoints
router.post("/scan", scanProducts);
router.get("/recommendations", getRecommendations);
router.get("/summary", getSummary);
router.post("/apply-all", applyAll);
router.post("/bulk-apply", bulkApply);

// Monday Morning Smart Badge Digest endpoints
router.post("/send-weekly-digest", sendWeeklyDigest);
router.get("/weekly-digest-status", getWeeklyDigestStatus);

// Product actions
router.get("/:productId", getProductAssignment);
router.patch("/:productId/apply", applyBadge);
router.patch("/:productId/disable", disableBadge);
router.delete("/:productId/remove", disableBadge);

module.exports = router;