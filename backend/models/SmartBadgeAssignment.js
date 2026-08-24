const mongoose = require("mongoose");

const SmartBadgeAssignmentSchema = new mongoose.Schema(
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
    variantId: {
      type: String,
      trim: true,
      default: null,
    },
    badgeType: {
      type: String,
      required: true,
      enum: [
        "LOW_STOCK",
        "CLEARANCE",
        "BUNDLE",
        "PROGRESSIVE_MARKDOWN",
        "PREORDER",
        "PRE_ORDER",
        "NONE",
      ],
      index: true,
    },
    recommendationScore: {
      type: Number,
      default: 0,
    },
    confidence: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
    },
    recommendationReason: {
      type: String,
      default: "",
    },
    configurationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DISABLED", "REMOVED"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

SmartBadgeAssignmentSchema.index({ shop: 1, productId: 1 }, { unique: true });

module.exports =
  mongoose.models.SmartBadgeAssignment ||
  mongoose.model("SmartBadgeAssignment", SmartBadgeAssignmentSchema, "tbl_smart_badge_assignments");
