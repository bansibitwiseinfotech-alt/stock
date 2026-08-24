const mongoose = require("mongoose");

const StoreBadgeSettingsSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    lowStock: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 5 },
      badgeText: { type: String, default: "🔥 Only {stock} left!" },
      backgroundColor: { type: String, default: "#FFF1F2" },
      borderColor: { type: String, default: "#FECDD3" },
      textColor: { type: String, default: "#991B1B" },
      subtextColor: { type: String, default: "#B91C1C" },
    },

    clearance: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: "PERCENTAGE", enum: ["PERCENTAGE", "FIXED"] },
      discountValue: { type: Number, default: 20 },
      badgeText: { type: String, default: "🏷️ {discount}% OFF" },
      applyToStorefront: { type: Boolean, default: true },
    },

    bundle: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: "PERCENTAGE", enum: ["PERCENTAGE", "FIXED"] },
      discountValue: { type: Number, default: 15 },
      badgeText: { type: String, default: "📦 Bundle & Save {discount}%" },
      headerTitle: { type: String, default: "Frequently Bought Together" },
      buttonText: { type: String, default: "Add Both to Cart" },
    },

    progressiveMarkdown: {
      enabled: { type: Boolean, default: true },
      startingDiscount: { type: Number, default: 10 },
      increasePercent: { type: Number, default: 5 },
      decreasePercent: { type: Number, default: 5 },
      minimumDiscount: { type: Number, default: 5 },
      maximumDiscount: { type: Number, default: 50 },
      evaluationIntervalHours: { type: Number, default: 24 },
      badgeText: { type: String, default: "{discount}% OFF" },
      badgeBackgroundColor: { type: String, default: "#E53935" },
      badgeTextColor: { type: String, default: "#FFFFFF" },
    },

    preorder: {
      enabled: { type: Boolean, default: true },
      depositPercentage: { type: Number, default: 50 },
      launchDate: { type: Date, default: null },
      badgeText: { type: String, default: "🛒 PRE-ORDER" },
      buttonText: { type: String, default: "PRE-ORDER NOW" },
      launchLabel: { type: String, default: "NEW LAUNCH" },
      accentColor: { type: String, default: "#4F46E5" },
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.StoreBadgeSettings ||
  mongoose.model("StoreBadgeSettings", StoreBadgeSettingsSchema, "tbl_store_badge_settings");
