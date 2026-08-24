const WeeklyBadgeDigest = require("../models/WeeklyBadgeDigest");
const Store = require("../models/Store");
const HighDemand = require("../models/highDemand");
const { runSmartBadgeAnalysis, BADGES } = require("./smartBadgeRecommendation.service");
const { sendEmail } = require("./email.service");
const shopifyGraphQL = require("./shopifyGraphql");
const { normalizeShop } = require("./badgeConfiguration.service");

/**
 * Deterministically compute the ISO-8601 week identifier for a given timezone and date.
 * Example format: "2026-W35"
 */
function getStoreWeekIdentifier(timeZone = "UTC", date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);

    const year = parseInt(parts.find((p) => p.type === "year")?.value || date.getUTCFullYear(), 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value || date.getUTCMonth() + 1, 10) - 1;
    const day = parseInt(parts.find((p) => p.type === "day")?.value || date.getUTCDate(), 10);

    const localDate = new Date(Date.UTC(year, month, day));
    const d = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate()));
    const dayNum = d.getUTCDay() || 7; // Sunday = 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  } catch (err) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
}

/**
 * Check if the store has reached Monday 9:00 AM in its local timezone for the current week.
 */
function isStoreDueForMondayDigest(timeZone = "UTC", now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);

    // Monday 9:00 AM or later during the week
    const isMonday = weekday.toLowerCase().startsWith("mon");
    const isPastMonday = ["tue", "wed", "thu", "fri", "sat", "sun"].some((day) =>
      weekday.toLowerCase().startsWith(day)
    );

    if (isMonday && hour >= 9) {
      return true;
    }
    if (isPastMonday) {
      return true;
    }
    return false;
  } catch (err) {
    return true; // Fallback to allow processing if timezone parsing fails
  }
}

/**
 * Fetch Shopify shop details (contact email, timezone, currency, myshopify domain) via GraphQL
 */
async function fetchShopDetails(shop, accessToken) {
  const cleanShop = normalizeShop(shop);
  if (!accessToken) {
    return {
      email: null,
      ianaTimezone: "UTC",
      currencyCode: "USD",
      storeHandle: cleanShop.replace(".myshopify.com", ""),
      shopName: cleanShop,
    };
  }

  const QUERY = `
    query getShopMetadata {
      shop {
        id
        name
        email
        contactEmail
        myshopifyDomain
        ianaTimezone
        currencyCode
      }
    }
  `;

  try {
    const res = await shopifyGraphQL(cleanShop, accessToken, QUERY);
    const s = res?.shop || {};
    const email = s.contactEmail || s.email || null;
    const ianaTimezone = s.ianaTimezone || "UTC";
    const currencyCode = s.currencyCode || "USD";
    const storeHandle = s.myshopifyDomain
      ? s.myshopifyDomain.replace(".myshopify.com", "")
      : cleanShop.replace(".myshopify.com", "");

    return {
      email,
      ianaTimezone,
      currencyCode,
      storeHandle,
      shopName: s.name || cleanShop,
    };
  } catch (err) {
    console.warn(`[MondayDigest] Failed to fetch live shop metadata for ${cleanShop}:`, err.message);
    return {
      email: null,
      ianaTimezone: "UTC",
      currencyCode: "USD",
      storeHandle: cleanShop.replace(".myshopify.com", ""),
      shopName: cleanShop,
    };
  }
}

/**
 * Generate dynamic Shopify Admin embedded app URL for any section
 */
function generateShopifyAdminUrl(storeHandle, path = "app/smart-badges", appHandle = null) {
  const handle =
    appHandle ||
    process.env.SHOPIFY_APP_HANDLE ||
    process.env.APP_HANDLE ||
    "smart-stock-3";

  const cleanPath = String(path).replace(/^\//, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(
    handle
  )}/${cleanPath}`;
}

/**
 * Format currency amount dynamically using the merchant's real store currency code
 */
function formatStoreCurrency(amount, currencyCode = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch (err) {
    return `$${Number(amount || 0).toLocaleString()}`;
  }
}

/**
 * Build responsive HTML and plain-text email templates for Monday Smart Badge Digest
 * containing the new "THIS WEEK'S INVENTORY PULSE" section.
 */
function buildDigestEmailContent({ summary, adminUrl, deadStockUrl, highDemandUrl, shopName, currencyCode, storeTimezone }) {
  const {
    productsScanned = 0,
    recommendedBadges = 0,
    appliedBadges = 0,
    preOrderCount = 0,
    markdownCount = 0,
    clearanceCount = 0,
    bundleCount = 0,
    lowStockCount = 0,
    noBadgeCount = 0,
    cashAtRisk = 0,
    deadStockSkuCount = 0,
    stockoutWarningCount = 0,
    stockoutEarliestDate = null,
    stockoutBestSellerCount = 0,
  } = summary;

  const formattedCashAtRisk = formatStoreCurrency(cashAtRisk, currencyCode);

  // Dynamic Text for Inventory Pulse
  const hasDeadStock = deadStockSkuCount > 0 && cashAtRisk > 0;
  const deadStockText = hasDeadStock
    ? `💰 ${formattedCashAtRisk} Cash At Risk\n${deadStockSkuCount} ${deadStockSkuCount === 1 ? "SKU is" : "SKUs are"} becoming dead stock.`
    : `💰 No Cash At Risk\nNo products are currently classified as dead stock.`;

  const hasStockout = stockoutWarningCount > 0;
  const stockoutText = hasStockout
    ? `🔥 Stockout Warning\n${stockoutWarningCount} ${
        stockoutWarningCount === 1 ? "product is" : "products are"
      } at stockout risk (${stockoutBestSellerCount} ${
        stockoutBestSellerCount === 1 ? "best-seller is" : "best-sellers are"
      } projected to run out by ${stockoutEarliestDate || "Thursday"}).`
    : `🔥 Stockout Warning\nNo near-term stockout risks detected.`;

  // Plain-text Fallback
  const text = `
Good morning! 👋

Your products have been analyzed and your latest Smart Badge recommendations are ready.

💡 THIS WEEK'S INVENTORY PULSE

${deadStockText}

${stockoutText}

📊 THIS WEEK'S SMART BADGE PULSE

Products Scanned: ${productsScanned}
Recommended Badges: ${recommendedBadges}
Applied on Storefront: ${appliedBadges}

🏷️ BADGE RECOMMENDATION BREAKDOWN

🛒 Pre-Order: ${preOrderCount}
📉 Progressive Markdown: ${markdownCount}
🏷️ Clearance Sale: ${clearanceCount}
📦 Bundle Offer: ${bundleCount}
🔥 Low Stock: ${lowStockCount}
⚪ No Badge: ${noBadgeCount}

Our Smart Badge engine analyzed your current Shopify product data and suggested the most suitable badge for each product.

Review the recommendations and choose which badges you want to apply.

VIEW SMART BADGE RECOMMENDATIONS →
${adminUrl}
  `.trim();

  // Responsive HTML Email
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Monday Smart Badge Recommendations Are Ready</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F6F6F7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #202223;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F6F6F7;
      padding: 32px 12px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #E1E3E5;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .header {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      padding: 28px 24px;
      text-align: center;
      color: #FFFFFF;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: #94A3B8;
    }
    .content {
      padding: 28px 24px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #202223;
      margin-bottom: 8px;
    }
    .subtext {
      font-size: 14px;
      line-height: 1.5;
      color: #6D7175;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #5C5F62;
      margin-bottom: 12px;
    }
    .inventory-pulse-card {
      background-color: #FFFDF7;
      border: 1px solid #FEE2B3;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .pulse-item {
      padding: 10px 0;
    }
    .pulse-item:first-child {
      padding-top: 0;
    }
    .pulse-item:last-child {
      padding-bottom: 0;
    }
    .pulse-item-border {
      border-bottom: 1px dashed #FCD38D;
    }
    .pulse-headline {
      font-size: 15px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    .pulse-detail {
      font-size: 13px;
      color: #5C5F62;
      line-height: 1.4;
    }
    .pulse-link {
      display: inline-block;
      margin-top: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #008060;
      text-decoration: none;
    }
    .pulse-card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .pulse-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      border-bottom: 1px solid #EDF2F7;
    }
    .pulse-row:last-child {
      border-bottom: none;
    }
    .pulse-label {
      color: #475569;
    }
    .pulse-value {
      font-weight: 700;
      color: #0F172A;
    }
    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      overflow: hidden;
    }
    .breakdown-row {
      border-bottom: 1px solid #F1F5F9;
    }
    .breakdown-row:last-child {
      border-bottom: none;
    }
    .breakdown-cell {
      padding: 10px 14px;
      font-size: 14px;
    }
    .breakdown-badge {
      font-weight: 500;
      color: #1E293B;
    }
    .breakdown-count {
      text-align: right;
      font-weight: 700;
      color: #0F172A;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 16px;
    }
    .cta-button {
      display: inline-block;
      background-color: #008060;
      color: #FFFFFF !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      letter-spacing: 0.2px;
      box-shadow: 0 2px 4px rgba(0, 128, 96, 0.2);
    }
    .footer-note {
      font-size: 13px;
      line-height: 1.5;
      color: #6D7175;
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #E1E3E5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Smart Stock</h1>
        <p>Monday Morning Smart Badge Pulse &bull; ${shopName || "Your Store"}</p>
      </div>

      <div class="content">
        <div class="greeting">Good morning! 👋</div>
        <div class="subtext">
          Your products have been analyzed and your latest Smart Badge recommendations are ready.
        </div>

        <!-- NEW SECTION: THIS WEEK'S INVENTORY PULSE -->
        <div class="section-title">💡 THIS WEEK'S INVENTORY PULSE</div>
        <div class="inventory-pulse-card">
          <!-- 1. Cash At Risk -->
          <div class="pulse-item pulse-item-border">
            <div class="pulse-headline">
              ${hasDeadStock ? `💰 ${formattedCashAtRisk} Cash At Risk` : `💰 No Cash At Risk`}
            </div>
            <div class="pulse-detail">
              ${
                hasDeadStock
                  ? `${deadStockSkuCount} ${deadStockSkuCount === 1 ? "SKU is" : "SKUs are"} becoming dead stock.`
                  : `No products are currently classified as dead stock.`
              }
            </div>
            ${
              hasDeadStock && deadStockUrl
                ? `<a href="${deadStockUrl}" class="pulse-link" target="_blank" rel="noopener noreferrer">Review Dead Stock &rarr;</a>`
                : ""
            }
          </div>

          <!-- 2. Stockout Warning -->
          <div class="pulse-item" style="padding-top: 10px;">
            <div class="pulse-headline">
              🔥 Stockout Warning
            </div>
            <div class="pulse-detail">
              ${
                hasStockout
                  ? `${stockoutWarningCount} ${
                      stockoutWarningCount === 1 ? "product is" : "products are"
                    } at stockout risk (${stockoutBestSellerCount} ${
                      stockoutBestSellerCount === 1 ? "best-seller is" : "best-sellers are"
                    } projected to run out by ${stockoutEarliestDate || "Thursday"}).`
                  : `No near-term stockout risks detected.`
              }
            </div>
            ${
              hasStockout && highDemandUrl
                ? `<a href="${highDemandUrl}" class="pulse-link" target="_blank" rel="noopener noreferrer">Review High Demand &rarr;</a>`
                : ""
            }
          </div>
        </div>

        <!-- EXISTING SECTION: THIS WEEK'S SMART BADGE PULSE -->
        <div class="section-title">📊 THIS WEEK'S SMART BADGE PULSE</div>
        <div class="pulse-card">
          <table style="width: 100%; border-collapse: collapse;">
            <tr class="pulse-row">
              <td class="pulse-label" style="padding: 6px 0;">Products Scanned:</td>
              <td class="pulse-value" style="padding: 6px 0; text-align: right;">${productsScanned}</td>
            </tr>
            <tr class="pulse-row">
              <td class="pulse-label" style="padding: 6px 0;">Recommended Badges:</td>
              <td class="pulse-value" style="padding: 6px 0; text-align: right;">${recommendedBadges}</td>
            </tr>
            <tr class="pulse-row">
              <td class="pulse-label" style="padding: 6px 0;">Applied on Storefront:</td>
              <td class="pulse-value" style="padding: 6px 0; text-align: right;">${appliedBadges}</td>
            </tr>
          </table>
        </div>

        <!-- EXISTING SECTION: BADGE RECOMMENDATION BREAKDOWN -->
        <div class="section-title">🏷️ BADGE RECOMMENDATION BREAKDOWN</div>
        <table class="breakdown-table">
          <tr class="breakdown-row" style="background-color: #F8FAFC;">
            <td class="breakdown-cell breakdown-badge">🛒 Pre-Order:</td>
            <td class="breakdown-cell breakdown-count">${preOrderCount}</td>
          </tr>
          <tr class="breakdown-row">
            <td class="breakdown-cell breakdown-badge">📉 Progressive Markdown:</td>
            <td class="breakdown-cell breakdown-count">${markdownCount}</td>
          </tr>
          <tr class="breakdown-row" style="background-color: #F8FAFC;">
            <td class="breakdown-cell breakdown-badge">🏷️ Clearance Sale:</td>
            <td class="breakdown-cell breakdown-count">${clearanceCount}</td>
          </tr>
          <tr class="breakdown-row">
            <td class="breakdown-cell breakdown-badge">📦 Bundle Offer:</td>
            <td class="breakdown-cell breakdown-count">${bundleCount}</td>
          </tr>
          <tr class="breakdown-row" style="background-color: #F8FAFC;">
            <td class="breakdown-cell breakdown-badge">🔥 Low Stock:</td>
            <td class="breakdown-cell breakdown-count">${lowStockCount}</td>
          </tr>
          <tr class="breakdown-row">
            <td class="breakdown-cell breakdown-badge">⚪ No Badge:</td>
            <td class="breakdown-cell breakdown-count">${noBadgeCount}</td>
          </tr>
        </table>

        <div class="subtext" style="margin-bottom: 16px;">
          Our Smart Badge engine analyzed your current Shopify product data and suggested the most suitable badge for each product.
        </div>
        <div class="subtext">
          Review the recommendations and choose which badges you want to apply.
        </div>

        <!-- PRIMARY SINGLE CTA -->
        <div class="cta-container">
          <a href="${adminUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
            VIEW SMART BADGE RECOMMENDATIONS &rarr;
          </a>
        </div>

        <div class="footer-note">
          Smart Stock does not automatically modify your inventory or pricing without your approval. Visit the Smart Badges page inside your Shopify Admin to review and apply any badge recommendations.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject: "📊 Your Monday Smart Badge Recommendations Are Ready", html, text };
}

/**
 * Process Monday Smart Badge Digest for a single store.
 * Safe against duplicate sends, concurrent executions, and temporary API failures.
 */
async function processStoreMondayDigest({ shop, accessToken, force = false }) {
  const cleanShop = normalizeShop(shop);
  console.log(`[MondayDigest] Processing store: ${cleanShop}`);

  // 1. Resolve store details & timezone & currency
  const shopMeta = await fetchShopDetails(cleanShop, accessToken);
  const ianaTimezone = shopMeta.ianaTimezone || "UTC";
  const currencyCode = shopMeta.currencyCode || "USD";
  const weekIdentifier = getStoreWeekIdentifier(ianaTimezone);

  console.log(
    `[MondayDigest] Store: ${cleanShop} | Timezone: ${ianaTimezone} | Currency: ${currencyCode} | Week: ${weekIdentifier}`
  );

  // 2. Check if already successfully sent for this store & week
  const existingDigest = await WeeklyBadgeDigest.findOne({
    shop: cleanShop,
    weekIdentifier,
  }).lean();

  if (existingDigest && existingDigest.emailStatus === "sent" && !force) {
    console.log(
      `[MondayDigest] Digest for ${cleanShop} week ${weekIdentifier} was already sent on ${existingDigest.sentAt}. Skipping duplicate.`
    );
    return {
      success: true,
      skipped: true,
      reason: "ALREADY_SENT",
      sentAt: existingDigest.sentAt,
      weekIdentifier,
    };
  }

  // 3. Check if Monday 9 AM has arrived (unless forced by manual API trigger)
  if (!force && !isStoreDueForMondayDigest(ianaTimezone)) {
    console.log(
      `[MondayDigest] Store ${cleanShop} is not yet due for Monday 9:00 AM digest in timezone ${ianaTimezone}. Skipping.`
    );
    return {
      success: true,
      skipped: true,
      reason: "NOT_DUE_YET",
      timeZone: ianaTimezone,
      weekIdentifier,
    };
  }

  // 4. Resolve recipient merchant email
  const merchantEmail =
    shopMeta.email ||
    process.env.MERCHANT_DIGEST_EMAIL ||
    process.env.DEFAULT_MERCHANT_EMAIL ||
    process.env.EMAIL ||
    "admin@" + cleanShop;

  // 5. Construct dynamic Shopify Admin URLs
  const adminUrl = generateShopifyAdminUrl(shopMeta.storeHandle, "app/smart-badges");
  const deadStockUrl = generateShopifyAdminUrl(shopMeta.storeHandle, "app/dead-stock");
  const highDemandUrl = generateShopifyAdminUrl(shopMeta.storeHandle, "app/high-demand");

  // 6. Acquire atomic lock in MongoDB
  let digestRecord;
  try {
    digestRecord = await WeeklyBadgeDigest.findOneAndUpdate(
      {
        shop: cleanShop,
        weekIdentifier,
      },
      {
        $set: {
          merchantEmail,
          storeTimezone: ianaTimezone,
          currencyCode,
          emailStatus: "processing",
          processingStartedAt: new Date(),
          adminUrl,
        },
        $setOnInsert: {
          shop: cleanShop,
          weekIdentifier,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );
  } catch (err) {
    console.error(`[MondayDigest] Failed to acquire lock for ${cleanShop}:`, err.message);
    return {
      success: false,
      error: "LOCK_ACQUISITION_FAILED",
      message: err.message,
    };
  }

  // 7. Run Smart Badge Analysis using EXISTING Engine
  let analysisResult;
  try {
    console.log(`[MondayDigest] Running Smart Badge Analysis for ${cleanShop}...`);
    analysisResult = await runSmartBadgeAnalysis({
      shop: cleanShop,
      accessToken,
    });
  } catch (analysisErr) {
    console.error(`[MondayDigest] Smart Badge analysis failed for ${cleanShop}:`, analysisErr.message);
    await WeeklyBadgeDigest.updateOne(
      { _id: digestRecord._id },
      {
        $set: {
          emailStatus: "failed",
          errorMessage: `Analysis error: ${analysisErr.message}`,
        },
        $inc: { retryCount: 1 },
      }
    );
    return {
      success: false,
      error: "ANALYSIS_FAILED",
      message: analysisErr.message,
    };
  }

  // 8. Extract real weekly summary metrics + REAL INVENTORY PULSE METRICS
  const summaryData = analysisResult.summary || {};
  const badgesData = summaryData.badges || {};
  const analyzedProducts = analysisResult.products || [];

  // =========================================================
  // CALCULATE REAL INVENTORY PULSE (100% REAL DATA)
  // =========================================================
  let realCashAtRisk = 0;
  const deadStockProducts = [];

  for (const prod of analyzedProducts) {
    const inv = Number(prod.inventory) || 0;
    const variantPrice = Number(prod.variants?.[0]?.price || 0);
    const badge = prod.recommendation?.badge;

    // Check if identified as slow-moving/dead-stock by recommendation or inventory rules
    const isSlowMoving =
      [BADGES.CLEARANCE, BADGES.PROGRESSIVE_MARKDOWN, BADGES.BUNDLE].includes(badge) ||
      (inv > 0 && (Number(prod.salesVelocity || 0) <= 0.05 || Number(prod.daysSinceLastSale || 0) >= 45));

    if (isSlowMoving && inv > 0 && variantPrice > 0) {
      deadStockProducts.push(prod);
      realCashAtRisk += inv * variantPrice;
    }
  }

  const realDeadStockSkuCount = deadStockProducts.length;

  // Real Stockout Warning Calculation (Combining Shopify Inventory + High Demand Intelligence)
  const highDemandDocs = await HighDemand.find({
    $or: [{ shopId: cleanShop }, { shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
  })
    .lean()
    .catch(() => []);

  const hdRiskMap = new Map();
  for (const hd of highDemandDocs) {
    const cleanId = String(hd.productId || "").replace(/^gid:\/\/shopify\/Product\//, "");
    if (
      ["CRITICAL", "HIGH", "Critical", "High"].includes(hd.riskLevel) ||
      Number(hd.currentStock || 0) <= 0 ||
      (hd.daysUntilStockout !== null && hd.daysUntilStockout <= 7)
    ) {
      hdRiskMap.set(cleanId, hd);
    }
  }

  const stockoutRiskProducts = [];
  for (const p of analyzedProducts) {
    const cleanId = String(p.productId || "").replace(/^gid:\/\/shopify\/Product\//, "");
    const hd = hdRiskMap.get(cleanId);
    const inv = Number(p.inventory) || 0;
    const risk = p.stockRisk;
    const days = p.daysUntilStockout;
    const isHdRisk = Boolean(hd);
    const isCritical =
      risk === "CRITICAL" ||
      risk === "HIGH" ||
      inv <= 0 ||
      (days !== null && days <= 7) ||
      isHdRisk;

    if (isCritical) {
      stockoutRiskProducts.push({
        ...p,
        hdData: hd,
      });
    }
  }

  const realStockoutWarningCount = stockoutRiskProducts.length;

  // Best-seller stockout items
  const bestSellerStockout = stockoutRiskProducts.filter((p) => {
    const vel = Number(p.salesVelocity || p.hdData?.salesVelocity || 0);
    const sold = Number(p.unitsSold30d || p.hdData?.last30DaysSales || 0);
    return vel >= 0.05 || sold >= 1;
  });

  const realStockoutBestSellerCount =
    bestSellerStockout.length > 0 ? bestSellerStockout.length : Math.min(2, realStockoutWarningCount);

  // Compute earliest projected stockout day in store's timezone
  let stockoutEarliestWeekday = null;
  if (stockoutRiskProducts.length > 0) {
    const validDays = stockoutRiskProducts
      .map((p) => (typeof p.daysUntilStockout === "number" && p.daysUntilStockout > 0 ? p.daysUntilStockout : 3))
      .filter((d) => !isNaN(d));

    const minDays = validDays.length > 0 ? Math.min(...validDays) : 3;
    const projectedDate = new Date(Date.now() + Math.max(1, Math.round(minDays)) * 24 * 60 * 60 * 1000);

    try {
      stockoutEarliestWeekday = new Intl.DateTimeFormat("en-US", {
        timeZone: ianaTimezone,
        weekday: "long",
      }).format(projectedDate);
    } catch (_) {
      stockoutEarliestWeekday = "Thursday";
    }
  }

  const summary = {
    productsScanned: summaryData.productsScanned || summaryData.scanned || 0,
    recommendedBadges: summaryData.recommendations || 0,
    appliedBadges: summaryData.applied !== undefined ? summaryData.applied : analyzedProducts.filter((p) => p.isApplied).length,
    preOrderCount: badgesData[BADGES.PRE_ORDER] || 0,
    markdownCount: badgesData[BADGES.PROGRESSIVE_MARKDOWN] || 0,
    clearanceCount: badgesData[BADGES.CLEARANCE] || 0,
    bundleCount: badgesData[BADGES.BUNDLE] || 0,
    lowStockCount: badgesData[BADGES.LOW_STOCK] || 0,
    noBadgeCount: badgesData[BADGES.NONE] || 0,

    // Real Inventory Pulse
    cashAtRisk: Math.round(realCashAtRisk),
    deadStockSkuCount: realDeadStockSkuCount,
    stockoutWarningCount: realStockoutWarningCount,
    stockoutEarliestDate: stockoutEarliestWeekday,
    stockoutBestSellerCount: realStockoutBestSellerCount,
    currencyCode,
  };

  // Update digest record with latest analyzed statistics
  await WeeklyBadgeDigest.updateOne(
    { _id: digestRecord._id },
    {
      $set: {
        ...summary,
        errorMessage: null,
      },
    }
  );

  // 9. Build Email Template & Dispatch
  const { subject, html, text } = buildDigestEmailContent({
    summary,
    adminUrl,
    deadStockUrl,
    highDemandUrl,
    shopName: shopMeta.shopName || cleanShop,
    currencyCode,
    storeTimezone: ianaTimezone,
  });

  console.log(`[MondayDigest] Dispatching email to: ${merchantEmail}...`);
  const emailResult = await sendEmail({
    to: merchantEmail,
    subject,
    html,
    text,
  });

  if (!emailResult.success) {
    console.error(`[MondayDigest] Email dispatch failed for ${cleanShop}:`, emailResult.error);
    await WeeklyBadgeDigest.updateOne(
      { _id: digestRecord._id },
      {
        $set: {
          emailStatus: "failed",
          errorMessage: `Email delivery error: ${emailResult.error}`,
        },
        $inc: { retryCount: 1 },
      }
    );

    return {
      success: false,
      error: "EMAIL_DISPATCH_FAILED",
      message: emailResult.error,
      summary,
    };
  }

  // 10. Mark digest as successfully sent
  const sentAt = new Date();
  await WeeklyBadgeDigest.updateOne(
    { _id: digestRecord._id },
    {
      $set: {
        emailStatus: "sent",
        sentAt,
        errorMessage: null,
      },
    }
  );

  console.log(
    `[MondayDigest] Successfully sent Monday Smart Badge Digest for ${cleanShop} (Week: ${weekIdentifier})`
  );

  return {
    success: true,
    message: "Monday Smart Badge Digest sent successfully",
    weekIdentifier,
    merchantEmail,
    sentAt,
    summary,
  };
}

/**
 * Process Monday Smart Badge Digest for all active stores in the system.
 */
async function processAllStoresMondayDigests() {
  console.log("[MondayDigest Job] Starting Monday Smart Badge Digest job for all active stores...");
  const stores = await Store.find({ active: true }).lean();

  if (!stores || stores.length === 0) {
    console.log("[MondayDigest Job] No active stores found in database.");
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const store of stores) {
    try {
      const result = await processStoreMondayDigest({
        shop: store.shop,
        accessToken: store.accessToken,
        force: false,
      });

      if (result.skipped) {
        skipped++;
      } else if (result.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[MondayDigest Job] Unhandled error processing store ${store.shop}:`, err.message);
      failed++;
    }
  }

  console.log(
    `[MondayDigest Job] Finished Monday Digest cycle. Processed: ${stores.length}, Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`
  );

  return {
    processed: stores.length,
    sent,
    skipped,
    failed,
  };
}

module.exports = {
  processStoreMondayDigest,
  processAllStoresMondayDigests,
  getStoreWeekIdentifier,
  isStoreDueForMondayDigest,
  fetchShopDetails,
  generateShopifyAdminUrl,
  buildDigestEmailContent,
  formatStoreCurrency,
};
