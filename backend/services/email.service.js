const nodemailer = require("nodemailer");

let cachedTransporter = null;

function maskEmail(email) {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Get unified email configuration from environment variables
 */
function getEmailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL;
  const smtpPass = process.env.SMTP_PASS || process.env.APP_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

  const fromEmail =
    process.env.BACK_IN_STOCK_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    smtpUser ||
    "notifications@smartstock.app";

  const fromName = process.env.BACK_IN_STOCK_FROM_NAME || "Smart Stock Alerts";

  return {
    resendApiKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    fromEmail,
    fromName,
  };
}

/**
 * Initialize and verify real SMTP transporter
 */
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const config = getEmailConfig();

  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log(`[Email Service] SMTP transporter configured for host: ${config.smtpHost}`);
  } else if (config.smtpUser && config.smtpPass) {
    // Gmail or standard service authentication
    if (config.smtpUser.toLowerCase().includes("@gmail.com")) {
      cachedTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });
      console.log(`[Email Service] Gmail SMTP transporter configured for: ${maskEmail(config.smtpUser)}`);
    } else {
      const domain = config.smtpUser.split("@")[1] || "gmail.com";
      cachedTransporter = nodemailer.createTransport({
        host: `smtp.${domain}`,
        port: 587,
        secure: false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      console.log(`[Email Service] Standard SMTP transporter configured for host: smtp.${domain}`);
    }
  }

  return cachedTransporter;
}

/**
 * Generic email dispatch supporting Resend REST API or real SMTP
 */
async function sendEmail({ to, subject, html, text, fromName, fromEmail }) {
  const config = getEmailConfig();
  const cleanTo = String(to || "").trim().toLowerCase();
  const senderEmail = fromEmail || config.fromEmail;
  const senderName = fromName || config.fromName;
  const fromHeader = `${senderName} <${senderEmail}>`;

  // 1. Resend API
  if (config.resendApiKey) {
    try {
      console.log(`[Email Service] Sending via Resend API to: ${maskEmail(cleanTo)}`);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [cleanTo],
          subject,
          html,
          text,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || `Resend HTTP error ${response.status}`);
      }

      console.log(`[Email Service] Resend accepted message. ID: ${resData.id}`);
      return {
        success: true,
        messageId: resData.id,
        provider: "resend",
      };
    } catch (err) {
      console.error(`[Email Service] Resend API failure for ${maskEmail(cleanTo)}:`, err.message);
      return {
        success: false,
        error: err.message,
        provider: "resend",
      };
    }
  }

  // 2. Real SMTP Transport
  const mailer = await getTransporter();
  if (mailer) {
    try {
      console.log(`[Email Service] Dispatching via SMTP to: ${maskEmail(cleanTo)}`);
      const info = await mailer.sendMail({
        from: fromHeader,
        to: cleanTo,
        subject,
        text,
        html,
      });

      console.log(`[Email Service] SMTP accepted message. ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        provider: "smtp",
      };
    } catch (err) {
      console.error(`[Email Service] SMTP send failure for ${maskEmail(cleanTo)}:`, err.message);
      return {
        success: false,
        error: err.message,
        provider: "smtp",
      };
    }
  }

  // 3. No credentials configured
  const errorMsg =
    "No live email provider configured. Please set EMAIL & APP_PASSWORD, SMTP credentials, or RESEND_API_KEY in environment variables.";
  console.error(`[Email Service] ${errorMsg}`);
  return {
    success: false,
    error: errorMsg,
  };
}

/**
 * Send subscription confirmation email to customer
 */
async function sendConfirmationEmail({
  to,
  shop,
  productTitle,
  variantTitle,
  productHandle,
  variantId,
}) {
  try {
    const cleanShop = String(shop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    const prodName = productTitle || "Product";
    const varDetail = variantTitle && variantTitle !== "Default Title" ? ` (${variantTitle})` : "";
    const fullTitle = `${prodName}${varDetail}`;

    const subject = `You're on the waitlist for ${fullTitle}`;
    const textBody = `Hi there,\n\nYou're on the waitlist! We received your request to be notified when ${fullTitle} is back in stock at ${cleanShop || "our store"}.\n\nWe will email you as soon as inventory is restocked.\n\nThank you for shopping with us!`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f8; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e1e3e5; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
                <tr>
                  <td style="padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);">
                    <div style="font-size: 40px; line-height: 1; margin-bottom: 12px;">🔔</div>
                    <h1 style="margin: 0; color: #111827; font-size: 22px; font-weight: 800;">You're on the Waitlist!</h1>
                    <p style="margin: 6px 0 0 0; color: #059669; font-size: 15px; font-weight: 600;">We'll alert you the moment it restocks</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 32px 28px 32px; color: #374151; font-size: 15px; line-height: 1.6;">
                    <p style="margin: 0 0 18px 0;">
                      We have received your restock notification request. As soon as <strong>${fullTitle}</strong> is back in stock, you will receive an email with a direct purchase link.
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 18px 0;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <div style="font-size: 15px; font-weight: 700; color: #111827;">${prodName}</div>
                          ${varDetail ? `<div style="font-size: 14px; color: #4b5563; margin-top: 4px;"><strong>Option:</strong> ${variantTitle}</div>` : ""}
                          <div style="font-size: 13px; color: #6b7280; margin-top: 6px;"><strong>Store:</strong> ${cleanShop || "Store"}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.5;">
                      Powered by Smart Stock • Stockout Shield
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
  } catch (error) {
    console.error("[Email Service] Failed sending confirmation email:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send real back-in-stock notification email with direct product link
 */
async function sendBackInStockEmail({
  to,
  shop,
  productTitle,
  variantTitle,
  productHandle,
  variantId,
  currentStock,
}) {
  const cleanShop = String(shop || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const prodName = productTitle || "Product";
  const varDetail = variantTitle && variantTitle !== "Default Title" ? ` (${variantTitle})` : "";
  const fullTitle = `${prodName}${varDetail}`;

  const productPath = productHandle ? `/products/${productHandle}` : "";
  const variantQuery = variantId ? `?variant=${variantId}` : "";
  const productUrl =
    cleanShop && productPath
      ? `https://${cleanShop}${productPath}${variantQuery}`
      : cleanShop
      ? `https://${cleanShop}`
      : "#";

  const subject = `Good news! ${fullTitle} is back in stock`;
  const textBody = `Good news!\n\nThe ${fullTitle} you requested is now back in stock.\n\nStock may be limited, so we recommend ordering soon.\n\nShop Now: ${productUrl}\n\nThank you for your patience!\n${cleanShop}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f8; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e1e3e5; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
              
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);">
                  <div style="font-size: 40px; line-height: 1; margin-bottom: 12px;">🎉</div>
                  <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Back in Stock!</h1>
                  <p style="margin: 6px 0 0 0; color: #059669; font-size: 15px; font-weight: 600;">The item you requested is now available</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 0 32px 28px 32px; color: #374151; font-size: 15px; line-height: 1.6;">
                  <p style="margin: 0 0 20px 0;">
                    Good news! We have restocked <strong>${fullTitle}</strong> at <strong>${cleanShop}</strong>. Since you asked to be notified, here is your direct link to claim yours before it sells out again.
                  </p>

                  <!-- Product Box -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <div style="font-size: 16px; font-weight: 700; color: #111827;">${prodName}</div>
                        ${varDetail ? `<div style="font-size: 14px; color: #4b5563; margin-top: 4px;"><strong>Option:</strong> ${variantTitle}</div>` : ""}
                        ${
                          currentStock
                            ? `<div style="font-size: 13px; color: #059669; font-weight: 600; margin-top: 6px;">✓ Restocked (${currentStock} units available)</div>`
                            : `<div style="font-size: 13px; color: #059669; font-weight: 600; margin-top: 6px;">✓ Limited inventory available</div>`
                        }
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0 24px 0;">
                    <tr>
                      <td align="center">
                        <a href="${productUrl}" target="_blank" style="display: inline-block; background-color: #008060; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 128, 96, 0.25);">
                          🛒 Shop Now
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size: 13px; color: #6b7280; text-align: center; margin: 0;">
                    Stock may be limited. If the button above does not work, visit:<br/>
                    <a href="${productUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${productUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.5;">
                    You are receiving this alert because you subscribed to back-in-stock notifications for this product on <strong>${cleanShop}</strong>.<br/>
                    Powered by Smart Stock • Stockout Shield
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail({
    to,
    subject,
    html: htmlBody,
    text: textBody,
  });
}

/**
 * Send professional Pre-Order Confirmation Email (Credit Card & COD support)
 */
async function sendPreOrderConfirmationEmail({
  to,
  customerName,
  orderNumber,
  shop,
  paymentMethod = "Credit Card",
  isPaid = true,
  items = [],
  totalPrice = 0,
  currency = "USD",
}) {
  try {
    const cleanShop = String(shop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    function formatPrice(amount) {
      const num = Number(amount || 0);
      const cur = String(currency || "USD").toUpperCase();
      let symbol = "$";
      if (cur === "USD") symbol = "$";
      else if (cur === "INR") symbol = "₹";
      else if (cur === "EUR") symbol = "€";
      else if (cur === "GBP") symbol = "£";
      else symbol = `${cur} `;
      return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    let name = customerName && customerName !== "Guest Customer" ? customerName : "Valued Customer";
    name = String(name).replace(/\btest\b/gi, "").replace(/\s+/g, " ").trim();
    if (!name) name = "Valued Customer";
    const ordNum = orderNumber || "Pre-Order";
    const formattedTotal = formatPrice(totalPrice);
    const isCod = /cod|cash/i.test(paymentMethod) || !isPaid;

    const subject = isCod
      ? `Pre-Order Confirmed (Cash on Delivery) — ${ordNum}`
      : `Pre-Order Confirmed — ${ordNum}`;

    const paymentText = isCod
      ? `Payment Method: Cash on Delivery (COD)\nPayment Status: Pending (To be collected on delivery)\n\nNote: Payment has not been collected yet. The amount of ${formattedTotal} will be collected through Cash on Delivery when your order is delivered.`
      : `Payment Method: ${paymentMethod || "Credit Card"}\nPayment Status: Paid & Confirmed\n\nYour payment has been successfully authorized and captured.`;

    const textBody = `Hi ${name},\n\nThank you for your order! Your Pre-Order (${ordNum}) has been successfully placed at ${cleanShop || "our store"}.\n\n${paymentText}\n\nYour item is a Pre-Order and will be dispatched according to the expected availability timeline.\n\nItems Ordered:\n${items
      .map((it) => `- ${it.title}${it.variantTitle ? ` (${it.variantTitle})` : ""} x ${it.quantity || 1} - ${formatPrice(it.price)}`)
      .join("\n")}\n\nTotal: ${formattedTotal}\n\nThank you for shopping with us!\n${cleanShop}`;

    // Item rows for HTML email
    const itemsHtml = items
      .map((it) => {
        const itemTitle = it.title || "Pre-Order Product";
        const varTitle = it.variantTitle && it.variantTitle !== "Default Title" ? it.variantTitle : "";
        const itemPrice = formatPrice(it.price);
        const itemImage = it.image || "";
        const hasValidImage = Boolean(itemImage && (itemImage.startsWith("http://") || itemImage.startsWith("https://")));

        const imgTag = hasValidImage
          ? `<img src="${itemImage}" alt="${itemTitle}" width="60" height="60" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; display: block;" />`
          : `<div style="width: 60px; height: 60px; border-radius: 8px; background-color: #f3f4f6; border: 1px solid #e5e7eb; text-align: center; line-height: 60px; font-size: 24px;">📦</div>`;

        return `
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f3f4f6;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top; width: 72px;">
                    ${imgTag}
                  </td>
                  <td style="vertical-align: top; padding-left: 8px;">
                    <div style="font-size: 15px; font-weight: 700; color: #111827;">${itemTitle}</div>
                    ${varTitle ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${varTitle}</div>` : ""}
                    <div style="display: inline-block; background-color: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; margin-top: 5px;">
                      🛒 Pre-Order Item
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top; white-space: nowrap;">
                    <div style="font-size: 15px; font-weight: 700; color: #111827;">${itemPrice}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Qty: ${it.quantity || 1}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      })
      .join("");

    const paymentBoxHtml = isCod
      ? `
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 24px; vertical-align: top; font-size: 18px;">💵</td>
              <td style="padding-left: 10px;">
                <div style="font-size: 14px; font-weight: 700; color: #854d0e;">Payment Method: Cash on Delivery (COD)</div>
                <div style="font-size: 13px; color: #a16207; margin-top: 4px; line-height: 1.5;">
                  <strong>Payment has not been collected yet.</strong> The amount of <strong>${formattedTotal}</strong> will be collected in cash upon delivery according to the store's COD process.
                </div>
              </td>
            </tr>
          </table>
        </div>
      `
      : `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 24px; vertical-align: top; font-size: 18px;">💳</td>
              <td style="padding-left: 10px;">
                <div style="font-size: 14px; font-weight: 700; color: #166534;">Payment Method: ${paymentMethod || "Credit Card / Online Payment"}</div>
                <div style="font-size: 13px; color: #15803d; margin-top: 4px; line-height: 1.5;">
                  ✓ <strong>Payment Confirmed:</strong> Your payment of <strong>${formattedTotal}</strong> has been successfully authorized and captured.
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f8; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e1e3e5; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);">
                    <div style="font-size: 42px; line-height: 1; margin-bottom: 12px;">🛒</div>
                    <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Pre-Order Confirmed!</h1>
                    <p style="margin: 6px 0 0 0; color: #059669; font-size: 15px; font-weight: 600;">Order ${ordNum}</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 0 32px 28px 32px; color: #374151; font-size: 15px; line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                      Hi <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 16px 0;">
                      Thank you for your pre-order! We have received your order <strong>${ordNum}</strong> at <strong>${cleanShop || "our store"}</strong>.
                    </p>

                    <!-- Payment Status Box -->
                    ${paymentBoxHtml}

                    <!-- Dispatch Notice -->
                    <div style="background-color: #f9fafb; border-left: 4px solid #059669; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                      <div style="font-size: 13px; color: #374151; line-height: 1.5;">
                        📦 <strong>Dispatch & Delivery Timeline:</strong> Your items are reserved as a Pre-Order. They will be prepared and dispatched as soon as stock is received. You will receive an email with shipment tracking details once dispatched.
                      </div>
                    </div>

                    <!-- Items Table -->
                    <div style="margin: 24px 0 16px 0;">
                      <div style="font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                        Order Summary
                      </div>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        ${itemsHtml}
                      </table>

                      <!-- Total Row -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px;">
                        <tr>
                          <td style="font-size: 16px; font-weight: 800; color: #111827; padding-top: 8px;">Total</td>
                          <td align="right" style="font-size: 18px; font-weight: 800; color: #059669; padding-top: 8px;">${formattedTotal}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px 0;">
                      Need help with your pre-order? Contact us at <strong>${cleanShop}</strong>.
                    </p>
                    <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.5;">
                      Powered by Smart Stock • Pre-Order Manager
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const sendRes = await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log(`[PreOrder Email] Sent confirmation for ${ordNum} to ${maskEmail(to)}. Success:`, sendRes.success);
    return sendRes;
  } catch (error) {
    console.error("[PreOrder Email] Failed sending pre-order email:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send Pre-Order 50% (or Configured %) Deposit Payment Confirmation Email
 */
async function sendPreOrderDepositPaymentConfirmationEmail({
  to,
  customerName,
  orderNumber,
  shop,
  items = [],
  depositPercentage = 50,
  preOrderTotal = 0,
  depositPaid = 0,
  remainingBalance = 0,
  launchDate = "",
  estimatedShippingDate = "",
  currency = "USD",
}) {
  try {
    const cleanShop = String(shop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    function formatMoney(amount) {
      const num = Number(amount || 0);
      const cur = String(currency || "USD").toUpperCase();
      let symbol = "$";
      if (cur === "USD") symbol = "$";
      else if (cur === "INR") symbol = "₹";
      else if (cur === "EUR") symbol = "€";
      else if (cur === "GBP") symbol = "£";
      else if (cur === "CAD") symbol = "CA$";
      else if (cur === "AUD") symbol = "AU$";
      else symbol = `${cur} `;
      return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    let name = customerName && customerName !== "Guest Customer" ? customerName : "Valued Customer";
    name = String(name).replace(/\btest\b/gi, "").replace(/\s+/g, " ").trim();
    if (!name) name = "Valued Customer";

    const ordNum = orderNumber || "Pre-Order";
    const formattedTotal = formatMoney(preOrderTotal);
    const formattedDepositPaid = formatMoney(depositPaid);
    const formattedRemaining = formatMoney(remainingBalance);
    const pct = Number(depositPercentage) || 50;

    const subject = `Pre-Order Deposit Payment Confirmed — Order #${ordNum.replace(/^#/, "")}`;

    const textBody = `Hi ${name},

Thank you for your pre-order! Your ${pct}% deposit payment has been successfully received.

==================================================
PRE-ORDER DEPOSIT PAYMENT CONFIRMED
==================================================

Order: #${ordNum.replace(/^#/, "")}
Deposit Paid: ${formattedDepositPaid} (${pct}%)
Remaining Balance: ${formattedRemaining}
Pre-Order Total: ${formattedTotal}
${launchDate ? `Launch Date: ${launchDate}\n` : ""}${estimatedShippingDate ? `Estimated Shipping: ${estimatedShippingDate}\n` : ""}
Payment Status: ${pct}% DEPOSIT PAID

Items Ordered:
${items
  .map((it) => `- ${it.title}${it.variantTitle ? ` (${it.variantTitle})` : ""} x ${it.quantity || 1} — ${formatMoney(it.price)}`)
  .join("\n")}

Note: Your remaining balance of ${formattedRemaining} will be due according to the pre-order payment schedule.

Thank you for shopping with us!
${cleanShop || "Our Store"}
`;

    // Item rows for HTML email
    const itemsHtml = items
      .map((it) => {
        const itemTitle = it.title || "Pre-Order Product";
        const varTitle = it.variantTitle && it.variantTitle !== "Default Title" ? it.variantTitle : "";
        const itemPrice = formatMoney(it.price);
        const itemDepositPaid = formatMoney(it.depositPaid || it.price * (pct / 100));
        const itemRemaining = formatMoney(it.remainingBalance || it.price - (it.depositPaid || it.price * (pct / 100)));
        const itemImage = it.image || "";
        const hasValidImage = Boolean(itemImage && (itemImage.startsWith("http://") || itemImage.startsWith("https://")));

        const imgTag = hasValidImage
          ? `<img src="${itemImage}" alt="${itemTitle}" width="68" height="68" style="width: 68px; height: 68px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; display: block;" />`
          : `<div style="width: 68px; height: 68px; border-radius: 8px; background-color: #f1f5f9; border: 1px solid #e2e8f0; text-align: center; line-height: 68px; font-size: 26px;">🚀</div>`;

        return `
          <tr>
            <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top; width: 78px;">
                    ${imgTag}
                  </td>
                  <td style="vertical-align: top; padding-left: 8px;">
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${itemTitle}</div>
                    ${varTitle ? `<div style="font-size: 13px; color: #64748b; margin-top: 2px;">Option: ${varTitle}</div>` : ""}
                    <div style="margin-top: 6px;">
                      <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">
                        🛒 Pre-Order (${pct}% Deposit)
                      </span>
                    </div>
                    <div style="font-size: 12px; color: #059669; font-weight: 600; margin-top: 5px;">
                      ✓ Deposit Paid: <strong>${itemDepositPaid}</strong> <span style="color: #64748b; font-weight: normal;">• Balance Due: <strong>${itemRemaining}</strong></span>
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top; white-space: nowrap;">
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${itemPrice}</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Qty: ${it.quantity || 1}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      })
      .join("");

    const scheduleRowsHtml = `
      ${launchDate ? `
        <tr>
          <td style="padding: 8px 0 4px 0; font-size: 14px; color: #475569;">📅 Launch Date</td>
          <td align="right" style="padding: 8px 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${launchDate}</td>
        </tr>
      ` : ""}
      ${estimatedShippingDate ? `
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #475569;">📦 Estimated Shipping</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${estimatedShippingDate}</td>
        </tr>
      ` : ""}
    `;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
                
                <!-- Header Banner -->
                <tr>
                  <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);">
                    <div style="font-size: 46px; line-height: 1; margin-bottom: 12px;">✅</div>
                    <div style="display: inline-block; background-color: #065f46; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px;">
                      PRE-ORDER DEPOSIT CONFIRMED
                    </div>
                    <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">
                      ${pct}% Deposit Received!
                    </h1>
                    <p style="margin: 8px 0 0 0; color: #059669; font-size: 15px; font-weight: 600;">
                      Order #${ordNum.replace(/^#/, "")}
                    </p>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 0 32px 28px 32px; color: #334155; font-size: 15px; line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                      Hi <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0;">
                      Thank you for your pre-order. Your <strong>${pct}% deposit payment</strong> has been successfully received and your item is officially reserved.
                    </p>

                    <!-- Payment Summary Box -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                            Pre-Order Payment Breakdown
                          </div>
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="padding: 6px 0; font-size: 14px; color: #475569;">Original Pre-Order Total</td>
                              <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${formattedTotal}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; font-size: 14px; color: #047857; font-weight: 700;">
                                Deposit Paid (${pct}%)
                              </td>
                              <td align="right" style="padding: 6px 0; font-size: 15px; font-weight: 800; color: #047857;">
                                ${formattedDepositPaid}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; font-size: 14px; color: #475569; font-weight: 700; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 4px;">
                                Remaining Balance Due
                              </td>
                              <td align="right" style="padding: 6px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                                ${formattedRemaining}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; font-size: 14px; color: #475569;">Payment Status</td>
                              <td align="right" style="padding: 6px 0;">
                                <span style="background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                                  ${pct}% DEPOSIT PAID
                                </span>
                              </td>
                            </tr>
                            ${scheduleRowsHtml}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Note on Remaining Balance -->
                    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                      <div style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                        💡 <strong>Important Note:</strong> Your remaining balance of <strong>${formattedRemaining}</strong> will be due according to the pre-order payment schedule prior to dispatch.
                      </div>
                    </div>

                    <!-- Items Section -->
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                      Reserved Pre-Order Items
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      ${itemsHtml}
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="font-size: 13px; color: #64748b; margin: 0 0 6px 0;">
                      Questions about your pre-order? Contact the store team at <strong>${cleanShop || "our store"}</strong>.
                    </p>
                    <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
                      Powered by Smart Stock • Pre-Order Launch Protection
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const sendRes = await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log(`[PREORDER EMAIL] Deposit confirmation dispatched for #${ordNum.replace(/^#/, "")} to ${maskEmail(to)}. Success:`, sendRes.success);
    return sendRes;
  } catch (error) {
    console.error("[PREORDER EMAIL] Failed sending deposit confirmation email:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  maskEmail,
  sendEmail,
  sendConfirmationEmail,
  sendBackInStockEmail,
  sendPreOrderConfirmationEmail,
  sendPreOrderDepositPaymentConfirmationEmail,
};

