const mongoose = require("mongoose");

const clearanceSaleConfigSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    badgeTitle: { type: String, default: "Clearance Sale" },
    supportingText: { type: String, default: "Limited time offer" },
    limitedTimeText: { type: String, default: "Limited time offer" },
    discountPercentage: { type: Number, min: 0, max: 100, default: 10 },
    showIcon: { type: Boolean, default: true },
    showSupportingText: { type: Boolean, default: true },
    showSavings: { type: Boolean, default: true },
    showPrice: { type: Boolean, default: true },
    layout: { type: String, enum: ["horizontal", "stacked"], default: "horizontal" },
    alignment: { type: String, enum: ["left", "center", "right"], default: "left" },
    backgroundColor: { type: String, default: "#FFF1F2" },
    textColor: { type: String, default: "#991B1B" },
    accentColor: { type: String, default: "#DC2626" },
    borderColor: { type: String, default: "#FECACA" },
    borderRadius: { type: Number, default: 8 },
    paddingTop: { type: Number, default: 14 },
    paddingBottom: { type: Number, default: 14 },
    paddingLeft: { type: Number, default: 16 },
    paddingRight: { type: Number, default: 16 },
    fontFamily: { type: String, default: "Arial" },
    fontSize: { type: String, default: "13px" },
    fontWeight: { type: String, default: "600" },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ClearanceSaleConfig",
  clearanceSaleConfigSchema,
  "tbl_clearancesaleconfigs"
);
