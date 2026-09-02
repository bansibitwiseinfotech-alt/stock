const mongoose = require("mongoose");

// ==================================================
// ContactSupport Model
// Collection: tbl_contact_support
// Stores merchant support inquiries and tickets
// ==================================================

const contactSupportSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: [
        "general",
        "billing",
        "dead_stock",
        "customization",
        "pre_orders",
        "bug",
        "feature",
      ],
      default: "general",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "tbl_contact_support",
  }
);

module.exports =
  mongoose.models.ContactSupport ||
  mongoose.model("ContactSupport", contactSupportSchema, "tbl_contact_support");
