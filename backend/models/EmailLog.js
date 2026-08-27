const mongoose = require("mongoose");

// ==================================================
// EmailLog Model
// Collection: tbl_emaillogs
// Every email attempt (weekly digest or test) is logged here.
// ==================================================

const emailLogSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // WEEKLY_DIGEST | TEST_EMAIL
    type: {
      type: String,
      enum: ["WEEKLY_DIGEST", "TEST_EMAIL"],
      required: true,
      index: true,
    },

    // SENT | FAILED
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      required: true,
      index: true,
    },

    // SMTP message ID on success
    messageId: {
      type: String,
      default: null,
    },

    // Error message on failure
    error: {
      type: String,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    // Extra info: schedule key, digest summary etc.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "tbl_emaillogs",
  }
);

module.exports =
  mongoose.models.EmailLog ||
  mongoose.model("EmailLog", emailLogSchema, "tbl_emaillogs");
