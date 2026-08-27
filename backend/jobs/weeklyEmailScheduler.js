// ==================================================
// weeklyEmailScheduler.js
//
// Runs every minute using node-cron.
// For each merchant with weeklyDigestEnabled=true:
//   1. Get the merchant's current local date/time (via luxon)
//   2. Check if current day + time matches their schedule
//   3. Build a schedule key: "shop-YYYY-MM-DD-HH:mm"
//   4. If lastDigestScheduleKey === current key → skip (already sent)
//   5. Otherwise → generate digest → send email → update key
//
// IMPORTANT:
//   - Never compares UTC server time directly with merchant time
//   - Never starts before MongoDB is ready
//   - Never starts twice (cronStarted guard)
//   - Errors per merchant do NOT crash the scheduler
// ==================================================

const cron = require("node-cron");
const { DateTime } = require("luxon");

const EmailSettings = require("../models/EmailSettings");
const EmailLog = require("../models/EmailLog");
const { generateWeeklyDigest, buildDigestHTML } = require("../services/emailDigestService");
const { sendEmail } = require("../services/smtpService");

let cronStarted = false;

// ==================================================
// START SCHEDULER
// ==================================================

function startWeeklyEmailScheduler() {
  if (cronStarted) {
    console.warn("[Weekly Email Scheduler] Already started — skipping duplicate.");
    return;
  }

  cronStarted = true;

  cron.schedule("* * * * *", async () => {
    try {
      await runSchedulerCheck();
    } catch (err) {
      console.error("[Weekly Email Scheduler] Unhandled scheduler error:", err.message);
    }
  });

  console.log("[Weekly Email Scheduler] ✅ Started — checking every minute");
}

// ==================================================
// RUN SCHEDULER CHECK (every minute)
// ==================================================

async function runSchedulerCheck() {
  console.log("[Weekly Email Scheduler] Running check...");

  const settingsList = await EmailSettings.find({
    weeklyDigestEnabled: true,
    email: { $exists: true, $ne: "" },
  }).lean();

  if (!settingsList.length) {
    return;
  }

  for (const settings of settingsList) {
    try {
      await processMerchant(settings);
    } catch (err) {
      console.error(
        `[Weekly Email Scheduler] Error processing ${settings.shop}:`,
        err.message
      );
    }
  }
}

// ==================================================
// PROCESS ONE MERCHANT
// ==================================================

async function processMerchant(settings) {
  const { shop, email, weeklyDigestDay, weeklyDigestTime, timezone } = settings;

  if (!shop || !email || !weeklyDigestDay || !weeklyDigestTime || !timezone) {
    return;
  }

  // ── Get merchant's current local date/time ─────────────────────────────────

  let localNow;
  try {
    localNow = DateTime.now().setZone(timezone);
    if (!localNow.isValid) {
      console.warn(`[Weekly Email Scheduler] Invalid timezone "${timezone}" for ${shop}`);
      return;
    }
  } catch (err) {
    console.warn(`[Weekly Email Scheduler] Timezone error for ${shop}:`, err.message);
    return;
  }

  // ── Day name (lowercase, full word) ───────────────────────────────────────

  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  // luxon weekday: 1=Monday, 7=Sunday
  const currentDay = DAYS[localNow.weekday - 1];

  // ── HH:mm ─────────────────────────────────────────────────────────────────

  const currentHHmm = localNow.toFormat("HH:mm");

  // ── Compare day + time ────────────────────────────────────────────────────

  const configDay  = String(weeklyDigestDay).trim().toLowerCase();
  const configTime = String(weeklyDigestTime).trim();

  if (currentDay !== configDay || currentHHmm !== configTime) {
    return;
  }

  // ── Build schedule key ────────────────────────────────────────────────────
  // Format: "shop-YYYY-MM-DD-HH:mm"

  const localDateStr = localNow.toFormat("yyyy-MM-dd");
  const scheduleKey  = `${shop}-${localDateStr}-${configTime}`;

  // ── Duplicate check ───────────────────────────────────────────────────────

  if (settings.lastDigestScheduleKey === scheduleKey) {
    console.log("[Weekly Email Scheduler] Already sent for this schedule:", scheduleKey);
    return;
  }

  // ── Schedule matched! ─────────────────────────────────────────────────────

  console.log("[Weekly Email Scheduler] Schedule matched");
  console.log("[Weekly Email Scheduler]   Shop     :", shop);
  console.log("[Weekly Email Scheduler]   Email    :", email);
  console.log("[Weekly Email Scheduler]   Timezone :", timezone);
  console.log("[Weekly Email Scheduler]   Local time:", localNow.toFormat("yyyy-MM-dd HH:mm:ss ZZZZ"));

  // ── Generate + Send ───────────────────────────────────────────────────────

  console.log("[Weekly Email Scheduler] Sending digest...");
  await sendWeeklyDigest({ shop, email, scheduleKey });
}

// ==================================================
// SEND WEEKLY DIGEST
// ==================================================

async function sendWeeklyDigest({ shop, email, scheduleKey }) {
  let digest;
  try {
    digest = await generateWeeklyDigest(shop);
  } catch (err) {
    console.error(`[Weekly Email Scheduler] Digest generation failed for ${shop}:`, err.message);
    digest = {
      shop,
      totalProducts: 0,
      cashAtRisk: 0,
      deadStockCount: 0,
      deadStockItems: [],
      highDemandCount: 0,
      stockoutRiskCount: 0,
      stockoutItems: [],
    };
  }

  const html = buildDigestHTML(digest, shop);
  const subject = `📦 Smart Stock Weekly Inventory Digest — ${shop}`;

  const result = await sendEmail({ to: email, subject, html });

  // ── Create EmailLog ───────────────────────────────────────────────────────

  try {
    await EmailLog.create({
      shop,
      email,
      type: "WEEKLY_DIGEST",
      status: result.success ? "SENT" : "FAILED",
      messageId: result.messageId || null,
      error: result.error || null,
      sentAt: result.success ? new Date() : null,
      metadata: {
        scheduleKey,
        digestSummary: {
          cashAtRisk: digest.cashAtRisk,
          deadStockCount: digest.deadStockCount,
          stockoutRiskCount: digest.stockoutRiskCount,
        },
      },
    });
  } catch (logErr) {
    console.error("[Weekly Email Scheduler] EmailLog write failed:", logErr.message);
  }

  if (result.success) {
    // ── Update schedule key + sentAt ────────────────────────────────────────
    await EmailSettings.updateOne(
      { shop },
      {
        $set: {
          lastDigestScheduleKey: scheduleKey,
          lastWeeklyDigestSentAt: new Date(),
        },
      }
    );
    console.log("[Weekly Email Scheduler] Email sent successfully →", shop);
  } else {
    console.error("[Weekly Email Scheduler] Email failed →", shop, ":", result.error);
  }

  return result;
}

// ==================================================
// MANUAL TRIGGER — used by runNow endpoint
// ==================================================

async function triggerDigestForShop({ shop, email, force = false }) {
  const scheduleKey = force ? `${shop}-MANUAL-${Date.now()}` : null;
  return sendWeeklyDigest({ shop, email, scheduleKey });
}

module.exports = {
  startWeeklyEmailScheduler,
  runSchedulerCheck,
  triggerDigestForShop,
};
