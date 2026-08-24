const express = require("express");
const { authenticateShop } = require("../middleware/auth");
const {
  getSettings,
  updateSettings,
  validateSettings,
} = require("../controllers/badgeSettingsController");

const router = express.Router();

router.use(authenticateShop);

router.get("/", getSettings);
router.post("/", updateSettings);
router.patch("/", updateSettings);
router.get("/validate", validateSettings);

module.exports = router;
