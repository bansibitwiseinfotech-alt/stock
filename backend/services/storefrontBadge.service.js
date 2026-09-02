const { getBadgeAssignment } = require("./badgeAssignment.service");
const { getStoreBadgeSettings, normalizeShop } = require("./badgeConfiguration.service");
const { BADGES } = require("./smartBadgeRecommendationService");

/**
 * Resolve product-specific storefront badge configuration
 */
async function getStorefrontProductBadge({ shop, productId, variantId = null }) {
  const cleanShop = normalizeShop(shop);
  if (!cleanShop || !productId) return null;

  // 1. Check for specific active product assignment
  const assignment = await getBadgeAssignment(cleanShop, productId);

  if (!assignment || assignment.status !== "ACTIVE" || assignment.badgeType === BADGES.NONE) {
    // 1b. Check if active LaunchPreOrder exists for this product
    try {
      const LaunchPreOrder = require("../models/LaunchPreOrder");
      const cleanProdId = String(productId).replace(/^gid:\/\/shopify\/Product\//, "").trim();
      const lpo = await LaunchPreOrder.findOne({
        shop: cleanShop,
        productId: { $in: [cleanProdId, `gid://shopify/Product/${cleanProdId}`] },
        preOrderEnabled: true,
      }).lean();

      if (lpo) {
        return {
          badgeType: BADGES.PRE_ORDER,
          badgeText: lpo.badgeText || "🛒 PRE-ORDER",
          launchLabel: lpo.launchLabel || "NEW LAUNCH",
          buttonText: lpo.buttonText || "PRE-ORDER NOW",
          depositPercentage: typeof lpo.depositPercentage === "number" ? lpo.depositPercentage : 50,
          backgroundColor: lpo.badgeBackgroundColor || "#0F172A",
          textColor: lpo.badgeTextColor || "#FFFFFF",
          accentColor: lpo.accentColor || "#4F46E5",
          showStrikethrough: false,
        };
      }
    } catch (_) {}

    return null;
  }

  const badgeType = assignment.badgeType;
  const snapshot = assignment.configurationSnapshot || {};

  // 2. Load store settings as baseline
  const storeSettings = await getStoreBadgeSettings(cleanShop);

  let badgeData = {
    badgeType,
    badgeText: "",
    discountPercent: 0,
    depositPercentage: 0,
    threshold: 0,
    backgroundColor: "#df2626",
    textColor: "#FFFFFF",
    showStrikethrough: true,
  };

  switch (badgeType) {
    case BADGES.CLEARANCE: {
      const discount = snapshot.discountValue ?? storeSettings.clearance?.discountValue ?? 20;
      const rawText = snapshot.badgeText || storeSettings.clearance?.badgeText || "🏷️ {discount}% OFF";
      badgeData.discountPercent = Number(discount);
      badgeData.badgeText = rawText.replace(/\{discount\}/g, String(discount));
      badgeData.backgroundColor = "#D97706";
      badgeData.textColor = "#FFFFFF";
      break;
    }

    case BADGES.PROGRESSIVE_MARKDOWN: {
      const discount = snapshot.startingDiscount ?? storeSettings.progressiveMarkdown?.startingDiscount ?? 10;
      const rawText = snapshot.badgeText || storeSettings.progressiveMarkdown?.badgeText || "{discount}% OFF";
      badgeData.discountPercent = Number(discount);
      badgeData.badgeText = rawText.replace(/\{discount\}/g, String(discount));
      badgeData.backgroundColor = snapshot.badgeBackgroundColor || storeSettings.progressiveMarkdown?.badgeBackgroundColor || "#E53935";
      badgeData.textColor = snapshot.badgeTextColor || storeSettings.progressiveMarkdown?.badgeTextColor || "#FFFFFF";
      break;
    }

    case BADGES.PRE_ORDER:
    case "PREORDER": {
      const deposit = snapshot.depositPercentage ?? storeSettings.preorder?.depositPercentage ?? 50;
      badgeData.depositPercentage = Number(deposit);
      badgeData.badgeText = snapshot.badgeText || storeSettings.preorder?.badgeText || "🛒 PRE-ORDER";
      badgeData.buttonText = snapshot.buttonText || storeSettings.preorder?.buttonText || "PRE-ORDER NOW";
      badgeData.backgroundColor = "#059669";
      badgeData.textColor = "#FFFFFF";
      badgeData.showStrikethrough = false;
      break;
    }

    case BADGES.LOW_STOCK: {
      const threshold = snapshot.threshold ?? storeSettings.lowStock?.threshold ?? 5;
      badgeData.threshold = Number(threshold);
      badgeData.badgeText = snapshot.badgeText || storeSettings.lowStock?.badgeText || "🔥 Low Stock";
      badgeData.backgroundColor = snapshot.backgroundColor || storeSettings.lowStock?.backgroundColor || "#DC2626";
      badgeData.textColor = snapshot.textColor || storeSettings.lowStock?.textColor || "#FFFFFF";
      badgeData.showStrikethrough = false;
      break;
    }

    case BADGES.BUNDLE: {
      const discount = snapshot.discountValue ?? storeSettings.bundle?.discountValue ?? 15;
      const rawText = snapshot.badgeText || storeSettings.bundle?.badgeText || "📦 Bundle & Save {discount}%";
      badgeData.discountPercent = Number(discount);
      badgeData.badgeText = rawText.replace(/\{discount\}/g, String(discount));
      badgeData.backgroundColor = "#2563EB";
      badgeData.textColor = "#FFFFFF";
      break;
    }

    default:
      return null;
  }

  return badgeData;
}

module.exports = {
  getStorefrontProductBadge,
};
