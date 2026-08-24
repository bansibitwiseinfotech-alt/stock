const mongoose = require("mongoose");

const PreOrderSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
    },
    preOrderId: {
      type: String,
      index: true,
    },
    shopifyOrderId: {
      type: String,
      index: true,
      default: "",
    },
    orderNumber: {
      type: String,
      default: "",
      index: true,
    },
    shopifyOrderName: {
      type: String,
      default: "",
    },
    adminOrderUrl: {
      type: String,
      default: "",
    },
    customer: {
      id: { type: String, default: "" },
      name: { type: String, default: "Guest Customer" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    productId: {
      type: String,
      default: "",
    },
    variantId: {
      type: String,
      index: true,
      default: "",
    },
    productTitle: {
      type: String,
      default: "Pre-Order Item",
    },
    variantTitle: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    paymentStatus: {
      type: String,
      default: "PENDING",
    },
    financialStatus: {
      type: String,
      default: "PENDING",
    },
    fulfillmentStatus: {
      type: String,
      default: "UNFULFILLED",
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "FULFILLED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    tags: {
      type: [String],
      default: ["Pre-Order"],
    },
    lineItems: [
      {
        id: String,
        title: String,
        variantTitle: String,
        quantity: Number,
        price: Number,
        image: String,
        variantId: String,
        productId: String,
        sku: String,
      },
    ],
    paymentMethod: {
      type: String,
      default: "Credit Card / Online",
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false,
    },
    confirmationEmailSentAt: {
      type: Date,
    },
    source: {
      type: String,
      default: "shopify_order",
    },
    notes: {
      type: String,
      default: "",
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PreOrder", PreOrderSchema, "tbl_preorders");
