const express = require("express");
const router = express.Router();
const { getAutomations, toggleAutomation } = require("../controllers/automationsController");
const { authenticateShop } = require("../middleware/auth");

router.use(authenticateShop);
router.get("/", getAutomations);
router.post("/toggle", toggleAutomation);

module.exports = router;
