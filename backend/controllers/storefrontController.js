const mongoose = require("mongoose");
const HighDemand = require("../models/highDemand");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const Bundle = require("../models/Bundle");
const DeadStockBundle = require("../models/DeadStockBundle");
const ClearanceSale = require("../models/ClearanceSale");
const ClearanceSaleConfig = require("../models/ClearanceSaleConfig");
const { DEFAULT_CONFIG: DEFAULT_CLEARANCE_CONFIG } = require("./customizationController");
const shopifyGraphQL = require("../services/shopifyGraphql");
const connectDB = require("../config/mongodb");

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

async function getProductWidgetData(req, res) {
  try {
    await ensureConnected();

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const shopId = req.query.shop;
    const variantId = req.query.variantId;
    const productId = req.query.productId;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Missing shop parameter." });
    }

    const settings = await StoreSettings.findOne({ shopId }).lean().catch(() => null);
    const threshold = Number(settings?.lowStockThresholdUnits) || 5;

    let item = null;
    let cleanVarId = "";
    let cleanProdId = "";
    let shopifyStock = null;
    let shopifyPrice = null;
    const store = await Store.findOne({ shop: shopId }).lean().catch(() => null);
    const accessToken = store?.accessToken || req.headers["x-shopify-access-token"];

    if (variantId) {
      const decodedId = decodeURIComponent(variantId);
      cleanVarId = decodedId.replace("gid://shopify/ProductVariant/", "");
      item = await HighDemand.findOne({
        $and: [
          { $or: [{ shopId }, { shop: shopId }] },
          {
            $or: [
              { variantId: decodedId },
              { variantId: `gid://shopify/ProductVariant/${cleanVarId}` },
              { variantId: cleanVarId },
            ],
          },
        ],
      }).lean().catch(() => null);

      const variantGid = decodedId.startsWith("gid://") ? decodedId : `gid://shopify/ProductVariant/${cleanVarId}`;
      if (accessToken) {
        try {
          const inventoryData = await shopifyGraphQL(shopId, accessToken, `query productVariantInventory($id: ID!) { productVariant(id: $id) { inventoryQuantity price product { id } } }`, {
            id: variantGid,
          });
          shopifyStock = inventoryData?.productVariant?.inventoryQuantity ?? null;
          shopifyPrice = inventoryData?.productVariant?.price ?? null;
        } catch (err) {
          console.warn("Unable to fetch Shopify inventory for storefront widget:", err.message);
        }
      }
    }

    if (productId) {
      const decodedProductId = decodeURIComponent(productId);
      cleanProdId = decodedProductId.replace("gid://shopify/Product/", "");
    }

    const Inventory = require("../models/Inventory");
    const invItem = await Inventory.findOne({
      $or: [
        { variantId: `gid://shopify/ProductVariant/${cleanVarId}` },
        { variantId: cleanVarId },
      ],
    }).lean().catch(() => null);

    const localStock = Number(invItem?.availableQuantity ?? item?.currentStock ?? item?.stock ?? 0);
    const liveStock = Number.isFinite(Number(shopifyStock)) ? Number(shopifyStock) : 0;
    const stock = Math.max(liveStock, localStock);
    const isOutOfStock = stock === 0;
    const isLowStock = stock > 0 && stock <= threshold;

    const now = new Date();
    await ClearanceSale.updateMany(
      {
        shop: shopId,
        status: "SCHEDULED",
        startDate: { $lte: now },
        endDate: { $gt: now },
      },
      { $set: { status: "ACTIVE" } }
    ).catch(() => { });

    await ClearanceSale.updateMany(
      {
        shop: shopId,
        status: { $in: ["SCHEDULED", "ACTIVE"] },
        endDate: { $lte: now },
      },
      { $set: { status: "EXPIRED" } }
    ).catch(() => { });

    const clearanceQuery = {
      shop: shopId,
      active: true,
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      startDate: { $lte: now },
      endDate: { $gt: now },
    };

    const idConditions = [];
    if (cleanVarId) {
      idConditions.push({ variantId: { $in: [cleanVarId, `gid://shopify/ProductVariant/${cleanVarId}`] } });
    }
    if (cleanProdId) {
      idConditions.push({ productId: { $in: [cleanProdId, `gid://shopify/Product/${cleanProdId}`] } });
    }

    if (idConditions.length > 0) {
      clearanceQuery.$or = idConditions;
    }

    const clearanceSale = await ClearanceSale.findOne(clearanceQuery)
      .sort({ createdAt: -1 }).lean().catch(() => null);

    const originalPrice = shopifyPrice == null
      ? clearanceSale?.originalPrice ?? null
      : Number(shopifyPrice);
    const discountPercent = Number(clearanceSale?.discountValue || 0);
    const salePrice = clearanceSale && Number.isFinite(Number(originalPrice))
      ? Number((Number(originalPrice) * (1 - discountPercent / 100)).toFixed(2))
      : null;
    const savings = salePrice == null || originalPrice == null
      ? null
      : Number((Number(originalPrice) - salePrice).toFixed(2));

    const bundleOrConditions = [];
    if (cleanVarId) {
      bundleOrConditions.push(
        { deadStockVariantId: cleanVarId },
        { deadStockVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
        { buyProductVariantId: cleanVarId },
        { "products.0.variantId": cleanVarId }
      );
    }
    if (cleanProdId) {
      bundleOrConditions.push(
        { deadStockProductId: cleanProdId },
        { deadStockProductId: `gid://shopify/Product/${cleanProdId}` },
        { buyProductId: cleanProdId },
        { "products.0.productId": cleanProdId }
      );
    }

    const [activeBundle, userClearanceConfig] = await Promise.all([
      bundleOrConditions.length > 0
        ? Bundle.findOne({
          shop: shopId,
          status: "ACTIVE",
          $or: bundleOrConditions,
        })
          .sort({ createdAt: -1 })
          .lean()
          .catch(() => null)
        : null,
      ClearanceSaleConfig.findOne({ shopId }).lean().catch(() => null),
    ]);

    const clearanceConfig = {
      ...DEFAULT_CLEARANCE_CONFIG,
      ...(userClearanceConfig || {}),
    };

    const finalDiscountPercent = Number.isFinite(Number(clearanceSale?.discountValue ?? clearanceSale?.discountPercent)) && Number(clearanceSale?.discountValue ?? clearanceSale?.discountPercent) > 0
      ? Number(clearanceSale.discountValue ?? clearanceSale.discountPercent)
      : Number(clearanceConfig?.discountPercentage ?? 10);

    const BundleConfig = require("../models/BundleConfig");
    const bundleConfigRaw = await BundleConfig.findOne({ shop: shopId }).lean().catch(() => null);
    const bundleConfig = bundleConfigRaw || { shop: shopId, enabled: true };
    const hasBundleOffer = Boolean(activeBundle) && bundleConfig.enabled !== false;
    const { resolveProductDetails, isPlaceholderText, ensureBOGODiscount } = require("../services/bundleService");

    let resolvedBundle = null;
    if (hasBundleOffer && activeBundle) {
      const meta = activeBundle.metadata || {};
      let deadStockTitle = meta.deadStockTitle;
      let companionTitle = meta.companionTitle;
      let deadStockImage = meta.deadStockImage;
      let companionImage = meta.companionImage;
      let deadStockVarId = activeBundle.deadStockVariantId || meta.deadStockVariantId;
      let companionVarId = activeBundle.companionVariantId || meta.companionVariantId;
      let origPrice = Number(meta.originalPrice || 0);

      const needsResolution =
        isPlaceholderText(deadStockTitle) ||
        isPlaceholderText(companionTitle) ||
        !deadStockImage ||
        !companionImage ||
        !deadStockVarId ||
        !companionVarId ||
        !origPrice;

      if (needsResolution) {
        const [dsInfo, compInfo] = await Promise.all([
          resolveProductDetails(shopId, accessToken, deadStockVarId || activeBundle.deadStockProductId, "ProductVariant"),
          resolveProductDetails(shopId, accessToken, companionVarId || activeBundle.companionProductId, "Product"),
        ]);

        if (isPlaceholderText(deadStockTitle)) deadStockTitle = dsInfo.title || dsInfo.variantTitle || "Product unavailable";
        if (isPlaceholderText(companionTitle)) companionTitle = compInfo.title || compInfo.variantTitle || "Product unavailable";
        if (!deadStockImage) deadStockImage = dsInfo.image || "";
        if (!companionImage) companionImage = compInfo.image || "";
        if (!deadStockVarId) deadStockVarId = dsInfo.variantId;
        if (!companionVarId) companionVarId = compInfo.variantId;

        if (!origPrice) {
          const p1 = Number(dsInfo.price || 0);
          const p2 = Number(compInfo.price || 0);
          origPrice = Number((p1 + p2).toFixed(2));
        }

        // Update database asynchronously
        Bundle.updateOne(
          { _id: activeBundle._id },
          {
            $set: {
              "metadata.deadStockTitle": deadStockTitle,
              "metadata.companionTitle": companionTitle,
              "metadata.deadStockImage": deadStockImage,
              "metadata.companionImage": companionImage,
              "metadata.deadStockVariantId": deadStockVarId,
              "metadata.companionVariantId": companionVarId,
              "metadata.originalPrice": origPrice,
              companionVariantId: companionVarId || activeBundle.companionVariantId,
            },
          }
        ).catch(() => { });
      }

      const discountPercent = Number(activeBundle.discountPercent || 0);
      const isBOGO =
        String(activeBundle.offerType || "").trim().toUpperCase() === "BOGO" ||
        String(activeBundle.metadata?.offerType || "").trim().toUpperCase() === "BOGO";
      const bPrice = isBOGO
        ? (meta.bundlePrice || meta.deadStockPrice || (origPrice > 0 ? Number((origPrice * 0.5).toFixed(2)) : 0))
        : (origPrice > 0 ? Number((origPrice * (1 - discountPercent / 100)).toFixed(2)) : 0);
      const bSavings = Math.max(0, origPrice - bPrice);

      if (isBOGO && !activeBundle.shopifyDiscountId && !meta.shopifyDiscountId) {
        ensureBOGODiscount(shopId, accessToken, activeBundle).catch(() => { });
      }

      resolvedBundle = {
        id: activeBundle._id,
        name: activeBundle.bundleName,
        bundleName: activeBundle.bundleName,
        discountPercent: activeBundle.discountPercent,
        offerType: isBOGO ? "BOGO" : "NO_OFFER",
        isBOGO: isBOGO,
        type: isBOGO ? "Bundle (BOGO)" : "Dead Stock Bundle",
        deadStockTitle: deadStockTitle || "Product unavailable",
        companionTitle: companionTitle || "Product unavailable",
        freeProductTitle: isBOGO ? (meta.freeProductTitle || companionTitle || "Free Gift") : "",
        deadStockImage: deadStockImage || "",
        companionImage: companionImage || "",
        freeProductImage: isBOGO ? (meta.freeProductImage || companionImage || "") : "",
        deadStockProductId: activeBundle.deadStockProductId || "",
        deadStockVariantId: deadStockVarId || "",
        companionProductId: activeBundle.companionProductId || "",
        companionVariantId: companionVarId || "",
        freeProductId: isBOGO ? (activeBundle.freeProductId || meta.freeProductId || "") : "",
        freeProductVariantId: isBOGO ? (activeBundle.freeProductVariantId || meta.freeProductVariantId || "") : "",
        shopifyDiscountId: isBOGO ? (activeBundle.shopifyDiscountId || meta.shopifyDiscountId || "") : "",
        deadStockPrice: meta.deadStockPrice || 0,
        companionPrice: meta.companionPrice || 0,
        originalPrice: origPrice > 0 ? origPrice : 0,
        bundlePrice: bPrice > 0 ? bPrice : 0,
        savings: bSavings > 0 ? bSavings : 0,
        shopifyVariantId: activeBundle.shopifyVariantId || "",
      };
    }

    const progressiveMarkdownService = require("../services/progressiveMarkdownService");
    const markdownData = await progressiveMarkdownService.getStorefrontMarkdownData(shopId, cleanProdId, cleanVarId).catch(() => ({ enabled: false }));

    const HighDemandStorefront = require("../models/HighDemandStorefront");
    const storefrontSetting = await HighDemandStorefront.findOne({
      shop: shopId,
      $or: [
        { variantId: `gid://shopify/ProductVariant/${cleanVarId}` },
        { variantId: cleanVarId },
        { variantId },
      ],
    }).lean().catch(() => null);

    function parseBoolean(val) {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const s = val.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "on";
      }
      if (typeof val === "number") return val === 1;
      return false;
    }

    const SmartBadgeApplication = require("../models/SmartBadgeApplication");
    const { getBadgeAssignment } = require("../services/badgeAssignment.service");
    
    const [smartApp, smartAssignment] = await Promise.all([
      cleanProdId
        ? SmartBadgeApplication.findOne({
            shop: shopId,
            productId: { $in: [cleanProdId, `gid://shopify/Product/${cleanProdId}`, String(productId)] },
            enabled: true,
          }).lean().catch(() => null)
        : null,
      cleanProdId
        ? getBadgeAssignment(shopId, cleanProdId).catch(() => null)
        : null,
    ]);

    const isSmartAssignmentActive = smartAssignment && smartAssignment.status === "ACTIVE";
    const assignedBadgeType = isSmartAssignmentActive ? smartAssignment.badgeType : null;

    const isSmartClearance = assignedBadgeType === "CLEARANCE" || (smartApp?.enabled && smartApp?.badgeType === "CLEARANCE");
    const isSmartBundle = assignedBadgeType === "BUNDLE" || (smartApp?.enabled && smartApp?.badgeType === "BUNDLE");
    const isSmartMarkdown = assignedBadgeType === "PROGRESSIVE_MARKDOWN" || (smartApp?.enabled && smartApp?.badgeType === "PROGRESSIVE_MARKDOWN");
    const isSmartLowStock = assignedBadgeType === "LOW_STOCK" || (smartApp?.enabled && smartApp?.badgeType === "LOW_STOCK");
    const isSmartPreOrder = assignedBadgeType === "PRE_ORDER" || (smartApp?.enabled && smartApp?.badgeType === "PRE_ORDER");

    const isUrgencyActive = isSmartLowStock || parseBoolean(
      storefrontSetting?.lowStockBadge?.enabled ??
      storefrontSetting?.urgencyBadgeEnabled ??
      false
    );

    const isPreOrderActive = isSmartPreOrder || parseBoolean(
      storefrontSetting?.preOrder?.enabled ??
      storefrontSetting?.preOrderEnabled ??
      false
    );

    const isNotifyMeActive = parseBoolean(
      storefrontSetting?.notifyMe?.enabled ??
      storefrontSetting?.notifyMeEnabled ??
      false
    );

    const isUrgencyShowing = isUrgencyActive && isLowStock;
    const isNotifyMeShowing = isNotifyMeActive && isOutOfStock;
    const isShieldShowing = isUrgencyShowing || isNotifyMeShowing;

    const stockoutShield = {
      enabled: isShieldShowing,
      show: isShieldShowing,
      title: "Stockout Shield",
      icon: "🛡️",
      message: isOutOfStock ? "Product is out of stock." : `Only ${stock} left in stock!`,
      subtext: !isOutOfStock && item?.daysUntilStockout ? `Selling fast — estimated ${Math.ceil(item.daysUntilStockout)} days remaining.` : "",
      buttonText: isNotifyMeShowing ? "🔔 Notify Me" : "",
      isOutOfStock: isOutOfStock,
      riskLevel: item?.riskLevel || (isOutOfStock ? "CRITICAL" : "SAFE"),
      urgencyBadgeEnabled: isUrgencyActive,
      notifyMeEnabled: isNotifyMeActive,
    };

    const hasClearanceOffer = Boolean(clearanceSale) || Boolean(isSmartClearance);
    const origPriceNum = Number(originalPrice) || 0;
    const calcSalePrice = hasClearanceOffer && origPriceNum > 0
      ? Number((origPriceNum * (1 - finalDiscountPercent / 100)).toFixed(2))
      : null;
    const calcSavings = hasClearanceOffer && origPriceNum > 0
      ? Number((origPriceNum * (finalDiscountPercent / 100)).toFixed(2))
      : null;

    const MarkdownConfig = require("../models/MarkdownConfig");
    const userMarkdownConfig = await MarkdownConfig.findOne({
      $or: [{ shop: shopId }, { shop: new RegExp(`^${shopId}$`, "i") }],
    }).lean().catch(() => null);

    let activeMarkdownData = markdownData;
    if (isSmartMarkdown && (!activeMarkdownData || !activeMarkdownData.enabled)) {
      const discountVal = 15;
      const origPrice = origPriceNum > 0 ? origPriceNum : 100;
      const curPrice = Number((origPrice * (1 - discountVal / 100)).toFixed(2));

      activeMarkdownData = {
        enabled: true,
        productId: cleanProdId,
        variantId: cleanVarId,
        originalPrice: origPrice,
        currentPrice: curPrice,
        currentDiscount: discountVal,
        label: "Progressive Markdown",
        config: {
          badgeText: userMarkdownConfig?.badgeText || "{discount}% OFF",
          showStrikethroughPrice: userMarkdownConfig?.showStrikethroughPrice !== false,
          badgeBackgroundColor: userMarkdownConfig?.badgeBackgroundColor || "#E53935",
          badgeTextColor: userMarkdownConfig?.badgeTextColor || "#FFFFFF",
          priceColor: userMarkdownConfig?.priceColor || "#111111",
          strikethroughColor: userMarkdownConfig?.strikethroughColor || "#757575",
          borderRadius: userMarkdownConfig?.borderRadius != null ? Number(userMarkdownConfig.borderRadius) : 4,
        },
      };
    }

    return res.status(200).json({
      success: true,
      shop: shopId,
      clearanceConfig,
      bundleConfig,
      variantId,
      stock,
      lowStockThreshold: threshold,
      stockoutShield,
      widget: stockoutShield,
      smartBadge: smartApp?.badgeType || null,
      urgencyBadge: {
        enabled: isUrgencyShowing || (isSmartLowStock && stock > 0),
        text: stock > 0 ? `🔥 Only ${stock} left in stock!` : "",
      },
      preOrder: {
        enabled: Boolean(isPreOrderActive),
        buttonText: "🛒 Pre-Order Now",
      },
      backInStock: {
        enabled: isNotifyMeShowing,
        show: isNotifyMeShowing,
        buttonText: "Notify Me",
      },
      notifyMe: {
        enabled: isNotifyMeActive,
        show: isNotifyMeShowing,
        buttonText: "🔔 Notify Me",
      },
      markdownConfig: userMarkdownConfig || {
        enabled: true,
        badgeText: "{discount}% OFF",
        badgeBackgroundColor: "#df2626",
        badgeTextColor: "#FFFFFF",
        borderRadius: 4,
        showStrikethroughPrice: true,
      },
      progressiveMarkdown: activeMarkdownData || { enabled: false },
      deadStockOffer: {
        hasClearance: Boolean(hasClearanceOffer),
        productId: hasClearanceOffer ? (clearanceSale?.productId || cleanProdId || null) : null,
        saleVariantId: hasClearanceOffer ? (clearanceSale?.variantId || cleanVarId || null) : null,
        discountPercent: hasClearanceOffer ? finalDiscountPercent : 0,
        badgeText: hasClearanceOffer ? `🏷️ ${finalDiscountPercent}% OFF` : "",
        originalPrice: hasClearanceOffer ? origPriceNum : null,
        salePrice: hasClearanceOffer ? calcSalePrice : null,
        savings: hasClearanceOffer ? calcSavings : null,
        startsAt: hasClearanceOffer ? (clearanceSale?.startDate || new Date()) : null,
        endsAt: hasClearanceOffer ? (clearanceSale?.endDate || new Date(Date.now() + 30 * 86400000)) : null,
        hasBundle: Boolean(hasBundleOffer || isSmartBundle),
        bundleName: (hasBundleOffer || isSmartBundle) ? (activeBundle?.bundleName || "Bundle Offer") : "",
        bundleDiscountPercent: (hasBundleOffer || isSmartBundle) ? (activeBundle?.discountPercent || 15) : 0,
        bundle: (hasBundleOffer || isSmartBundle) ? resolvedBundle : null,
      },
    });
  } catch (error) {
    console.error("Storefront Widget API Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve storefront widget data.",
    });
  }
}

/**
 * GET /api/storefront/bundles
 * Safe public endpoint for the Theme App Extension.
 */
async function getStorefrontBundles(req, res) {
  try {
    await ensureConnected();

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const shop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const productId = req.query.productId;
    const variantId = req.query.variantId;

    if (!shop) {
      return res.status(400).json({ success: false, message: "Shop domain is required." });
    }

    const store = await Store.findOne({ shop }).lean().catch(() => null);
    const accessToken = store?.accessToken || req.headers["x-shopify-access-token"];

    if (!productId && !variantId) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const cleanProdId = productId ? String(productId).replace("gid://shopify/Product/", "").trim() : "";
    const cleanVarId = variantId ? String(variantId).replace("gid://shopify/ProductVariant/", "").trim() : "";

    const matchConditions = [];
    if (cleanProdId) {
      matchConditions.push(
        { deadStockProductId: cleanProdId },
        { deadStockProductId: `gid://shopify/Product/${cleanProdId}` },
        { buyProductId: cleanProdId },
        { "products.0.productId": cleanProdId }
      );
    }
    if (cleanVarId) {
      matchConditions.push(
        { deadStockVariantId: cleanVarId },
        { deadStockVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
        { buyProductVariantId: cleanVarId },
        { "products.0.variantId": cleanVarId }
      );
    }

    if (matchConditions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const query = {
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }, { shopId: shop }],
      status: "ACTIVE",
      $and: [{ $or: matchConditions }],
    };

    const { resolveProductDetails, isPlaceholderText } = require("../services/bundleService");

    const bundles = await Bundle.find(query).sort({ createdAt: -1 }).lean();

    if (!bundles || bundles.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const safeBundles = await Promise.all(
      bundles.map(async (b) => {
        const meta = b.metadata || {};
        let deadStockTitle = meta.deadStockTitle;
        let companionTitle = meta.companionTitle;
        let deadStockImage = meta.deadStockImage;
        let companionImage = meta.companionImage;
        let finalDeadStockVariantId = b.deadStockVariantId || meta.deadStockVariantId || "";
        let finalCompanionVariantId = b.companionVariantId || meta.companionVariantId || "";
        let originalPrice = Number(meta.originalPrice || 0);

        const needsResolution =
          isPlaceholderText(deadStockTitle) ||
          isPlaceholderText(companionTitle) ||
          !deadStockImage ||
          !companionImage ||
          !finalDeadStockVariantId ||
          !finalCompanionVariantId ||
          !originalPrice;

        if (needsResolution) {
          const [dsInfo, compInfo] = await Promise.all([
            resolveProductDetails(shop, accessToken, finalDeadStockVariantId || b.deadStockProductId, "ProductVariant"),
            resolveProductDetails(shop, accessToken, finalCompanionVariantId || b.companionProductId, "Product"),
          ]);

          if (isPlaceholderText(deadStockTitle)) deadStockTitle = dsInfo.title || dsInfo.variantTitle || "Product unavailable";
          if (isPlaceholderText(companionTitle)) companionTitle = compInfo.title || compInfo.variantTitle || "Product unavailable";
          if (!deadStockImage) deadStockImage = dsInfo.image || "";
          if (!companionImage) companionImage = compInfo.image || "";
          if (!finalDeadStockVariantId) finalDeadStockVariantId = dsInfo.variantId;
          if (!finalCompanionVariantId) finalCompanionVariantId = compInfo.variantId;

          if (!originalPrice) {
            const p1 = Number(dsInfo.price || 0);
            const p2 = Number(compInfo.price || 0);
            originalPrice = Number((p1 + p2).toFixed(2));
          }

          // Update database asynchronously
          Bundle.updateOne(
            { _id: b._id },
            {
              $set: {
                "metadata.deadStockTitle": deadStockTitle,
                "metadata.companionTitle": companionTitle,
                "metadata.deadStockImage": deadStockImage,
                "metadata.companionImage": companionImage,
                "metadata.deadStockVariantId": finalDeadStockVariantId,
                "metadata.companionVariantId": finalCompanionVariantId,
                "metadata.originalPrice": originalPrice,
                companionVariantId: finalCompanionVariantId || b.companionVariantId,
              },
            }
          ).catch(() => { });
        }

        const discountPercent = Number(b.discountPercent || 0);
        const isBOGO =
          String(b.offerType || "").trim().toUpperCase() === "BOGO" ||
          String(meta.offerType || "").trim().toUpperCase() === "BOGO";

        const bundlePrice = isBOGO
          ? Number((meta.bundlePrice || meta.deadStockPrice || (originalPrice > 0 ? (originalPrice * 0.5).toFixed(2) : 0)))
          : Number(meta.bundlePrice || (originalPrice > 0 ? (originalPrice * (1 - discountPercent / 100)).toFixed(2) : 0));
        const savings = Math.max(0, originalPrice - bundlePrice);

        if (isBOGO && !b.shopifyDiscountId && !meta.shopifyDiscountId) {
          ensureBOGODiscount(shop, accessToken, b).catch(() => { });
        }

        return {
          id: b._id,
          name: b.bundleName,
          bundleName: b.bundleName,
          discountPercent: b.discountPercent,
          offerType: isBOGO ? "BOGO" : "NO_OFFER",
          isBOGO: isBOGO,
          deadStockProductId: b.deadStockProductId,
          deadStockVariantId: finalDeadStockVariantId,
          companionProductId: b.companionProductId,
          companionVariantId: finalCompanionVariantId,
          freeProductId: isBOGO ? (b.freeProductId || meta.freeProductId || "") : "",
          freeProductVariantId: isBOGO ? (b.freeProductVariantId || meta.freeProductVariantId || "") : "",
          shopifyProductId: b.shopifyProductId || "",
          shopifyVariantId: b.shopifyVariantId || "",
          shopifyBundleId: b.shopifyBundleId || b.shopifyProductId || "",
          shopifyDiscountId: isBOGO ? (b.shopifyDiscountId || meta.shopifyDiscountId || "") : "",
          type: isBOGO ? "Bundle (BOGO)" : "Dead Stock Bundle",
          deadStockTitle: deadStockTitle || "Product unavailable",
          companionTitle: companionTitle || "Product unavailable",
          freeProductTitle: isBOGO ? (meta.freeProductTitle || companionTitle || "Free Gift") : "",
          deadStockImage: deadStockImage || "",
          companionImage: companionImage || "",
          freeProductImage: isBOGO ? (meta.freeProductImage || companionImage || "") : "",
          deadStockPrice: meta.deadStockPrice || 0,
          companionPrice: meta.companionPrice || 0,
          originalPrice: originalPrice > 0 ? originalPrice.toFixed(2) : null,
          bundlePrice: bundlePrice > 0 ? bundlePrice.toFixed(2) : null,
          savings: savings > 0 ? savings.toFixed(2) : null,
        };
      })
    );

    const validBundles = safeBundles.filter((b) => {
      if (!b) return false;
      if (b.deadStockTitle === "Product unavailable" || b.companionTitle === "Product unavailable") {
        return false;
      }
      return true;
    });

    return res.status(200).json({
      success: true,
      data: validBundles,
    });
  } catch (error) {
    console.error("[StorefrontBundles] Error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve bundles." });
  }
}

/**
 * GET /api/storefront/progressive-markdown
 * Safe public endpoint for Theme App Extension / Storefront.
 */
async function getProgressiveMarkdownStorefront(req, res) {
  try {
    await ensureConnected();

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const shop = req.query.shop || req.headers["x-shopify-shop-domain"];
    const productId = req.query.productId;
    const variantId = req.query.variantId;

    if (!shop) {
      return res.status(400).json({ success: false, message: "Shop domain is required." });
    }

    const progressiveMarkdownService = require("../services/progressiveMarkdownService");
    let data = await progressiveMarkdownService.getStorefrontMarkdownData(shop, productId, variantId).catch(() => ({ enabled: false }));

    const SmartBadgeApplication = require("../models/SmartBadgeApplication");
    const cleanProdId = String(productId || "").replace(/^gid:\/\/shopify\/Product\//, "");
    const smartMarkdownApp = await SmartBadgeApplication.findOne({
      $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      productId: { $in: [productId, cleanProdId, `gid://shopify/Product/${cleanProdId}`].filter(Boolean) },
      badgeType: "PROGRESSIVE_MARKDOWN",
      enabled: true,
    }).lean().catch(() => null);

    if ((!data || !data.enabled) && smartMarkdownApp) {
      const MarkdownConfig = require("../models/MarkdownConfig");
      const userMarkdownConfig = await MarkdownConfig.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean().catch(() => null);

      const discountVal = 15;
      data = {
        enabled: true,
        productId: cleanProdId,
        variantId: variantId || "",
        currentDiscount: discountVal,
        label: "Progressive Markdown",
        config: {
          badgeText: userMarkdownConfig?.badgeText || "{discount}% OFF",
          showStrikethroughPrice: userMarkdownConfig?.showStrikethroughPrice !== false,
          badgeBackgroundColor: userMarkdownConfig?.badgeBackgroundColor || "#E53935",
          badgeTextColor: userMarkdownConfig?.badgeTextColor || "#FFFFFF",
          priceColor: userMarkdownConfig?.priceColor || "#111111",
          strikethroughColor: userMarkdownConfig?.strikethroughColor || "#757575",
          borderRadius: userMarkdownConfig?.borderRadius != null ? Number(userMarkdownConfig.borderRadius) : 4,
        },
      };
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[StorefrontMarkdown] Error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve progressive markdown." });
  }
}



/**
 * GET /api/storefront/pre-order
 * Safe public endpoint for Theme App Extension / Storefront to retrieve Launch Pre-Order settings.
 */
async function getStorefrontLaunchPreOrder(req, res) {
  try {
    await ensureConnected();

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Shop-Domain, x-shop-domain");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const rawShop = req.query.shop || req.headers["x-shopify-shop-domain"] || req.headers["x-shop-domain"] || "";
    const rawProductId = req.query.productId || "";
    const rawHandle = req.query.handle || "";
    const rawVariantId = req.query.variantId || "";

    if (!rawShop && !rawProductId && !rawHandle) {
      return res.status(200).json({ enabled: false, message: "Shop and productId/handle are required." });
    }

    const shop = String(rawShop).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const cleanProductId = String(rawProductId).replace(/^gid:\/\/shopify\/Product\//, "").trim();
    const cleanHandle = String(rawHandle).trim().toLowerCase();

    const shopQueries = [];
    if (shop) {
      shopQueries.push(
        { shop },
        { shop: new RegExp(`^${shop}$`, "i") },
        { shop: `${shop.replace(/\.myshopify\.com$/, "")}.myshopify.com` },
        { shop: shop.replace(/\.myshopify\.com$/, "") }
      );
    }

    const productOrList = [];
    if (cleanProductId) {
      productOrList.push(
        { productId: cleanProductId },
        { productId: `gid://shopify/Product/${cleanProductId}` },
        { productId: String(rawProductId).trim() }
      );
    }
    if (cleanHandle) {
      productOrList.push({ productHandle: cleanHandle });
    }
    if (rawVariantId) {
      const cleanVarId = String(rawVariantId).replace(/^gid:\/\/shopify\/ProductVariant\//, "").trim();
      productOrList.push(
        { variantId: cleanVarId },
        { variantId: `gid://shopify/ProductVariant/${cleanVarId}` }
      );
    }

    if (productOrList.length === 0) {
      return res.status(200).json({ enabled: false, message: "Product identifier required." });
    }

    const LaunchPreOrder = require("../models/LaunchPreOrder");

    const filter = {
      $or: productOrList,
    };

    if (shopQueries.length > 0) {
      filter.$and = [{ $or: shopQueries }];
    }

    let config = await LaunchPreOrder.findOne(filter).lean().catch(() => null);

    const SmartBadgeApplication = require("../models/SmartBadgeApplication");
    const smartPreOrderApp = await SmartBadgeApplication.findOne({
      ...(shopQueries.length > 0 ? { $or: shopQueries } : { shop }),
      productId: { $in: [cleanProductId, `gid://shopify/Product/${cleanProductId}`, String(rawProductId).trim()].filter(Boolean) },
      badgeType: "PRE_ORDER",
      enabled: true,
    }).lean().catch(() => null);

    if (!config && smartPreOrderApp) {
      config = {
        preOrderEnabled: true,
        productId: cleanProductId,
        launchDate: new Date(Date.now() + 30 * 86400000),
        badgeText: "🛒 PRE-ORDER",
        launchLabel: "PRE-ORDER",
        buttonText: "PRE-ORDER NOW",
        customerMessage: "Reserve yours now — ships soon.",
        depositEnabled: false,
      };
    }

    if (!config || !config.preOrderEnabled) {
      return res.status(200).json({ enabled: false });
    }

    const now = new Date();
    const launchDate = new Date(config.launchDate);
    const opensAt = config.preOrderOpensAt ? new Date(config.preOrderOpensAt) : null;

    // End of day allowance for launch date
    if (!isNaN(launchDate.getTime())) {
      if (launchDate.getUTCHours() === 0 && launchDate.getUTCMinutes() === 0 && launchDate.getUTCSeconds() === 0) {
        launchDate.setUTCHours(23, 59, 59, 999);
      }
    }

    // Condition 1: Must not have passed launch date
    if (isNaN(launchDate.getTime()) || now > launchDate) {
      return res.status(200).json({ enabled: false, reason: "Launch date passed" });
    }

    // Condition 2: If opensAt specified, now must be >= opensAt
    if (opensAt && !isNaN(opensAt.getTime()) && now < opensAt) {
      return res.status(200).json({ enabled: false, reason: "Pre-order not yet open" });
    }

    const PreOrderConfig = require("../models/PreOrderConfig");
    const globalPreOrderConfig = await PreOrderConfig.findOne({
      $or: shopQueries.length > 0 ? shopQueries : [{ shop }],
    }).lean().catch(() => null);

    if (globalPreOrderConfig && globalPreOrderConfig.enabled === false && !smartPreOrderApp) {
      return res.status(200).json({ enabled: false, reason: "Pre-order globally disabled" });
    }

    return res.status(200).json({
      enabled: true,
      productId: config.productId || cleanProductId,
      productTitle: config.productTitle || "",
      productHandle: config.productHandle || "",
      preOrderOpensAt: config.preOrderOpensAt || null,
      launchDate: config.launchDate,
      shippingDate: config.shippingDate || null,
      badgeText: globalPreOrderConfig?.badgeText || config.badgeText || "🛒 PRE-ORDER",
      launchLabel: globalPreOrderConfig?.launchLabel || config.launchLabel || "NEW LAUNCH",
      launchTitle: config.launchTitle || "New Product Launch",
      customerMessage: config.customerMessage || "",
      launchDetails: config.launchDetails || "",
      buttonText: globalPreOrderConfig?.buttonText || config.buttonText || "PRE-ORDER NOW",
      depositPercentage: typeof config.depositPercentage === "number" ? config.depositPercentage : 50,
      depositEnabled: config.depositEnabled !== false,
      cardBackgroundColor: globalPreOrderConfig?.cardBackgroundColor || config.cardBackgroundColor || "#FFFFFF",
      borderColor: globalPreOrderConfig?.borderColor || config.borderColor || "#E2E8F0",
      textColor: globalPreOrderConfig?.textColor || config.textColor || "#111827",
      accentColor: globalPreOrderConfig?.accentColor || config.accentColor || "#4F46E5",
      badgeBackgroundColor: globalPreOrderConfig?.badgeBackgroundColor || config.badgeBackgroundColor || "#0F172A",
      badgeTextColor: globalPreOrderConfig?.badgeTextColor || config.badgeTextColor || "#FFFFFF",
      borderRadius: globalPreOrderConfig?.borderRadius ?? 12,
    });
  } catch (error) {
    console.error("Storefront Launch PreOrder Error:", error);
    return res.status(200).json({ enabled: false, error: "Internal error" });
  }
}

/**
 * Direct Storefront Assigned Badge Query
 */
async function getStorefrontBadge(req, res) {
  try {
    await ensureConnected();
    const { getStorefrontProductBadge } = require("../services/storefrontBadge.service");

    const shop = req.query.shop;
    const productId = req.query.productId;
    const variantId = req.query.variantId;

    if (!shop || !productId) {
      return res.status(200).json({ enabled: false });
    }

    const badgeData = await getStorefrontProductBadge({ shop, productId, variantId });
    if (!badgeData) {
      return res.status(200).json({ enabled: false });
    }

    return res.status(200).json({
      enabled: true,
      ...badgeData,
    });
  } catch (error) {
    console.error("Storefront Badge Error:", error);
    return res.status(200).json({ enabled: false });
  }
}

module.exports = {
  getProductWidgetData,
  getStorefrontBundles,
  getProgressiveMarkdownStorefront,
  getStorefrontLaunchPreOrder,
  getStorefrontBadge,
};



