const mongoose = require("mongoose");

const highDemandReorderSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    productId: {
      type: String,
      default: "",
    },

    variantId: {
      type: String,
      required: true,
      index: true,
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

    salesVelocity: {
      type: Number,
      default: 0,
      min: 0,
    },

    daysUntilStockout: {
      type: Number,
      default: null,
      min: 0,
    },

    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
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

    reason: {
      type: String,
      default: "HIGH_DEMAND_STOCKOUT_RISK",
    },

    riskLevel: {
      type: String,
      enum: ["SAFE", "MEDIUM", "HIGH", "CRITICAL"],
      default: "CRITICAL",
    },

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

highDemandReorderSchema.index({
  shop: 1,
  status: 1,
  createdAt: -1,
});

highDemandReorderSchema.index({
  shop: 1,
  variantId: 1,
});

module.exports =
  mongoose.models.HighDemandReorder ||
  mongoose.model(
    "HighDemandReorder",
    highDemandReorderSchema,
    "tbl_high_demand_reorders"
  );