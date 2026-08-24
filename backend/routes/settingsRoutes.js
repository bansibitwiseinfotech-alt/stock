const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { authenticateShop } = require("../middleware/auth");

router.use(authenticateShop);
router.get("/", getSettings);
router.post("/", updateSettings);

module.exports = router;
