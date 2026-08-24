const express = require("express");
const router = express.Router();
const {
  sendWeeklyDigest,
  getWeeklyDigestStatus,
} = require("../controllers/mondayBadgeDigest.controller");

// POST /api/smart-badges/send-weekly-digest - Manual or scheduled trigger to send digest
router.post("/send-weekly-digest", sendWeeklyDigest);

// GET /api/smart-badges/weekly-digest-status - Check status of current & last sent digest
router.get("/weekly-digest-status", getWeeklyDigestStatus);

module.exports = router;
