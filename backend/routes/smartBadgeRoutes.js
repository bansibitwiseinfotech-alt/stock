const express = require("express");
const { authenticateShop } = require("../middleware/auth");
const {
  requirePremiumFeature,
} = require("../middleware/checkPlanLimit");
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
// Actions strictly guarded by Premium plan
router.post("/scan", requirePremiumFeature("smartBadges"), scanProducts);
router.get("/recommendations", getRecommendations);
router.get("/summary", getSummary);
router.post("/apply-all", requirePremiumFeature("smartBadges"), applyAll);
router.post("/bulk-apply", requirePremiumFeature("smartBadges"), bulkApply);

// Product actions
router.get("/:productId", getProductAssignment);
router.patch("/:productId/apply", requirePremiumFeature("smartBadges"), applyBadge);
router.patch("/:productId/disable", disableBadge);
router.delete("/:productId/remove", disableBadge);

module.exports = router;