const express = require("express");
const router = express.Router();
const { getReportMetrics } = require("../controllers/reportsController");
const { authenticateShop } = require("../middleware/auth");

router.get("/", authenticateShop, getReportMetrics);

module.exports = router;
