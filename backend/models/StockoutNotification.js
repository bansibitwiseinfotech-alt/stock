const mongoose = require("mongoose");

const stockoutNotificationSchema = new mongoose.Schema(
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
      default: "",
      trim: true,
      index: true,
    },
    variantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    productHandle: {
      type: String,
      default: "",
      trim: true,
    },
    productTitle: {
      type: String,
      default: "",
      trim: true,
    },
    variantTitle: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "NOTIFIED",
        "CANCELLED",
        "pending",
        "processing",
        "notified",
        "cancelled",
      ],
      default: "PENDING",
      index: true,
      set: (v) => (v ? String(v).toUpperCase() : "PENDING"),
    },
    confirmationSentAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "tbl_high_demand_notifications",
  }
);

stockoutNotificationSchema.index(
  { shop: 1, variantId: 1, email: 1 },
  { unique: true }
);

stockoutNotificationSchema.index(
  { shop: 1, status: 1, variantId: 1 }
);

module.exports =
  mongoose.models.StockoutNotification ||
  mongoose.model("StockoutNotification", stockoutNotificationSchema);
