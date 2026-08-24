const mongoose = require("mongoose");

const clearanceSaleSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, index: true },
    collectionId: { type: String, default: "", index: true },
    collectionTitle: { type: String, default: "" },
    productId: { type: String, required: true, index: true },
    productTitle: { type: String, default: "" },
    variantId: { type: String, required: true, index: true },
    shopifyDiscountId: { type: String, default: "" },
    discountType: { type: String, enum: ["PERCENTAGE"], default: "PERCENTAGE" },
    discountValue: { type: Number, required: true, min: 0, max: 100 },
    discountPercent: { type: Number, default: null },
    originalPrice: { type: Number, default: null },
    salePrice: { type: Number, default: null },
    savings: { type: Number, default: null },
    startDate: { type: Date, default: null, index: true },
    endDate: { type: Date, default: null, index: true },
    active: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "ACTIVE", "EXPIRED", "CANCELLED", "FAILED"],
      required: true,
      default: "SCHEDULED",
      index: true,
    },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

clearanceSaleSchema.path("shopifyDiscountId").validate(function (value) {
  return this.status === "FAILED" || Boolean(value);
}, "A Shopify discount ID is required unless the sale failed.");

clearanceSaleSchema.path("discountValue").validate(function (value) {
  return this.status === "FAILED" || value > 0;
}, "A positive discount value is required unless the sale failed.");

clearanceSaleSchema.path("startDate").validate(function (value) {
  return this.status === "FAILED" || Boolean(value);
}, "A start date is required unless the sale failed.");

clearanceSaleSchema.path("endDate").validate(function (value) {
  return this.status === "FAILED" || Boolean(value);
}, "An end date is required unless the sale failed.");

clearanceSaleSchema.index({ shop: 1, variantId: 1, status: 1 });
clearanceSaleSchema.index({ shop: 1, productId: 1, status: 1 });
clearanceSaleSchema.index(
  { shop: 1, variantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    },
  }
);
clearanceSaleSchema.index(
  { shop: 1, productId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    },
  }
);

module.exports = mongoose.model("ClearanceSale", clearanceSaleSchema, "tbl_clearancesales");
