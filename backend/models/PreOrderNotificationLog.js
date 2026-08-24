const mongoose = require("mongoose");

const PreOrderNotificationLogSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    orderNumber: {
      type: String,
      default: "",
    },
    emailType: {
      type: String,
      default: "DEPOSIT_CONFIRMATION",
      index: true,
    },
    paymentTransactionId: {
      type: String,
      default: "",
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    depositPercentage: {
      type: Number,
      default: 50,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "SKIPPED"],
      default: "SENT",
      index: true,
    },
    provider: {
      type: String,
      default: "smtp",
    },
    messageId: {
      type: String,
      default: "",
    },
    error: {
      type: String,
      default: "",
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring idempotency (one confirmation email per order/emailType per shop)
PreOrderNotificationLogSchema.index(
  { shop: 1, orderId: 1, emailType: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.PreOrderNotificationLog ||
  mongoose.model(
    "PreOrderNotificationLog",
    PreOrderNotificationLogSchema,
    "tbl_preorder_notification_logs"
  );
