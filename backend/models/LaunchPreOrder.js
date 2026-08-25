const mongoose = require("mongoose");

const LaunchPreOrderSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    productTitle: {
      type: String,
      default: "",
    },
    productHandle: {
      type: String,
      default: "",
    },
    productImage: {
      type: String,
      default: "",
    },
    preOrderEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    preOrderOpensAt: {
      type: Date,
      default: null,
    },
    launchDate: {
      type: Date,
      required: true,
      index: true,
    },
    shippingDate: {
      type: Date,
      default: null,
    },
    badgeText: {
      type: String,
      default: "🛒 PRE-ORDER",
      trim: true,
    },
    launchLabel: {
      type: String,
      default: "NEW LAUNCH",
      trim: true,
    },
    launchTitle: {
      type: String,
      default: "New Product Launch",
      trim: true,
    },
    customerMessage: {
      type: String,
      default: "Be the first to get the new product.",
      trim: true,
    },
    launchDetails: {
      type: String,
      default: "",
      trim: true,
    },
    buttonText: {
      type: String,
      default: "PRE-ORDER NOW",
      trim: true,
    },
    depositPercentage: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    depositEnabled: {
      type: Boolean,
      default: true,
    },
    cardBackgroundColor: {
      type: String,
      default: "#FFFFFF",
    },
    textColor: {
      type: String,
      default: "#111827",
    },
    accentColor: {
      type: String,
      default: "#4F46E5",
    },
    borderColor: {
      type: String,
      default: "#E2E8F0",
    },
    badgeBackgroundColor: {
      type: String,
      default: "#0F172A",
    },
    badgeTextColor: {
      type: String,
      default: "#FFFFFF",
    },
    shopifyDiscountId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring multi-merchant isolation
LaunchPreOrderSchema.index({ shop: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model(
  "LaunchPreOrder",
  LaunchPreOrderSchema,
  "tbl_launch_preorders"
);
