const mongoose = require("mongoose");

const storeSettingsSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, unique: true, index: true },
    deadStockThresholdDays: { type: Number, default: 60 },
    lowStockThresholdUnits: { type: Number, default: 5 },
    stockoutPredictionDays: { type: Number, default: 7 },
    markdownRule: { type: String, default: "10% every 14 days" },
    totalCashRecovered: { type: Number, default: 14250 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoreSettings", storeSettingsSchema, "tbl_storesettings");
