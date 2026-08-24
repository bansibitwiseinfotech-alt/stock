const deadStockBundleService = require("../services/deadStockBundleService");

/**
 * Helper to resolve shop domain and access token from request context.
 */
function resolveRequestContext(req) {
  const shop =
    req.body?.shop ||
    req.query?.shop ||
    req.headers["x-shopify-shop-domain"] ||
    req.shopId ||
    "";

  const rawAuthHeader = req.headers["authorization"] || "";
  const bearerToken = rawAuthHeader.startsWith("Bearer ")
    ? rawAuthHeader.slice(7).trim()
    : null;

  const accessToken =
    req.headers["x-shopify-access-token"] ||
    req.body?.accessToken ||
    bearerToken ||
    null;

  return {
    shop: String(shop).trim(),
    accessToken,
  };
}

/**
 * POST /api/dead-stock/bundles/create
 * Creates a new Dead Stock BOGO Bundle.
 */
async function createBundle(req, res) {
  try {
    const { shop, accessToken } = resolveRequestContext(req);
    const payload = {
      ...req.body,
      shop: req.body?.shop || shop,
    };

    const result = await deadStockBundleService.createDeadStockBundle(
      payload,
      accessToken
    );

    return res.status(result.statusCode || (result.success ? 201 : 400)).json({
      success: result.success,
      message: result.message,
      ...(result.data ? { data: result.data } : {}),
    });
  } catch (error) {
    console.error("[DeadStockBundleController] createBundle Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error creating bundle.",
    });
  }
}

/**
 * GET /api/dead-stock/bundles
 * Retrieves all bundles for a shop.
 */
async function getBundles(req, res) {
  try {
    const { shop } = resolveRequestContext(req);

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop parameter is required.",
      });
    }

    const result = await deadStockBundleService.getDeadStockBundles(shop);

    return res.status(result.statusCode || 200).json({
      success: result.success,
      data: result.data,
    });
  } catch (error) {
    console.error("[DeadStockBundleController] getBundles Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error retrieving bundles.",
    });
  }
}

/**
 * GET /api/dead-stock/bundles/:id
 * Retrieves a single bundle by ID.
 */
async function getBundle(req, res) {
  try {
    const { id } = req.params;
    const { shop } = resolveRequestContext(req);

    const result = await deadStockBundleService.getDeadStockBundleById(id, shop);

    return res.status(result.statusCode || (result.success ? 200 : 404)).json({
      success: result.success,
      ...(result.data ? { data: result.data } : {}),
      ...(result.message ? { message: result.message } : {}),
    });
  } catch (error) {
    console.error("[DeadStockBundleController] getBundle Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error retrieving bundle.",
    });
  }
}

/**
 * PUT /api/dead-stock/bundles/:id
 * Updates an existing bundle.
 */
async function updateBundle(req, res) {
  try {
    const { id } = req.params;
    const { shop, accessToken } = resolveRequestContext(req);
    const payload = {
      ...req.body,
      shop: req.body?.shop || shop,
    };

    const result = await deadStockBundleService.updateDeadStockBundle(
      id,
      payload,
      accessToken
    );

    return res.status(result.statusCode || (result.success ? 200 : 400)).json({
      success: result.success,
      message: result.message,
      ...(result.data ? { data: result.data } : {}),
    });
  } catch (error) {
    console.error("[DeadStockBundleController] updateBundle Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error updating bundle.",
    });
  }
}

/**
 * DELETE /api/dead-stock/bundles/:id
 * Deletes a bundle by ID.
 */
async function deleteBundle(req, res) {
  try {
    const { id } = req.params;
    const { shop } = resolveRequestContext(req);

    const result = await deadStockBundleService.deleteDeadStockBundle(id, shop);

    return res.status(result.statusCode || (result.success ? 200 : 404)).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("[DeadStockBundleController] deleteBundle Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error deleting bundle.",
    });
  }
}

module.exports = {
  createBundle,
  getBundles,
  getBundle,
  updateBundle,
  deleteBundle,
};
