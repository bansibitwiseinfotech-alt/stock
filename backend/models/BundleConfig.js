const mongoose = require("mongoose");

const BundleConfigSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    headerTitle: { type: String, default: "Frequently Bought Together" },
    buttonText: { type: String, default: "Add Both to Cart" },
    showDiscountBadge: { type: Boolean, default: true },
    badgeColor: { type: String, default: "#DCFCE7" },
    badgeTextColor: { type: String, default: "#15803D" },
    buttonColor: { type: String, default: "#111827" },
    buttonTextColor: { type: String, default: "#FFFFFF" },
    borderRadius: { type: Number, default: 12 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BundleConfig ||
  mongoose.model("BundleConfig", BundleConfigSchema, "tbl_bundleconfigs");
