// ==================================================
// smtpService.js
//
// Single reusable Nodemailer SMTP transporter.
// Uses environment variables only — no hardcoded credentials.
//
// Required .env variables:
//   SMTP_HOST   = smtp.gmail.com
//   SMTP_PORT   = 465
//   SMTP_SECURE = true
//   SMTP_USER   = you@gmail.com
//   SMTP_PASS   = your_app_password
//   SMTP_FROM   = Smart Stock <you@gmail.com>
//
// If SMTP_HOST is not set, falls back to Gmail service
// using SMTP_USER + SMTP_PASS (or legacy EMAIL + APP_PASSWORD).
// ==================================================

const nodemailer = require("nodemailer");

let _transporter = null;

// ==================================================
// GET SMTP CONFIG FROM ENV
// ==================================================

function getSMTPConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;
  const user =
    process.env.SMTP_USER ||
    process.env.EMAIL;
  const pass =
    process.env.SMTP_PASS ||
    process.env.APP_PASSWORD;
  const from =
    process.env.SMTP_FROM ||
    `Smart Stock <${user}>`;

  return { host, port, secure, user, pass, from };
}

// ==================================================
// CREATE TRANSPORTER (once, then cached)
// ==================================================

function getTransporter() {
  if (_transporter) return _transporter;

  const { host, port, secure, user, pass } = getSMTPConfig();

  if (!user || !pass) {
    throw new Error(
      "[SMTP] SMTP credentials not configured. " +
      "Set SMTP_USER and SMTP_PASS (or EMAIL and APP_PASSWORD) in .env"
    );
  }

  console.log("[SMTP] Configuring transporter:");
  console.log("[SMTP]   Host  :", host || "(Gmail service)");
  console.log("[SMTP]   Port  :", port);
  console.log("[SMTP]   Secure:", secure);
  console.log("[SMTP]   User  :", user);
  // NEVER log pass

  if (host) {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  } else if (user.toLowerCase().includes("@gmail.com")) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    console.log("[SMTP]   Service: Gmail");
  } else {
    const domain = user.split("@")[1] || "";
    _transporter = nodemailer.createTransport({
      host: `smtp.${domain}`,
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    console.log("[SMTP]   Host (auto):", `smtp.${domain}`);
  }

  return _transporter;
}

// ==================================================
// VERIFY SMTP CONNECTION
// Call on startup — logs result, does NOT throw.
// ==================================================

async function verifySMTP() {
  try {
    const t = getTransporter();
    await t.verify();
    const { user } = getSMTPConfig();
    console.log("[SMTP] ✅ SMTP connection verified. Ready to send as:", user);
    return true;
  } catch (err) {
    console.warn("[SMTP] ⚠️  SMTP verification failed:", err.message);
    return false;
  }
}

// ==================================================
// SEND EMAIL
// ==================================================

/**
 * Send an email via SMTP.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendEmail({ to, subject, html, text }) {
  const { from } = getSMTPConfig();

  console.log("[SMTP] Sending to:", to);
  console.log("[SMTP] Subject  :", subject);

  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from,
      to: String(to).trim().toLowerCase(),
      subject,
      html,
      text: text || "",
    });

    console.log("[SMTP] ✅ Sent. Message ID:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error("[SMTP] ❌ Send failed:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName =
    name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

async function sendBackInStockEmail({ to, shop, productTitle, variantTitle, currentStock }) {
  const cleanTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
  const subject = `Back in stock: ${cleanTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e1e3e5; border-radius: 8px;">
      <h2 style="color: #202223;">Good news! It's back in stock.</h2>
      <p style="color: #6d7175;"><strong>${cleanTitle}</strong> is now available to purchase on ${shop}.</p>
      ${currentStock ? `<p style="color: #6d7175;">Units available: ${currentStock}</p>` : ""}
      <p style="color: #8c9196; font-size: 12px; margin-top: 30px;">You received this email because you subscribed to back-in-stock notifications.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

async function sendConfirmationEmail({ to, shop, productTitle, variantTitle }) {
  const cleanTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
  const subject = `Notification confirmed: ${cleanTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e1e3e5; border-radius: 8px;">
      <h2 style="color: #202223;">You're on the list!</h2>
      <p style="color: #6d7175;">We will notify you at this email address as soon as <strong>${cleanTitle}</strong> is back in stock.</p>
      <p style="color: #8c9196; font-size: 12px; margin-top: 30px;">Thank you for shopping with ${shop}.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  verifySMTP,
  getSMTPConfig,
  maskEmail,
  sendBackInStockEmail,
  sendConfirmationEmail,
};
