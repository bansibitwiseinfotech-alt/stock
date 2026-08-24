const express = require("express");
const router = express.Router();
const { getDashboardMetrics } = require("../controllers/dashboardController");
const { authenticateShop } = require("../middleware/auth");

router.get("/", authenticateShop, getDashboardMetrics);

module.exports = router;
