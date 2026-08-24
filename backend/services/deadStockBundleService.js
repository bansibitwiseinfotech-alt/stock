const DeadStockBundle = require("../models/DeadStockBundle");
const Store = require("../models/Store");
const shopifyGraphQL = require("./shopifyGraphql");

const GET_PRODUCTS_BY_IDS_QUERY = `
query GetProducts($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Product {
      id
      title
      handle
      featuredImage {
        url
      }
      variants(first: 1) {
        nodes {
          id
        }
      }
    }
  }
}
`;

/**
 * Safely normalizes Shopify IDs into gid://shopify/Type/ID format.
 */
function normalizeShopifyId(id, type = "Product") {
  if (!id) return "";
  const str = String(id).trim();
  if (str.startsWith("gid://shopify/")) {
    return str;
  }
  const numericOnly = str.replace(/\D/g, "");
  return numericOnly ? `gid://shopify/${type}/${numericOnly}` : str;
}

/**
 * Extracts the numeric ID component from a Shopify ID string.
 */
function extractNumericId(id) {
  if (!id) return "";
  const str = String(id).trim();
  const match = str.match(/\d+$/);
  return match ? match[0] : str;
}

/**
 * Resolves Shopify Admin API access token for a given shop.
 */
async function getShopifyAccessToken(shop, passedToken) {
  if (passedToken && String(passedToken).trim()) {
    return String(passedToken).trim();
  }

  if (shop) {
    const store = await Store.findOne({ shop }).lean().catch(() => null);
    if (store?.accessToken) {
      return store.accessToken;
    }
  }

  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ACCESS_TOKEN;
  }

  return null;
}

/**
 * Validates Dead Stock BOGO bundle payload against all business rules.
 */
function validateDeadStockBundlePayload(payload) {
  const { shop, bundleName, offerType, products } = payload || {};

  // 1. Shop validation
  if (!shop || !String(shop).trim()) {
    return {
      isValid: false,
      statusCode: 400,
      message: "Shop is required.",
    };
  }

  // 2. Bundle Name validation
  if (!bundleName || !String(bundleName).trim()) {
    return {
      isValid: false,
      statusCode: 400,
      message: "Bundle name is required.",
    };
  }

  // 3. Offer Type validation
  if (!offerType || String(offerType).trim().toUpperCase() !== "BOGO") {
    return {
      isValid: false,
      statusCode: 400,
      message: "Only BOGO offer is supported.",
    };
  }

  // 4. Products array validation
  if (!Array.isArray(products)) {
    return {
      isValid: false,
      statusCode: 400,
      message: "Products list is required.",
    };
  }

  if (products.length < 2) {
    return {
      isValid: false,
      statusCode: 400,
      message: "A BOGO bundle must contain at least 2 products.",
    };
  }

  if (products.length > 3) {
    return {
      isValid: false,
      statusCode: 400,
      message: "BOGO bundle can contain maximum 3 products.",
    };
  }

  // 5. Product items & Duplicate check
  const seenProductIds = new Set();
  const buyProducts = [];
  const getFreeProducts = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (!product || typeof product !== "object") {
      return {
        isValid: false,
        statusCode: 400,
        message: `Product at position ${i + 1} is invalid.`,
      };
    }

    const rawProductId = product.productId;
    if (!rawProductId || !String(rawProductId).trim()) {
      return {
        isValid: false,
        statusCode: 400,
        message: `Product ID is required for product at position ${i + 1}.`,
      };
    }

    const cleanId = extractNumericId(rawProductId) || String(rawProductId).trim();
    if (seenProductIds.has(cleanId)) {
      return {
        isValid: false,
        statusCode: 400,
        message: "The same product cannot be added more than once.",
      };
    }
    seenProductIds.add(cleanId);

    const role = String(product.role || "").trim().toUpperCase();
    if (role === "BUY") {
      buyProducts.push(product);
    } else if (role === "GET_FREE") {
      getFreeProducts.push(product);
    } else {
      return {
        isValid: false,
        statusCode: 400,
        message: `Invalid role "${product.role}". Role must be either BUY or GET_FREE.`,
      };
    }
  }

  // 6. BUY count validation (Exactly 1 BUY product)
  if (buyProducts.length !== 1) {
    return {
      isValid: false,
      statusCode: 400,
      message: "BOGO bundle must have exactly 1 BUY product.",
    };
  }

  // 7. GET_FREE count validation (1 or 2 GET_FREE products)
  if (getFreeProducts.length < 1 || getFreeProducts.length > 2) {
    return {
      isValid: false,
      statusCode: 400,
      message: "BOGO bundle can contain maximum 2 GET_FREE products.",
    };
  }

  return {
    isValid: true,
    cleanShop: String(shop).trim(),
    cleanBundleName: String(bundleName).trim(),
    buyProduct: buyProducts[0],
    getFreeProducts,
  };
}

/**
 * Verifies product IDs against Shopify Admin GraphQL API and retrieves authoritative data.
 */
async function verifyShopifyProducts(shop, accessToken, productIds) {
  if (!productIds || productIds.length === 0) {
    return new Map();
  }

  const formattedIds = productIds.map((id) => normalizeShopifyId(id, "Product"));

  let data;
  try {
    data = await shopifyGraphQL(shop, accessToken, GET_PRODUCTS_BY_IDS_QUERY, {
      ids: formattedIds,
    });
  } catch (error) {
    console.error(`[DeadStockBundleService] Shopify GraphQL verification failed:`, error.message);
    throw new Error("Selected product could not be verified on Shopify.");
  }

  const nodes = data?.nodes || [];
  const productMap = new Map();

  for (const node of nodes) {
    if (node && node.id) {
      productMap.set(node.id, node);
      const numericId = extractNumericId(node.id);
      if (numericId) {
        productMap.set(numericId, node);
      }
    }
  }

  // Ensure every requested product exists in the Shopify store
  for (const requestedId of productIds) {
    const formatted = normalizeShopifyId(requestedId, "Product");
    const numeric = extractNumericId(requestedId);

    const found = productMap.get(formatted) || (numeric ? productMap.get(numeric) : null);
    if (!found) {
      console.warn(`[DeadStockBundleService] Product ID ${requestedId} not found in Shopify nodes.`);
      throw new Error("Selected product could not be verified on Shopify.");
    }
  }

  return productMap;
}

/**
 * Creates a new Dead Stock BOGO Bundle.
 */
async function createDeadStockBundle(payload, explicitToken = null) {
  // 1. Enforce payload validation
  const validation = validateDeadStockBundlePayload(payload);
  if (!validation.isValid) {
    return {
      success: false,
      statusCode: validation.statusCode || 400,
      message: validation.message,
    };
  }

  const shop = validation.cleanShop;
  const bundleName = validation.cleanBundleName;
  const products = payload.products;

  // 2. Resolve Shopify access token
  const accessToken = await getShopifyAccessToken(shop, explicitToken);

  // 3. Verify products with Shopify if token is available
  let shopifyProductMap = new Map();
  if (accessToken) {
    try {
      const productIds = products.map((p) => p.productId);
      shopifyProductMap = await verifyShopifyProducts(shop, accessToken, productIds);
    } catch (verifyError) {
      return {
        success: false,
        statusCode: 400,
        message: verifyError.message || "Selected product could not be verified on Shopify.",
      };
    }
  }

  // 4. Enrich products using Shopify authoritative data when available
  const enrichedProducts = products.map((p) => {
    const formattedId = normalizeShopifyId(p.productId, "Product");
    const numericId = extractNumericId(p.productId);
    const shopifyData = shopifyProductMap.get(formattedId) || (numericId ? shopifyProductMap.get(numericId) : null);

    const title = shopifyData?.title || p.title || "Product";
    const handle = shopifyData?.handle || p.handle || null;
    const image = shopifyData?.featuredImage?.url || p.image || null;
    const variantId = p.variantId
      ? normalizeShopifyId(p.variantId, "ProductVariant")
      : shopifyData?.variants?.nodes?.[0]?.id || null;

    return {
      productId: formattedId,
      variantId,
      title,
      handle,
      image,
      role: String(p.role).toUpperCase(),
    };
  });

  const buyProduct = enrichedProducts.find((p) => p.role === "BUY");
  const getFreeProducts = enrichedProducts.filter((p) => p.role === "GET_FREE");

  const buyProductId = buyProduct.productId;
  const getProductIds = getFreeProducts.map((p) => p.productId);

  // 5. Persist to MongoDB
  const status = ["DRAFT", "ACTIVE", "INACTIVE"].includes(payload.status)
    ? payload.status
    : "DRAFT";

  const newBundle = await DeadStockBundle.create({
    shop,
    bundleName,
    offerType: "BOGO",
    products: enrichedProducts,
    buyProductId,
    getProductIds,
    status,
  });

  return {
    success: true,
    statusCode: 201,
    message: "Dead stock BOGO bundle created successfully.",
    data: {
      id: newBundle._id.toString(),
      shop: newBundle.shop,
      bundleName: newBundle.bundleName,
      offerType: newBundle.offerType,
      products: newBundle.products,
      buyProductId: newBundle.buyProductId,
      getProductIds: newBundle.getProductIds,
      status: newBundle.status,
      createdAt: newBundle.createdAt,
      updatedAt: newBundle.updatedAt,
    },
  };
}

/**
 * Retrieves all bundles for a given shop.
 */
async function getDeadStockBundles(shop) {
  if (!shop || !String(shop).trim()) {
    return {
      success: false,
      statusCode: 400,
      message: "Shop parameter is required.",
    };
  }

  const bundles = await DeadStockBundle.find({ shop: String(shop).trim() })
    .sort({ createdAt: -1 })
    .lean();

  const formatted = bundles.map((b) => ({
    id: b._id.toString(),
    shop: b.shop,
    bundleName: b.bundleName,
    offerType: b.offerType,
    products: b.products,
    buyProductId: b.buyProductId,
    getProductIds: b.getProductIds,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return {
    success: true,
    statusCode: 200,
    data: formatted,
  };
}

/**
 * Retrieves a single bundle by ID and shop.
 */
async function getDeadStockBundleById(id, shop) {
  if (!id) {
    return {
      success: false,
      statusCode: 400,
      message: "Bundle ID is required.",
    };
  }

  const query = { _id: id };
  if (shop) {
    query.shop = String(shop).trim();
  }

  const bundle = await DeadStockBundle.findOne(query).lean();
  if (!bundle) {
    return {
      success: false,
      statusCode: 404,
      message: "Bundle not found.",
    };
  }

  return {
    success: true,
    statusCode: 200,
    data: {
      id: bundle._id.toString(),
      shop: bundle.shop,
      bundleName: bundle.bundleName,
      offerType: bundle.offerType,
      products: bundle.products,
      buyProductId: bundle.buyProductId,
      getProductIds: bundle.getProductIds,
      status: bundle.status,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    },
  };
}

/**
 * Updates an existing Dead Stock BOGO bundle.
 */
async function updateDeadStockBundle(id, payload, explicitToken = null) {
  if (!id) {
    return {
      success: false,
      statusCode: 400,
      message: "Bundle ID is required.",
    };
  }

  // 1. Enforce full payload validation
  const validation = validateDeadStockBundlePayload(payload);
  if (!validation.isValid) {
    return {
      success: false,
      statusCode: validation.statusCode || 400,
      message: validation.message,
    };
  }

  const shop = validation.cleanShop;
  const bundleName = validation.cleanBundleName;
  const products = payload.products;

  // 2. Find existing bundle
  const existingBundle = await DeadStockBundle.findOne({ _id: id, shop });
  if (!existingBundle) {
    return {
      success: false,
      statusCode: 404,
      message: "Bundle not found or does not belong to this shop.",
    };
  }

  // 3. Resolve token & verify Shopify products
  const accessToken = await getShopifyAccessToken(shop, explicitToken);
  let shopifyProductMap = new Map();
  if (accessToken) {
    try {
      const productIds = products.map((p) => p.productId);
      shopifyProductMap = await verifyShopifyProducts(shop, accessToken, productIds);
    } catch (verifyError) {
      return {
        success: false,
        statusCode: 400,
        message: verifyError.message || "Selected product could not be verified on Shopify.",
      };
    }
  }

  // 4. Enrich products
  const enrichedProducts = products.map((p) => {
    const formattedId = normalizeShopifyId(p.productId, "Product");
    const numericId = extractNumericId(p.productId);
    const shopifyData = shopifyProductMap.get(formattedId) || (numericId ? shopifyProductMap.get(numericId) : null);

    const title = shopifyData?.title || p.title || "Product";
    const handle = shopifyData?.handle || p.handle || null;
    const image = shopifyData?.featuredImage?.url || p.image || null;
    const variantId = p.variantId
      ? normalizeShopifyId(p.variantId, "ProductVariant")
      : shopifyData?.variants?.nodes?.[0]?.id || null;

    return {
      productId: formattedId,
      variantId,
      title,
      handle,
      image,
      role: String(p.role).toUpperCase(),
    };
  });

  const buyProduct = enrichedProducts.find((p) => p.role === "BUY");
  const getFreeProducts = enrichedProducts.filter((p) => p.role === "GET_FREE");

  const buyProductId = buyProduct.productId;
  const getProductIds = getFreeProducts.map((p) => p.productId);

  // 5. Update bundle
  existingBundle.bundleName = bundleName;
  existingBundle.offerType = "BOGO";
  existingBundle.products = enrichedProducts;
  existingBundle.buyProductId = buyProductId;
  existingBundle.getProductIds = getProductIds;
  if (payload.status && ["DRAFT", "ACTIVE", "INACTIVE"].includes(payload.status)) {
    existingBundle.status = payload.status;
  }

  await existingBundle.save();

  return {
    success: true,
    statusCode: 200,
    message: "Dead stock BOGO bundle updated successfully.",
    data: {
      id: existingBundle._id.toString(),
      shop: existingBundle.shop,
      bundleName: existingBundle.bundleName,
      offerType: existingBundle.offerType,
      products: existingBundle.products,
      buyProductId: existingBundle.buyProductId,
      getProductIds: existingBundle.getProductIds,
      status: existingBundle.status,
      createdAt: existingBundle.createdAt,
      updatedAt: existingBundle.updatedAt,
    },
  };
}

/**
 * Deletes a Dead Stock BOGO bundle by ID.
 */
async function deleteDeadStockBundle(id, shop) {
  if (!id) {
    return {
      success: false,
      statusCode: 400,
      message: "Bundle ID is required.",
    };
  }

  const query = { _id: id };
  if (shop) {
    query.shop = String(shop).trim();
  }

  const existingBundle = await DeadStockBundle.findOne(query);
  if (!existingBundle) {
    return {
      success: false,
      statusCode: 404,
      message: "Bundle not found or does not belong to this shop.",
    };
  }

  await DeadStockBundle.deleteOne({ _id: id });

  return {
    success: true,
    statusCode: 200,
    message: "Dead stock BOGO bundle deleted successfully.",
  };
}

module.exports = {
  createDeadStockBundle,
  getDeadStockBundles,
  getDeadStockBundleById,
  updateDeadStockBundle,
  deleteDeadStockBundle,
  validateDeadStockBundlePayload,
  verifyShopifyProducts,
  getShopifyAccessToken,
  normalizeShopifyId,
  extractNumericId,
};
