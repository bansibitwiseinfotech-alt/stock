const ContactSupport = require("../models/ContactSupport");
const { sendEmail, getSMTPConfig } = require("../services/smtpService");

/**
 * POST /api/contact-support
 * Create a new support ticket in tbl_contact_support and dispatch notification email
 */
async function createSupportRequest(req, res) {
  try {
    const shop =
      req.shop ||
      req.body?.shop ||
      req.query?.shop ||
      req.headers?.["x-shopify-shop-domain"] ||
      "";

    const { name, email, category, subject, message } = req.body || {};

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required.",
      });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        message: "Contact email is required.",
      });
    }

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const cleanShop = String(shop).trim().toLowerCase();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanSubject = String(subject).trim();
    const cleanMessage = String(message).trim();
    const cleanCategory = String(category || "general").trim();

    // 1. SAVE TO MONGODB tbl_contact_support
    const ticket = await ContactSupport.create({
      shop: cleanShop,
      name: cleanName,
      email: cleanEmail,
      category: cleanCategory,
      subject: cleanSubject,
      message: cleanMessage,
      status: "OPEN",
      metadata: {
        userAgent: req.headers["user-agent"] || "",
        ip: req.ip || "",
        submittedAt: new Date(),
      },
    });

    const ticketNumber = ticket._id.toString().slice(-6).toUpperCase();

    console.log(
      `[ContactSupport] Ticket #${ticketNumber} created in tbl_contact_support for ${cleanShop}`
    );

    // 2. SEND NOTIFICATION EMAILS VIA SMTP
    let emailSentToMerchant = false;
    let emailSentToAdmin = false;

    try {
      const smtpConfig = getSMTPConfig();
      const adminEmail = smtpConfig.user || process.env.SMTP_USER || "support@smartstock.app";

      // ── Email 1: Confirmation to Merchant ───────────────────
      const merchantHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px;">
          <table align="center" width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e1e3e5; margin: 0 auto;">
            <tr>
              <td style="background-color: #008060; padding: 20px 24px; text-align: left;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Smart Stock Support</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="font-size: 15px; color: #202223; margin-top: 0;">
                  Hi ${cleanName || "Merchant"},
                </p>
                <p style="font-size: 14px; color: #4a4a4a; line-height: 1.5;">
                  We have received your support request <strong>#${ticketNumber}</strong>. Our support & engineering team is reviewing your message and will get back to you within <strong>2–4 hours</strong> during business days.
                </p>
                
                <div style="background-color: #f9fafb; border: 1px solid #e1e3e5; border-radius: 6px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; font-size: 13px; color: #333333;">
                    <tr>
                      <td style="padding: 4px 0; width: 120px; color: #6d7175;"><strong>Ticket ID:</strong></td>
                      <td style="padding: 4px 0;">#${ticketNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6d7175;"><strong>Store:</strong></td>
                      <td style="padding: 4px 0;">${cleanShop}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6d7175;"><strong>Category:</strong></td>
                      <td style="padding: 4px 0;">${cleanCategory.replace("_", " ").toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6d7175;"><strong>Subject:</strong></td>
                      <td style="padding: 4px 0;"><strong>${cleanSubject}</strong></td>
                    </tr>
                  </table>
                  <hr style="border: none; border-top: 1px solid #e1e3e5; margin: 12px 0;" />
                  <p style="font-size: 13px; color: #202223; margin: 0; white-space: pre-wrap;">${cleanMessage}</p>
                </div>

                <p style="font-size: 13px; color: #6d7175; margin-bottom: 0;">
                  Need to add more information? Simply reply directly to this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #fafbfb; padding: 14px 24px; border-top: 1px solid #e1e3e5; text-align: center;">
                <p style="font-size: 12px; color: #8c9196; margin: 0;">
                  © ${new Date().getFullYear()} Smart Stock. Managed via Shopify.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const merchantRes = await sendEmail({
        to: cleanEmail,
        subject: `[Smart Stock Support] Ticket #${ticketNumber}: ${cleanSubject}`,
        html: merchantHtml,
      });

      if (merchantRes.success) emailSentToMerchant = true;

      // ── Email 2: Alert to Support/Admin Inbox ────────────────
      if (adminEmail && adminEmail.toLowerCase() !== cleanEmail.toLowerCase()) {
        const adminHtml = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #008060; margin-top: 0;">🔔 New Support Request #${ticketNumber}</h2>
            <p><strong>Shop:</strong> ${cleanShop}</p>
            <p><strong>Merchant:</strong> ${cleanName || "N/A"} &lt;${cleanEmail}&gt;</p>
            <p><strong>Category:</strong> ${cleanCategory}</p>
            <p><strong>Subject:</strong> ${cleanSubject}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;"/>
            <p><strong>Message:</strong></p>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; white-space: pre-wrap;">${cleanMessage}</div>
          </div>
        `;

        const adminRes = await sendEmail({
          to: adminEmail,
          subject: `🔔 [Ticket #${ticketNumber}] ${cleanSubject} - ${cleanShop}`,
          html: adminHtml,
        });

        if (adminRes.success) emailSentToAdmin = true;
      }
    } catch (mailErr) {
      console.warn("[ContactSupport] Email dispatch notice:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Support ticket submitted successfully! A confirmation email has been sent.",
      ticket: {
        id: ticket._id,
        ticketNumber,
        shop: ticket.shop,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        emailSentToMerchant,
        emailSentToAdmin,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error("[ContactSupport] Create ticket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit support request.",
    });
  }
}

/**
 * GET /api/contact-support
 * List support tickets for a store
 */
async function getSupportRequests(req, res) {
  try {
    const shop =
      req.shop ||
      req.query?.shop ||
      req.headers?.["x-shopify-shop-domain"] ||
      "";

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required.",
      });
    }

    const tickets = await ContactSupport.find({
      shop: String(shop).trim().toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    console.error("[ContactSupport] Fetch tickets error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve support requests.",
    });
  }
}

module.exports = {
  createSupportRequest,
  getSupportRequests,
};
