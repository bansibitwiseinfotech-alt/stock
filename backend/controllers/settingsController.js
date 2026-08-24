const mongoose = require("mongoose");
const StoreSettings = require("../models/StoreSettings");
const connectDB = require("../config/database");

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

async function getSettings(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop;
    let settings = await StoreSettings.findOne({ shopId }).lean().catch(() => null);
    if (!settings && shopId) {
      settings = await StoreSettings.create({ shopId }).catch(() => null);
    }
    return res.status(200).json({
      success: true,
      data: settings || {
        deadStockThresholdDays: 60,
        lowStockThresholdUnits: 5,
        stockoutPredictionDays: 7,
        markdownRule: "10% every 14 days",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load settings." });
  }
}

async function updateSettings(req, res) {
  try {
    await ensureConnected();

    const shopId = req.shopId || req.query.shop || req.body?.shop;
    const { deadStockThresholdDays, lowStockThresholdUnits, stockoutPredictionDays, markdownRule } = req.body;

    const updated = await StoreSettings.findOneAndUpdate(
      { shopId },
      {
        $set: {
          deadStockThresholdDays: Number(deadStockThresholdDays) || 60,
          lowStockThresholdUnits: Number(lowStockThresholdUnits) || 5,
          stockoutPredictionDays: Number(stockoutPredictionDays) || 7,
          markdownRule: markdownRule || "10% every 14 days",
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, data: updated, message: "Settings saved successfully!" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to save settings." });
  }
}

module.exports = {
  getSettings,
  updateSettings,
};
