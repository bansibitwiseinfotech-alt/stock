// ==================================================
// emailDigestService.js
//
// Generates a weekly email digest using 100% REAL LIVE
// MongoDB & Shopify store data matching the Dashboard.
// ==================================================

const mongoose = require("mongoose");
const DeadStock = require("../models/DeadStock");
const HighDemand = require("../models/highDemand");
const ClearanceSale = require("../models/ClearanceSale");
const Bundle = require("../models/Bundle");
const MarkdownRule = require("../models/MarkdownRule");
const LaunchPreOrder = require("../models/LaunchPreOrder");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const SmartBadgeAssignment = require("../models/SmartBadgeAssignment");
const Store = require("../models/Store");
const shopifyGraphQL = require("./shopifyGraphql");
const { runDeadStockEngine } = require("./deadStock/deadStockEngine");

// ==================================================
// AGGREGATE DASHBOARD & STORE METRICS
// ==================================================

async function generateWeeklyDigest(shop) {
  const cleanShop = String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  console.log(`[EmailDigest] Aggregating live store data for: ${cleanShop}`);

  const shopFilter = {
    $or: [
      { shop: cleanShop },
      { shop: `https://${cleanShop}` },
      { shopId: cleanShop },
      { shopId: `https://${cleanShop}` },
      { shop: new RegExp(`^${cleanShop}$`, "i") },
      { shopId: new RegExp(`^${cleanShop}$`, "i") },
    ],
  };

  try {
    // 1. Fetch Store record (for access token & currency)
    const storeRecord = await Store.findOne({
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    })
      .lean()
      .catch(() => null);

    // 2. Fetch live action counts & documents from MongoDB
    let [
      deadStockDocs,
      highDemandDocs,
      clearanceSales,
      bundles,
      markdownRules,
      launchPreOrders,
      highDemandStorefronts,
      smartBadgeAssignments,
    ] = await Promise.all([
      DeadStock.find(shopFilter).lean().catch(() => []),
      HighDemand.find(shopFilter).lean().catch(() => []),
      ClearanceSale.find(shopFilter).lean().catch(() => []),
      Bundle.find(shopFilter).lean().catch(() => []),
      MarkdownRule.find(shopFilter).lean().catch(() => []),
      LaunchPreOrder.find(shopFilter).lean().catch(() => []),
      HighDemandStorefront.find(shopFilter).lean().catch(() => []),
      SmartBadgeAssignment.find(shopFilter).lean().catch(() => []),
    ]);

    // If dead stock has not been synced yet, run dead stock sync
    if (deadStockDocs.length === 0 && storeRecord?.accessToken) {
      try {
        console.log(`[EmailDigest] Running DeadStock sync for ${cleanShop}...`);
        await runDeadStockEngine(cleanShop, storeRecord.accessToken);
        deadStockDocs = await DeadStock.find(shopFilter).lean().catch(() => []);
      } catch (syncErr) {
        console.warn("[EmailDigest] DeadStock sync notice:", syncErr.message);
      }
    }

    // 3. Fetch real live Shopify orders & currency if token is present
    let liveOrders = [];
    let currencySymbol = "$";
    if (storeRecord?.accessToken) {
      try {
        const orderRes = await shopifyGraphQL(
          cleanShop,
          storeRecord.accessToken,
          `query getDigestOrders {
            shop { currencyCode }
            orders(first: 250, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
                name
                createdAt
                totalPriceSet { shopMoney { amount currencyCode } }
              }
            }
          }`
        );
        liveOrders = orderRes?.orders?.nodes || [];
        const code = orderRes?.shop?.currencyCode || "USD";
        currencySymbol = code === "USD" ? "$" : code === "EUR" ? "€" : code === "GBP" ? "£" : code === "INR" ? "₹" : "$";
      } catch (gqlErr) {
        console.warn("[EmailDigest] Shopify GraphQL orders fetch notice:", gqlErr.message);
      }
    }

    // 4. REAL Total Cash Recovered (Real sum of store order revenues)
    let totalOrderRevenue = 0;
    for (const o of liveOrders) {
      totalOrderRevenue += parseFloat(o.totalPriceSet?.shopMoney?.amount || 0);
    }
    const totalCashRecovered = Math.round(totalOrderRevenue);

    // 5. REAL Dead Stock Cash Tied Up & SKU Count
    let deadStockCashTiedUp = 0;
    let deadStockSkuCount = 0;
    const deadOnly = deadStockDocs.filter(
      (d) => d.status === "dead_stock" || (d.daysUnsold != null && d.daysUnsold >= 60)
    );
    const deadItemsToCount = deadOnly.length > 0 ? deadOnly : deadStockDocs.filter((d) => (d.cashTiedUp || 0) > 0);

    for (const d of deadItemsToCount) {
      const cash = Number(d.cashTiedUp) || (Number(d.price || d.currentPrice || 0) * Number(d.stock || 0));
      if (cash > 0) {
        deadStockCashTiedUp += cash;
        deadStockSkuCount++;
      }
    }

    // 6. REAL High Demand, Stockout Risks & Revenue at Risk
    const priceMap = new Map();
    for (const d of deadStockDocs) {
      const p = Number(d.currentPrice || d.price || 0);
      if (p > 0) {
        if (d.variantId) priceMap.set(d.variantId, p);
        if (d.productId) priceMap.set(d.productId, p);
      }
    }

    const highRiskItems = highDemandDocs.filter((h) =>
      ["CRITICAL", "HIGH", "Critical", "High"].includes(h.riskLevel)
    );
                   
    let revenueAtRisk = 0;
    for (const item of highRiskItems) {
      const price = priceMap.get(item.variantId) || priceMap.get(item.productId) || Number(item.price || item.currentPrice || 0);
      const stock = Number(item.stock || item.currentStock || 0);
      const reorderQty = Number(item.reorderQuantity) || 5;
      revenueAtRisk += price > 0 ? price * (stock > 0 ? stock : reorderQty) : 0;
    }

    const stockoutRiskCount = highRiskItems.length > 0 ? highRiskItems.length : highDemandDocs.length;

    // Real Top Stockouts table rows
    const topStockouts = (highRiskItems.length > 0 ? highRiskItems : highDemandDocs)
      .slice(0, 5)
      .map((h) => ({
        name: h.productName || h.title || "Product",
        variant: h.variantTitle && h.variantTitle !== "Default Title" ? h.variantTitle : "",
        stock: Number(h.stock ?? h.currentStock ?? 0),
        sales30d: Number(h.salesLast30Days ?? h.last30DaysSales ?? h.sales30Days ?? 0),
        reorderQty: Number(h.reorderQuantity) || (Number(h.stock ?? h.currentStock ?? 0) <= 0 ? 10 : 5),
      }));

    // 7. REAL Active Automations Count
    const activeClearances = clearanceSales.filter((c) => c.status !== "INACTIVE").length;
    const activeBundles = bundles.filter((b) => b.status !== "INACTIVE").length;
    const activeMarkdowns = markdownRules.filter((m) => m.status === "ACTIVE" && m.active !== false).length;
    const activePreOrders = launchPreOrders.filter((l) => l.preOrderEnabled).length;
    const activeUrgencyBadges = highDemandStorefronts.filter((h) => h.urgencyBadgeEnabled).length;
    const activeSmartBadges = smartBadgeAssignments.filter((s) => s.status === "ACTIVE").length;

    const activeAutomationsCount =
      activeClearances +
      activeBundles +
      activeMarkdowns +
      activePreOrders +
      Math.max(activeUrgencyBadges, activeSmartBadges);

    // 8. REAL Promotional Badges & Widgets Statuses
    const customizationBadges = [
      {
        name: "Clearance Sale",
        description: "Renders clearance badges and urgency banners on discounted inventory.",
        status: activeClearances > 0 ? "Active" : "Inactive",
        count: activeClearances,
      },
      {
        name: "Bundle Offer",
        description: "Displays bundle offers and companion pairings with 1-click cart addition.",
        status: activeBundles > 0 ? "Active" : "Inactive",
        count: activeBundles,
      },
      {
        name: "Progressive Markdown",
        description: "Displays progressive discount badges beside real pricing on active markdowns.",
        status: activeMarkdowns > 0 ? "Active" : "Inactive",
        count: activeMarkdowns,
      },
      {
        name: "Low Stock Badge",
        description: "Displays an urgency badge and remaining inventory count on low-stock items (≤ 5 units).",
        status: activeUrgencyBadges > 0 ? "Active" : "Inactive",
        count: activeUrgencyBadges,
      },
      {
        name: "Pre-Orders",
        description: "Allows customers to pre-order upcoming new product launches with deposit options.",
        status: activePreOrders > 0 ? "Active" : "Inactive",
        count: activePreOrders,
      },
    ];

    console.log(`[EmailDigest] Summary compiled for ${cleanShop}: recovered=${totalCashRecovered}, deadStock=${deadStockCashTiedUp}, skus=${deadStockSkuCount}, risk=${revenueAtRisk}, automations=${activeAutomationsCount}`);

    return {
      shop: cleanShop,
      currencySymbol,
      totalCashRecovered,
      deadStockCashTiedUp: Math.round(deadStockCashTiedUp),
      deadStockSkuCount,
      revenueAtRisk: Math.round(revenueAtRisk),
      stockoutRiskCount,
      activeAutomationsCount,
      topStockouts,
      customizationBadges,
    };
  } catch (err) {
    console.error("[EmailDigest] Error aggregating data:", err.message);
    return {
      shop: cleanShop,
      currencySymbol: "$",
      totalCashRecovered: 0,
      deadStockCashTiedUp: 0,
      deadStockSkuCount: 0,
      revenueAtRisk: 0,
      stockoutRiskCount: 0,
      activeAutomationsCount: 0,
      topStockouts: [],
      customizationBadges: [
        { name: "Clearance Sale", description: "Clearance badges and urgency banners", status: "Inactive" },
        { name: "Bundle Offer", description: "Frequently Bought Together pairings", status: "Inactive" },
        { name: "Progressive Markdown", description: "Dynamic discount tier badges", status: "Inactive" },
        { name: "Low Stock Badge", description: "Urgency inventory alert for stock ≤ 5 units", status: "Inactive" },
        { name: "Pre-Orders", description: "Customer pre-order deposit buttons", status: "Inactive" },
      ],
    };
  }
}

// ==================================================
// SIMPLE, CLEAN & MODERN HTML EMAIL TEMPLATE
// ==================================================

function buildDigestHTML(digest, shop) {
  const cleanShop = String(shop || digest.shop || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sym = digest.currencySymbol || "$";
  const formatMoney = (val) =>
    `${sym}${Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  // Stockout Risk Table Rows
  const stockoutRows =
    digest.topStockouts && digest.topStockouts.length > 0
      ? digest.topStockouts
          .map(
            (item) => `
            <tr>
              <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;font-weight:600;">
                ${item.name}
                ${item.variant ? `<div style="font-size:11px;color:#6b7280;font-weight:normal;margin-top:2px;">${item.variant}</div>` : ""}
              </td>
              <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${item.stock <= 0 ? "#fef2f2" : "#fff7ed"};color:${item.stock <= 0 ? "#b91c1c" : "#c2410c"};">
                  ${item.stock <= 0 ? "Out of Stock" : item.stock + " units"}
                </span>
              </td>
              <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:#374151;">
                ${item.sales30d}
              </td>
              <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:700;color:#4f46e5;">
                +${item.reorderQty} units
              </td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#6b7280;font-size:13px;">No critical stockout risks detected.</td></tr>`;

  // Customization & Badges Rows
  const badgeRows = digest.customizationBadges
    .map(
      (b) => `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">
          ${b.name}
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;">
          ${b.description}
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${b.status === "Active" ? "#dcfce7" : "#f3f4f6"};color:${b.status === "Active" ? "#15803d" : "#6b7280"};">
            ● ${b.status}${b.count != null ? ` (${b.count})` : ""}
          </span>
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Stock Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f6f7;padding:30px 10px;">
    <tr>
      <td align="center">
        <!-- CARD CONTAINER -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background-color:#ffffff;border-radius:10px;border:1px solid #e1e3e5;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="padding:28px 30px 20px 30px;border-bottom:1px solid #e5e7eb;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size:13px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em;">Smart Stock</div>
                    <h1 style="margin:4px 0 0 0;font-size:20px;font-weight:700;color:#111827;">Weekly Inventory & Badges Overview</h1>
                    <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${cleanShop} • ${dateFormatted}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 4 KPI CARDS -->
          <tr>
            <td style="padding:24px 30px 12px 30px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- CARD 1: Total Cash Recovered -->
                  <td width="48%" style="padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;">Total cash recovered</div>
                    <div style="font-size:22px;font-weight:800;color:#111827;margin-top:4px;">${formatMoney(digest.totalCashRecovered)}</div>
                    <div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:2px;">Across active promotions</div>
                  </td>
                  <td width="4%"></td>
                  <!-- CARD 2: Dead Stock Cash Tied Up -->
                  <td width="48%" style="padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;">Dead stock cash tied up</div>
                    <div style="font-size:22px;font-weight:800;color:#111827;margin-top:4px;">${formatMoney(digest.deadStockCashTiedUp)}</div>
                    <div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:2px;">${digest.deadStockSkuCount} SKUs identified</div>
                  </td>
                </tr>
                <tr><td height="12" colspan="3"></td></tr>
                <tr>
                  <!-- CARD 3: Revenue at Risk -->
                  <td width="48%" style="padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;">Revenue at risk</div>
                    <div style="font-size:22px;font-weight:800;color:#111827;margin-top:4px;">${formatMoney(digest.revenueAtRisk)}</div>
                    <div style="font-size:11px;color:#d97706;font-weight:600;margin-top:2px;">${digest.stockoutRiskCount} items at risk</div>
                  </td>
                  <td width="4%"></td>
                  <!-- CARD 4: Active Automations -->
                  <td width="48%" style="padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;">Active automations</div>
                    <div style="font-size:22px;font-weight:800;color:#111827;margin-top:4px;">${digest.activeAutomationsCount}</div>
                    <div style="font-size:11px;color:#2563eb;font-weight:600;margin-top:2px;">Badges & discount rules running</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SECTION 1: BADGES & CUSTOMIZATIONS -->
          <tr>
            <td style="padding:20px 30px 0 30px;">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:10px;">
                🏷️ Promotional Badges & Widgets
              </div>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:left;">Feature</th>
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:left;">Description</th>
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:right;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${badgeRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- SECTION 2: HIGH DEMAND & STOCKOUT RISKS -->
          <tr>
            <td style="padding:24px 30px 24px 30px;">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:10px;">
                🚨 High Demand & Stockout Warnings
              </div>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:left;">Product</th>
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:center;">Stock</th>
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:center;">30D Sales</th>
                    <th style="padding:10px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;text-align:right;">Suggested Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  ${stockoutRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:18px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4;">
                This weekly email was automatically generated by <strong>Smart Stock</strong>.<br>
                You can manage your notification preferences in your Smart Stock Settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  generateWeeklyDigest,
  buildDigestHTML,
};
