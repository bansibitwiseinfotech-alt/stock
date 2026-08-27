// ==================================================
// emailController.js
//
// Single controller for all email-related endpoints:
//
//   GET  /api/email/settings?shop=...       → getEmailSettings
//   PUT  /api/email/settings                → saveEmailSettings
//   PATCH /api/email/settings/toggle        → toggleWeeklyDigest
//   POST /api/email/test                    → sendTestEmail
//   GET  /api/email/run-now?shop=...        → runDigestNow (manual trigger)
// ==================================================

const mongoose = require("mongoose");
const EmailSettings = require("../models/EmailSettings");
const EmailLog = require("../models/EmailLog");
const { generateWeeklyDigest, buildDigestHTML } = require("../services/emailDigestService");
const { sendEmail } = require("../services/smtpService");
const { triggerDigestForShop } = require("../jobs/weeklyEmailScheduler");

// ==================================================
// VALID DAYS
// ==================================================

const VALID_DAYS = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

// ==================================================
// GET EMAIL SETTINGS
// GET /api/email/settings?shop=xxx.myshopify.com
// ==================================================

const getEmailSettings = async (req, res) => {
  try {
    const shop = String(req.query.shop || "").trim().toLowerCase();

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    console.log("📥 [Email Settings] GET →", shop);
    console.log("[Email Settings] DB:", mongoose.connection.name, "| Collection: tbl_emailsettings");

    const settings = await EmailSettings.findOne({ shop }).lean();

    // Return null (not 404) for first-time merchants — frontend handles this case
    return res.status(200).json({
      success: true,
      settings: settings || null,
    });
  } catch (err) {
    console.error("[Email Settings] GET error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================================
// SAVE EMAIL SETTINGS
// PUT /api/email/settings
// ==================================================

const saveEmailSettings = async (req, res) => {
  try {
    console.log("📥 [Email Settings] PUT body:", JSON.stringify(req.body, null, 2));

    const {
      shop: rawShop,
      email: rawEmail,
      weeklyDigestEnabled,
      weeklyDigestDay,
      weeklyDigestTime,
      timezone,
    } = req.body;

    // ── Normalize ─────────────────────────────────────────────────────────────

    const shop  = String(rawShop  || "").trim().toLowerCase();
    const email = String(rawEmail || "").trim().toLowerCase();

    // ── Validate shop ──────────────────────────────────────────────────────────

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    // ── Validate email ─────────────────────────────────────────────────────────

    if (!email) {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOK) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    // ── Validate enabled ───────────────────────────────────────────────────────

    let enabled = true;
    if (weeklyDigestEnabled !== undefined) {
      if (typeof weeklyDigestEnabled === "boolean") {
        enabled = weeklyDigestEnabled;
      } else if (weeklyDigestEnabled === "true")  {
        enabled = true;
      } else if (weeklyDigestEnabled === "false") {
        enabled = false;
      } else {
        return res.status(400).json({ success: false, message: "weeklyDigestEnabled must be true or false" });
      }
    }

    // ── Validate day ───────────────────────────────────────────────────────────

    const day = String(weeklyDigestDay || "monday").trim().toLowerCase();
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({
        success: false,
        message: `weeklyDigestDay must be one of: ${VALID_DAYS.join(", ")}`,
      });
    }

    // ── Validate time (HH:mm) ─────────────────────────────────────────────────

    const time = String(weeklyDigestTime || "09:00").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: "weeklyDigestTime must be HH:mm format (e.g. 09:00, 18:30)",
      });
    }

    // ── Validate timezone ─────────────────────────────────────────────────────

    const tz = String(timezone || "Asia/Kolkata").trim();
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      return res.status(400).json({ success: false, message: `Invalid timezone: ${tz}` });
    }

    // ── Upsert ────────────────────────────────────────────────────────────────

    const updateData = {
      shop, email,
      weeklyDigestEnabled: enabled,
      weeklyDigestDay: day,
      weeklyDigestTime: time,
      timezone: tz,
    };

    console.log("[Email Settings] Saving:", updateData);
    console.log("[Email Settings] DB    :", mongoose.connection.name, "| Host:", mongoose.connection.host);

    await EmailSettings.findOneAndUpdate(
      { shop },
      { $set: updateData },
      { returnDocument: "after", upsert: true, runValidators: true }
    );

    // ── Post-save verification ────────────────────────────────────────────────

    const verified = await EmailSettings.findOne({ shop }).lean();

    if (!verified) {
      console.error("[Email Settings] ❌ CRITICAL: Document not found after save!");
      return res.status(500).json({
        success: false,
        message: "Settings saved but could not be verified. Check MongoDB connection.",
      });
    }

    console.log("────────────────────────────────────────");
    console.log("[Email Settings] ✅ MongoDB save verified");
    console.log("[Email Settings] Shop      :", verified.shop);
    console.log("[Email Settings] _id       :", verified._id);
    console.log("[Email Settings] Database  :", mongoose.connection.name);
    console.log("[Email Settings] Collection: tbl_emailsettings");
    console.log("[Email Settings] Host      :", mongoose.connection.host);
    console.log("────────────────────────────────────────");

    return res.status(200).json({ success: true, settings: verified });
  } catch (err) {
    console.error("[Email Settings] PUT error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================================
// TOGGLE WEEKLY DIGEST
// PATCH /api/email/settings/toggle
// Body: { shop, weeklyDigestEnabled }
// ==================================================

const toggleWeeklyDigest = async (req, res) => {
  try {
    const shop = String(req.body.shop || "").trim().toLowerCase();
    const { weeklyDigestEnabled } = req.body;

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    let enabled;
    if (typeof weeklyDigestEnabled === "boolean") {
      enabled = weeklyDigestEnabled;
    } else if (weeklyDigestEnabled === "true")  { enabled = true;  }
    else if (weeklyDigestEnabled === "false") { enabled = false; }
    else {
      return res.status(400).json({ success: false, message: "weeklyDigestEnabled must be true or false" });
    }

    console.log(`📧 [Email Settings] Toggle ${shop} → ${enabled}`);

    const settings = await EmailSettings.findOneAndUpdate(
      { shop },
      { $set: { weeklyDigestEnabled: enabled } },
      { returnDocument: "after" }
    ).lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Email settings not found. Save your settings first.",
      });
    }

    console.log(`[Email Settings] ✅ Toggle complete: ${shop} → enabled=${enabled}`);

    return res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error("[Email Settings] PATCH toggle error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================================
// SEND TEST EMAIL
// POST /api/email/test
// Body or query: { shop }
// ==================================================

const sendTestEmail = async (req, res) => {
  try {
    const shop = String(req.body?.shop || req.query?.shop || "").trim().toLowerCase();

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required. Pass in body or query: ?shop=your-store.myshopify.com",
      });
    }

    console.log(`📧 [Test Email] Starting for: ${shop}`);

    // ── Load EmailSettings ────────────────────────────────────────────────────

    const settings = await EmailSettings.findOne({ shop }).lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: `No email settings found for ${shop}. Save your email settings first.`,
      });
    }

    if (!settings.email) {
      return res.status(400).json({
        success: false,
        message: "No email address saved in settings.",
      });
    }

    // ── Generate real digest ──────────────────────────────────────────────────

    let digest;
    try {
      digest = await generateWeeklyDigest(shop);
    } catch (err) {
      digest = {
        shop,
        totalProducts: 0, cashAtRisk: 0,
        deadStockCount: 0, deadStockItems: [],
        highDemandCount: 0, stockoutRiskCount: 0, stockoutItems: [],
      };
    }

    const html    = buildDigestHTML(digest, shop);
    const subject = `📦 [TEST] Smart Stock Weekly Inventory Digest — ${shop}`;

    // ── Send via SMTP ─────────────────────────────────────────────────────────

    const result = await sendEmail({ to: settings.email, subject, html });

    // ── Log ───────────────────────────────────────────────────────────────────

    try {
      await EmailLog.create({
        shop,
        email: settings.email,
        type: "TEST_EMAIL",
        status: result.success ? "SENT" : "FAILED",
        messageId: result.messageId || null,
        error: result.error || null,
        sentAt: result.success ? new Date() : null,
        metadata: { test: true },
      });
    } catch (logErr) {
      console.error("[Test Email] EmailLog write failed:", logErr.message);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || "SMTP send failed. Check SMTP configuration.",
      });
    }

    console.log(`[Test Email] ✅ Sent to ${settings.email}`);

    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${settings.email}`,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("[Test Email] Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================================
// MANUAL DIGEST TRIGGER
// GET /api/email/run-now?shop=...&force=true
// ==================================================

const runDigestNow = async (req, res) => {
  try {
    const shop  = String(req.query.shop || "").trim().toLowerCase();
    const force = req.query.force === "true";

    if (!shop) {
      return res.status(400).json({ success: false, message: "shop is required" });
    }

    const settings = await EmailSettings.findOne({ shop }).lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: `No email settings found for ${shop}.`,
      });
    }

    console.log(`[Manual Trigger] Shop=${shop}, Force=${force}`);

    const result = await triggerDigestForShop({
      shop,
      email: settings.email,
      force,
    });

    return res.status(200).json({
      success: result.success,
      message: result.success ? "Digest sent" : result.error,
      result,
    });
  } catch (err) {
    console.error("[Manual Trigger] Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================================
// EXPORT
// ==================================================

module.exports = {
  getEmailSettings,
  saveEmailSettings,
  toggleWeeklyDigest,
  sendTestEmail,
  runDigestNow,
};
