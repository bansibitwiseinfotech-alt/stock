const mongoose = require("mongoose");

const WeeklyBadgeDigestSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    merchantEmail: {
      type: String,
      required: true,
      trim: true,
    },
    weekIdentifier: {
      type: String,
      required: true,
      trim: true,
    },

    // Metrics
    productsScanned: {
      type: Number,
      default: 0,
    },
    recommendedBadges: {
      type: Number,
      default: 0,
    },
    appliedBadges: {
      type: Number,
      default: 0,
    },

    // Breakdown
    preOrderCount: {
      type: Number,
      default: 0,
    },
    markdownCount: {
      type: Number,
      default: 0,
    },
    clearanceCount: {
      type: Number,
      default: 0,
    },
    bundleCount: {
      type: Number,
      default: 0,
    },
    lowStockCount: {
      type: Number,
      default: 0,
    },
    noBadgeCount: {
      type: Number,
      default: 0,
    },

    // Inventory Pulse Real Snapshot
    cashAtRisk: {
      type: Number,
      default: 0,
    },
    deadStockSkuCount: {
      type: Number,
      default: 0,
    },
    stockoutWarningCount: {
      type: Number,
      default: 0,
    },
    stockoutEarliestDate: {
      type: String,
      default: null,
    },
    stockoutBestSellerCount: {
      type: Number,
      default: 0,
    },
    currencyCode: {
      type: String,
      default: "USD",
    },

    // Status & Tracking
    emailStatus: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    storeTimezone: {
      type: String,
      default: "UTC",
    },
    adminUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for strict duplicate email protection per store per week
WeeklyBadgeDigestSchema.index({ shop: 1, weekIdentifier: 1 }, { unique: true });

module.exports = mongoose.model(
  "WeeklyBadgeDigest",
  WeeklyBadgeDigestSchema,
  "tbl_weekly_badge_digests"
);
