// ==================================================
// emailRoutes.js
//
// Single email router — registered ONCE in server.js:
//   app.use("/api/email", emailRoutes)
//
// Routes:
//   GET    /api/email/settings          → getEmailSettings
//   PUT    /api/email/settings          → saveEmailSettings
//   PATCH  /api/email/settings/toggle   → toggleWeeklyDigest
//   POST   /api/email/test              → sendTestEmail
//   GET    /api/email/run-now           → runDigestNow
// ==================================================

const express = require("express");

const {
  getEmailSettings,
  saveEmailSettings,
  toggleWeeklyDigest,
  sendTestEmail,
  runDigestNow,
} = require("../controllers/emailController");
const {
  requirePremiumFeature,
} = require("../middleware/checkPlanLimit");

const router = express.Router();

// GET /api/email/settings?shop=...
router.get("/settings", getEmailSettings);

// PUT /api/email/settings
router.put("/settings", requirePremiumFeature("emailSchedule"), saveEmailSettings);

// PATCH /api/email/settings/toggle — lightweight toggle only
router.patch("/settings/toggle", requirePremiumFeature("emailSchedule"), toggleWeeklyDigest);

// POST /api/email/test
router.post("/test", requirePremiumFeature("emailSchedule"), sendTestEmail);

// GET /api/email/run-now?shop=...&force=true — manual trigger
router.get("/run-now", requirePremiumFeature("emailSchedule"), runDigestNow);

module.exports = router;
