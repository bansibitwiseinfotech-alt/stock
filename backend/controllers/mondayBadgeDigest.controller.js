const WeeklyBadgeDigest = require("../models/WeeklyBadgeDigest");
const Store = require("../models/Store");
const {
  processStoreMondayDigest,
  getStoreWeekIdentifier,
  fetchShopDetails,
} = require("../services/mondayBadgeDigest.service");
const { normalizeShop } = require("../services/badgeConfiguration.service");

/**
 * Resolves shop domain and access token from request
 */
async function resolveShopCredentials(req) {
  const shop =
    req.query.shop ||
    req.headers["x-shopify-shop-domain"] ||
    req.body?.shop ||
    req.shopId ||
    req.shop;

  let accessToken =
    req.headers["x-shopify-access-token"] ||
    req.body?.accessToken ||
    req.shopifyAccessToken;

  let cleanShop = shop ? normalizeShop(shop) : null;

  if (!cleanShop) {
    const fallbackStore = await Store.findOne({ active: true })
      .sort({ updatedAt: -1 })
      .lean()
      .catch(() => null);
    if (fallbackStore?.shop) {
      cleanShop = fallbackStore.shop;
      accessToken = fallbackStore.accessToken;
    }
  }

  if (cleanShop && !accessToken) {
    const store = await Store.findOne({
      $or: [{ shop: cleanShop }, { shop: new RegExp(`^${cleanShop}$`, "i") }],
    }).lean();

    if (store?.accessToken) {
      accessToken = store.accessToken;
    } else if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
      accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    }
  }

  return { shop: cleanShop, accessToken };
}

/**
 * POST /api/smart-badges/send-weekly-digest
 * Manually or on-demand dispatch Monday Smart Badge Digest for the authenticated store.
 */
async function sendWeeklyDigest(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required to send Monday digest.",
      });
    }

    const force = req.body?.force !== false; // Defaults to true for manual API trigger

    const result = await processStoreMondayDigest({
      shop,
      accessToken,
      force,
    });

    if (!result.success && !result.skipped) {
      return res.status(500).json({
        success: false,
        message: result.message || "Failed to process and send Monday digest.",
        error: result.error,
        summary: result.summary,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.skipped
        ? `Monday Smart Badge Digest skipped: ${result.reason}`
        : "Monday Smart Badge Digest sent successfully",
      weekIdentifier: result.weekIdentifier,
      merchantEmail: result.merchantEmail,
      sentAt: result.sentAt,
      skipped: result.skipped || false,
      summary: result.summary || {
        productsScanned: 0,
        recommendedBadges: 0,
        appliedBadges: 0,
        preOrderCount: 0,
        markdownCount: 0,
        clearanceCount: 0,
        bundleCount: 0,
        lowStockCount: 0,
        noBadgeCount: 0,
      },
    });
  } catch (error) {
    console.error("[MondayDigestController] sendWeeklyDigest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing Monday digest.",
      error: error.message,
    });
  }
}

/**
 * GET /api/smart-badges/weekly-digest-status
 * Retrieve the status of the current and latest weekly badge digest.
 */
async function getWeeklyDigestStatus(req, res) {
  try {
    const { shop, accessToken } = await resolveShopCredentials(req);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop domain is required.",
      });
    }

    const shopMeta = await fetchShopDetails(shop, accessToken);
    const timeZone = shopMeta.ianaTimezone || "UTC";
    const currentWeekIdentifier = getStoreWeekIdentifier(timeZone);

    // Find current week digest or latest sent digest
    const [currentWeekDigest, latestSentDigest] = await Promise.all([
      WeeklyBadgeDigest.findOne({ shop, weekIdentifier: currentWeekIdentifier }).lean(),
      WeeklyBadgeDigest.findOne({ shop, emailStatus: "sent" })
        .sort({ sentAt: -1, createdAt: -1 })
        .lean(),
    ]);

    const activeRecord = currentWeekDigest || latestSentDigest;

    if (!activeRecord) {
      return res.status(200).json({
        success: true,
        lastSentAt: null,
        currentWeekIdentifier,
        currentWeekStatus: "not_started",
        emailStatus: "pending",
        merchantEmail: shopMeta.email || null,
        latestSummary: {
          productsScanned: 0,
          recommendedBadges: 0,
          appliedBadges: 0,
          preOrderCount: 0,
          markdownCount: 0,
          clearanceCount: 0,
          bundleCount: 0,
          lowStockCount: 0,
          noBadgeCount: 0,
          cashAtRisk: 0,
          deadStockSkuCount: 0,
          stockoutWarningCount: 0,
          stockoutEarliestDate: null,
          stockoutBestSellerCount: 0,
          currencyCode: shopMeta.currencyCode || "USD",
        },
      });
    }

    return res.status(200).json({
      success: true,
      lastSentAt: activeRecord.sentAt || null,
      currentWeekIdentifier,
      currentWeekStatus: currentWeekDigest ? currentWeekDigest.emailStatus : "pending",
      emailStatus: activeRecord.emailStatus,
      merchantEmail: activeRecord.merchantEmail,
      retryCount: activeRecord.retryCount || 0,
      errorMessage: activeRecord.errorMessage || null,
      latestSummary: {
        productsScanned: activeRecord.productsScanned || 0,
        recommendedBadges: activeRecord.recommendedBadges || 0,
        appliedBadges: activeRecord.appliedBadges || 0,
        preOrderCount: activeRecord.preOrderCount || 0,
        markdownCount: activeRecord.markdownCount || 0,
        clearanceCount: activeRecord.clearanceCount || 0,
        bundleCount: activeRecord.bundleCount || 0,
        lowStockCount: activeRecord.lowStockCount || 0,
        noBadgeCount: activeRecord.noBadgeCount || 0,
        cashAtRisk: activeRecord.cashAtRisk || 0,
        deadStockSkuCount: activeRecord.deadStockSkuCount || 0,
        stockoutWarningCount: activeRecord.stockoutWarningCount || 0,
        stockoutEarliestDate: activeRecord.stockoutEarliestDate || null,
        stockoutBestSellerCount: activeRecord.stockoutBestSellerCount || 0,
        currencyCode: activeRecord.currencyCode || shopMeta.currencyCode || "USD",
      },
    });
  } catch (error) {
    console.error("[MondayDigestController] getWeeklyDigestStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve weekly digest status.",
      error: error.message,
    });
  }
}

module.exports = {
  sendWeeklyDigest,
  getWeeklyDigestStatus,
};
