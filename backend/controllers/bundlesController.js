const Bundle = require("../models/Bundle");
const DeadStockBundle = require("../models/DeadStockBundle");

async function getBundles(req, res) {
  try {
    const shop = req.shopId || req.query.shop;

    const [legacyItems, bogoItems] = await Promise.all([
      Bundle.find({
        $or: [{ shop }, { shopId: shop }],
      })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []),
      DeadStockBundle.find({
        shop,
      })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []),
    ]);

    const formattedLegacy = legacyItems.map((item) => ({
      _id: item._id,
      name: item.bundleName || item.name || "Discount Bundle",
      type: item.type || "Dead Stock Bundle",
      productsCount: item.productsCount || 2,
      discountPercentage:
        item.discountPercent != null ? item.discountPercent : item.discountPercentage || 0,
      status: item.status === "ACTIVE" ? "Active" : item.status,
      performance: item.performance || "$0",
      createdAt: item.createdAt,
    }));

    const formattedBogo = bogoItems.map((item) => ({
      _id: item._id,
      name: item.bundleName || "Dead Stock BOGO Bundle",
      type: "Dead Stock BOGO",
      productsCount: item.products?.length || 2,
      discountPercentage: 100,
      status: item.status === "ACTIVE" ? "Active" : item.status === "DRAFT" ? "Draft" : item.status,
      performance: "$0",
      createdAt: item.createdAt,
      products: item.products,
      buyProductId: item.buyProductId,
      getProductIds: item.getProductIds,
      isBogo: true,
    }));

    const combined = [...formattedBogo, ...formattedLegacy].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({ success: true, data: combined });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load bundles." });
  }
}

async function createBundle(req, res) {
  try {
    const shop = req.shopId || req.query.shop || req.body?.shop;
    const { name, type, productsCount, discountPercentage } = req.body;

    const bundle = await Bundle.create({
      shop,
      bundleName: name || "New Discount Bundle",
      deadStockProductId: "N/A",
      deadStockVariantId: "N/A",
      companionProductId: "N/A",
      type: type || "Bundle (BOGO)",
      productsCount: productsCount || 2,
      discountPercent: discountPercentage || 20,
      status: "ACTIVE",
      performance: "$0",
    });

    return res.status(201).json({ success: true, data: bundle });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to create bundle." });
  }
}

module.exports = {
  getBundles,
  createBundle,
};
