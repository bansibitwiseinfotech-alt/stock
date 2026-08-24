const Store = require("../models/Store");

async function authenticateShop(req, res, next) {
  try {
    const shop = req.query.shop || req.headers["x-shopify-shop-domain"] || req.body?.shop;
    const accessToken = req.headers["x-shopify-access-token"] || req.body?.accessToken;

    if (!shop) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated. Shop domain is required.",
      });
    }

    req.shopId = shop;

    // Save/update store access token if passed from session
    if (accessToken) {
      Store.findOneAndUpdate(
        { shop },
        { shop, accessToken, active: true },
        { upsert: true }
      ).catch(() => {});
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
}

module.exports = {
  authenticateShop,
};
