const mongoose = require("mongoose");

const SmartBadgeRecommendationSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    summary: {
      productsScanned: { type: Number, default: 0 },
      recommendations: { type: Number, default: 0 },
      applied: { type: Number, default: 0 },
      badges: {
        LOW_STOCK: { type: Number, default: 0 },
        CLEARANCE: { type: Number, default: 0 },
        BUNDLE: { type: Number, default: 0 },
        PROGRESSIVE_MARKDOWN: { type: Number, default: 0 },
        PRE_ORDER: { type: Number, default: 0 },
        NONE: { type: Number, default: 0 },
      },
    },
    products: [
      {
        productId: { type: String, required: true },
        title: { type: String, default: "" },
        handle: { type: String, default: "" },
        image: { type: String, default: null },
        sku: { type: String, default: "" },
        inventory: { type: Number, default: 0 },
        unitsSold30d: { type: Number, default: 0 },
        salesVelocity: { type: Number, default: 0 },
        daysSinceLastSale: { type: Number, default: null },
        daysUntilStockout: { type: Number, default: null },
        stockRisk: { type: String, default: "SAFE" },
        suggestedBadge: { type: String, default: "NONE" },
        score: { type: Number, default: 0 },
        confidence: { type: String, default: "MEDIUM" },
        reason: { type: String, default: "" },
        active: { type: Boolean, default: false },
        recommendation: {
          badge: { type: String, default: "NONE" },
          score: { type: Number, default: 0 },
          confidence: { type: String, default: "MEDIUM" },
          reason: { type: String, default: "" },
        },
        appliedBadge: { type: String, default: null },
        isApplied: { type: Boolean, default: false },
        alternatives: { type: Array, default: [] },
      },
    ],
  },
  {
    timestamps: true,
  }
);

SmartBadgeRecommendationSchema.index({ shop: 1, scannedAt: -1 });

module.exports =
  mongoose.models.SmartBadgeRecommendation ||
  mongoose.model("SmartBadgeRecommendation", SmartBadgeRecommendationSchema, "tbl_smart_badge_recommendations");
