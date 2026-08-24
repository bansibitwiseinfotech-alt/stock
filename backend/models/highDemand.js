const mongoose = require("mongoose");

const highDemandSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    productId: {
      type: String,
      required: true,
    },

    variantId: {
      type: String,
      required: true,
    },

    productName: {
      type: String,
      default: "",
    },

    variantTitle: {
      type: String,
      default: "",
    },

    sku: {
      type: String,
      default: "",
    },

    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    last30DaysSales: {
      type: Number,
      default: 0,
      min: 0,
    },

    salesVelocity: {
      type: Number,
      default: 0,
      min: 0,
    },

    daysUntilStockout: {
      type: Number,
      default: null,
    },

    riskLevel: {
      type: String,
      enum: ["SAFE", "MEDIUM", "HIGH", "CRITICAL"],
      default: "SAFE",
    },

    recommendedAction: {
      type: String,
      default: "NO_ACTION",
    },

    actionLabel: {
      type: String,
      default: "✅ No Action",
    },

    actionPriority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },

    actionMessage: {
      type: String,
      default: "",
    },

    reorderQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    targetCoverageDays: {
      type: Number,
      default: 30,
      min: 1,
    },

    urgencyBadgeEnabled: {
      type: Boolean,
      default: false,
    },

    preOrderEnabled: {
      type: Boolean,
      default: false,
    },

    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

highDemandSchema.index(
  { shop: 1, variantId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.HighDemand ||
  mongoose.model(
    "HighDemand",
    highDemandSchema,
    "tbl_highdemands"
  );