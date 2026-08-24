const mongoose = require("mongoose");

const SmartBadgeApplicationSchema = new mongoose.Schema(
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
    badgeType: {
      type: String,
      required: true,
      enum: [
        "CLEARANCE",
        "BUNDLE",
        "PROGRESSIVE_MARKDOWN",
        "LOW_STOCK",
        "PRE_ORDER",
        "NONE",
      ],
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast queries and uniqueness per shop + product + badge
SmartBadgeApplicationSchema.index(
  { shop: 1, productId: 1, badgeType: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.SmartBadgeApplication ||
  mongoose.model(
    "SmartBadgeApplication",
    SmartBadgeApplicationSchema,
    "tbl_smart_badge_applications"
  );
