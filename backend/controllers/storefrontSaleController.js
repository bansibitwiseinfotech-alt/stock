const StorefrontSaleSettings = require("../models/StorefrontSaleSettings");

const allowedSaleFields = [
  "enabled",
  "title",
  "discountPercentage",
  "limitedTimeText",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "textColor",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "buttonText",
  "buttonTextColor",
  "buttonBackgroundColor",
  "customCss",
];

function buildUpdateObject(body = {}, fields = allowedSaleFields) {
  const updateData = {};

  fields.forEach((field) => {
    if (body[field] !== undefined && body[field] !== null) {
      updateData[field] = body[field];
    }
  });

  return updateData;
}

// ============================================
// GET SALE SETTINGS
// ============================================
const getSaleSettings = async (req, res) => {
  try {
    const shop = req.shopId || req.query.shop || req.body?.shop;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    let settings = await StorefrontSaleSettings.findOne({ shop }).lean();

    if (!settings) {
      settings = await StorefrontSaleSettings.create({ shop });
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get Sale Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sale settings",
      error: error.message,
    });
  }
};

// ============================================
// CREATE / UPDATE SALE SETTINGS
// ============================================
const saveSaleSettings = async (req, res) => {
  try {
    const shop = req.shopId || req.body?.shop || req.query?.shop;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const updateData = buildUpdateObject(req.body);

    const settings = await StorefrontSaleSettings.findOneAndUpdate(
      { shop },
      { $set: updateData },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Clearance Sale settings saved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Save Sale Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save sale settings",
      error: error.message,
    });
  }
};

// ============================================
// UPDATE SALE SETTINGS
// ============================================
const updateSaleSettings = async (req, res) => {
  try {
    const shop = req.shopId || req.query?.shop || req.body?.shop;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const updateData = buildUpdateObject(req.body);

    const settings = await StorefrontSaleSettings.findOneAndUpdate(
      { shop },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sale settings not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sale settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Update Sale Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update sale settings",
      error: error.message,
    });
  }
};

// ============================================
// DELETE SALE SETTINGS
// ============================================
const deleteSaleSettings = async (req, res) => {
  try {
    const shop = req.shopId || req.query?.shop || req.body?.shop;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const deleted = await StorefrontSaleSettings.findOneAndDelete({
      shop,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Sale settings not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sale settings deleted successfully",
    });
  } catch (error) {
    console.error("Delete Sale Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sale settings",
      error: error.message,
    });
  }
};

module.exports = {
  getSaleSettings,
  saveSaleSettings,
  updateSaleSettings,
  deleteSaleSettings,
};