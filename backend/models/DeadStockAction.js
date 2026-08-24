const mongoose = require("mongoose");

const deadStockActionSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    variantId: {
      type: String,
      default: "",
    },
    actionType: {
      type: String,
      enum: ["CLEARANCE", "CLEARANCE_SALE_CREATED", "BUNDLE", "PROGRESSIVE_MARKDOWN", "CLEARANCE_COLLECTION"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SCHEDULED", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    shopifyDiscountId: {
      type: String,
      default: "",
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    error: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

deadStockActionSchema.index({ shop: 1, productId: 1, actionType: 1 });

module.exports = mongoose.model("DeadStockAction", deadStockActionSchema, "tbl_deadstockactions");
