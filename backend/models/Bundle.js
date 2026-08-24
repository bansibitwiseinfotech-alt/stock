
const mongoose = require("mongoose");

const BundleSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
    },
    bundleName: {
      type: String,
      required: true,
      trim: true,
    },
    deadStockProductId: {
      type: String,
      required: true,
      index: true,
    },
    deadStockVariantId: {
      type: String,
      required: true,
      index: true,
    },
    companionProductId: {
      type: String,
      required: true,
      index: true,
    },
    companionVariantId: {
      type: String,
      default: "",
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    offerType: {
      type: String,
      default: "NO_OFFER",
    },
    freeProductId: {
      type: String,
      default: "",
    },
    freeProductVariantId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"],
      default: "ACTIVE",
      index: true,
    },
    shopifyBundleId: {
      type: String,
      default: "",
    },
    shopifyProductId: {
      type: String,
      default: "",
    },
    shopifyDiscountId: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      default: "Dead Stock Bundle",
    },
    productsCount: {
      type: Number,
      default: 2,
    },
    performance: {
      type: String,
      default: "$0",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

BundleSchema.index(
  { shop: 1, deadStockVariantId: 1, companionProductId: 1, status: 1 },
  { name: "shop_deadstock_companion_status_idx" }
);

module.exports =
  mongoose.models.Bundle ||
  mongoose.model("Bundle", BundleSchema, "tbl_bundles");