const Bundle = require("../models/Bundle");
const DeadStockAction = require("../models/DeadStockAction");
const DeadStock = require("../models/DeadStock");
const Product = require("../models/Product");
const Store = require("../models/Store");
const DeadStockBundle = require("../models/DeadStockBundle");
const shopifyGraphQL = require("./shopifyGraphql");
const { getProduct, createBundleProduct } = require("./shopifyBundleService");

const PRODUCTS_QUERY = `
query getCompanionProducts($first: Int!) {
  products(first: $first) {
    nodes {
      id
      title
      featuredImage {
        url
      }
      variants(first: 5) {
        nodes {
          id
          sku
          price
        }
      }
    }
  }
}
`;

const CREATE_BXGY_DISCOUNT_MUTATION = `
mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
  discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
    automaticDiscountNode {
      id
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title
          status
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

const DELETE_AUTOMATIC_DISCOUNT_MUTATION = `
mutation discountAutomaticDelete($id: ID!) {
  discountAutomaticDelete(id: $id) {
    deletedAutomaticDiscountId
    userErrors {
      field
      message
      code
    }
  }
}
`;

/**
 * Creates a native Shopify Automatic Buy X Get Y (BXGY) Discount.
 */
async function createShopifyBOGODiscount(shop, accessToken, deadStockProductId, freeProductId, deadStockTitle, freeTitle) {
  if (!shop || !accessToken) return "";
  const buyProdGid = normalizeShopifyId(deadStockProductId, "Product");
  const getProdGid = normalizeShopifyId(freeProductId, "Product");

  const variables = {
    automaticBxgyDiscount: {
      title: `BOGO: Buy ${deadStockTitle || "Product"} Get ${freeTitle || "Free Gift"} Free`,
      startsAt: new Date().toISOString(),
      customerBuys: {
        items: {
          products: {
            productsToAdd: [buyProdGid]
          }
        },
        value: {
          quantity: "1"
        }
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: [getProdGid]
          }
        },
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: {
              percentage: 1.0
            }
          }
        }
      }
    }
  };

  try {
    const res = await shopifyGraphQL(shop, accessToken, CREATE_BXGY_DISCOUNT_MUTATION, variables);
    const node = res?.discountAutomaticBxgyCreate?.automaticDiscountNode;
    if (node?.id) {
      return node.id;
    }
    if (res?.discountAutomaticBxgyCreate?.userErrors?.length) {
      console.warn("[BundleService] BXGY discount userErrors:", res.discountAutomaticBxgyCreate.userErrors);
    }
  } catch (err) {
    console.error("[BundleService] Error creating Shopify BXGY discount:", err.message);
  }
  return "";
}

/**
 * Deletes a Shopify Automatic Discount by node ID.
 */
async function deleteShopifyDiscount(shop, accessToken, discountId) {
  if (!shop || !accessToken || !discountId) return;
  const gid = discountId.startsWith("gid://") ? discountId : `gid://shopify/DiscountAutomaticNode/${discountId}`;
  try {
    await shopifyGraphQL(shop, accessToken, DELETE_AUTOMATIC_DISCOUNT_MUTATION, { id: gid });
  } catch (err) {
    console.warn("[BundleService] Error deleting Shopify discount:", err.message);
  }
}

/**
 * Safely normalizes Shopify IDs without breaking clean GIDs or numeric strings.
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

function cleanIdNumber(id) {
  if (!id) return "";
  return String(id).replace(/\D/g, "");
}

function cleanShop(shop) {
  if (!shop) return "";
  return String(shop)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();
}

const NODES_RESOLVE_QUERY = `
query resolveShopifyNodes($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on Product {
      id
      title
      handle
      featuredImage {
        url
        altText
      }
      images(first: 1) {
        nodes {
          url
          altText
        }
      }
      variants(first: 20) {
        nodes {
          id
          title
          price
          sku
          inventoryQuantity
          image {
            url
            altText
          }
        }
      }
    }
    ... on ProductVariant {
      id
      title
      price
      sku
      inventoryQuantity
      image {
        url
        altText
      }
      product {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
        images(first: 1) {
          nodes {
            url
            altText
          }
        }
      }
    }
  }
}
`;

function isPlaceholderText(str) {
  if (!str || typeof str !== "string") return true;
  const s = str.trim().toLowerCase();
  return (
    s === "" ||
    s === "this product" ||
    s === "primary product" ||
    s === "recommended companion item" ||
    s === "recommended companion" ||
    s === "companion product" ||
    s === "recommended product" ||
    s === "product" ||
    s === "product unavailable"
  );
}

/**
 * Resolves a product / variant details (ID, title, image, price) from Shopify GraphQL or MongoDB.
 */
async function resolveProductDetails(shop, accessToken, productIdOrVariantId, fallbackType = "Product") {
  if (!productIdOrVariantId) {
    return {
      productId: "",
      variantId: "",
      title: "",
      variantTitle: "",
      image: "",
      imageAlt: "",
      price: 0,
    };
  }

  const cleanShopDomain = cleanShop(shop);
  const cleanId = cleanIdNumber(productIdOrVariantId);
  const rawIdStr = String(productIdOrVariantId).trim();

  let validToken = accessToken;
  if (!validToken && cleanShopDomain) {
    const storeRecord = await Store.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
    }).lean().catch(() => null);
    validToken = storeRecord?.accessToken;
  }

  let title = "";
  let variantTitle = "";
  let image = "";
  let imageAlt = "";
  let price = 0;
  let variantId = "";
  let productId = "";

  // 1. Try Shopify GraphQL via nodes query (authoritative source)
  if (validToken && cleanShopDomain && cleanId) {
    const candidateGids = new Set();
    if (rawIdStr.startsWith("gid://shopify/")) {
      candidateGids.add(rawIdStr);
    }
    candidateGids.add(`gid://shopify/Product/${cleanId}`);
    candidateGids.add(`gid://shopify/ProductVariant/${cleanId}`);

    try {
      const data = await shopifyGraphQL(
        cleanShopDomain,
        validToken,
        NODES_RESOLVE_QUERY,
        { ids: Array.from(candidateGids) }
      );

      const nodes = (data?.nodes || []).filter(Boolean);

      // Check if a ProductVariant matched
      const variantNode = nodes.find((n) => n.__typename === "ProductVariant" || (n.product && n.price !== undefined));
      // Check if a Product matched
      const productNode = nodes.find((n) => n.__typename === "Product" || (!n.product && Array.isArray(n.variants?.nodes)));

      if (variantNode) {
        variantId = normalizeShopifyId(variantNode.id, "ProductVariant");
        variantTitle = variantNode.title || "";
        price = Number(variantNode.price || 0);
        productId = variantNode.product?.id ? normalizeShopifyId(variantNode.product.id, "Product") : "";
        title = variantNode.product?.title || variantNode.title || "";
        image =
          variantNode.image?.url ||
          variantNode.product?.featuredImage?.url ||
          variantNode.product?.images?.nodes?.[0]?.url ||
          "";
        imageAlt =
          variantNode.image?.altText ||
          variantNode.product?.featuredImage?.altText ||
          variantNode.product?.images?.nodes?.[0]?.altText ||
          title;
      }

      if (productNode) {
        if (!productId) productId = normalizeShopifyId(productNode.id, "Product");
        if (!title || isPlaceholderText(title)) title = productNode.title || "";
        if (!image) {
          image =
            productNode.featuredImage?.url ||
            productNode.images?.nodes?.[0]?.url ||
            productNode.variants?.nodes?.[0]?.image?.url ||
            "";
        }
        if (!imageAlt) {
          imageAlt =
            productNode.featuredImage?.altText ||
            productNode.images?.nodes?.[0]?.altText ||
            title;
        }

        const matchedVar =
          productNode.variants?.nodes?.find(
            (v) => cleanIdNumber(v.id) === cleanId
          ) || productNode.variants?.nodes?.[0];

        if (matchedVar) {
          if (!variantId) variantId = normalizeShopifyId(matchedVar.id, "ProductVariant");
          if (!variantTitle) variantTitle = matchedVar.title || "";
          if (!price) price = Number(matchedVar.price || 0);
        }
      }
    } catch (e) {
      console.warn("[BundleService] Shopify GraphQL detail resolution warning:", e.message);
    }
  }

  // 2. Try MongoDB DeadStock collection if fields still missing
  if (!title || isPlaceholderText(title) || !image || !variantId || !price) {
    const deadStockItem = await DeadStock.findOne({
      $or: [
        { productId: cleanId },
        { productId: `gid://shopify/Product/${cleanId}` },
        { variantId: cleanId },
        { variantId: `gid://shopify/ProductVariant/${cleanId}` },
      ],
    }).lean().catch(() => null);

    if (deadStockItem) {
      if (!title || isPlaceholderText(title)) title = deadStockItem.title || "";
      if (!image) image = deadStockItem.image || "";
      if (!price) price = Number(deadStockItem.currentPrice || deadStockItem.costPrice || 0);
      if (!variantId && deadStockItem.variantId) {
        variantId = normalizeShopifyId(deadStockItem.variantId, "ProductVariant");
      }
      if (!productId && deadStockItem.productId) {
        productId = normalizeShopifyId(deadStockItem.productId, "Product");
      }
    }
  }

  // 3. Try MongoDB Product collection if fields still missing
  if (!title || isPlaceholderText(title) || !image || !variantId || !price) {
    const productItem = await Product.findOne({
      $or: [
        { productId: cleanId },
        { productId: `gid://shopify/Product/${cleanId}` },
        { "variants.variantId": cleanId },
        { "variants.variantId": `gid://shopify/ProductVariant/${cleanId}` },
      ],
    }).lean().catch(() => null);

    if (productItem) {
      if (!title || isPlaceholderText(title)) title = productItem.title || "";
      if (!image) image = productItem.image || "";
      if (!productId && productItem.productId) {
        productId = normalizeShopifyId(productItem.productId, "Product");
      }
      const matchedVar = productItem.variants?.find(
        (v) => cleanIdNumber(v.variantId) === cleanId || !cleanId
      ) || productItem.variants?.[0];

      if (matchedVar) {
        if (!variantId && matchedVar.variantId) {
          variantId = normalizeShopifyId(matchedVar.variantId, "ProductVariant");
        }
        if (!price) price = Number(matchedVar.price || 0);
      }
    }
  }

  return {
    productId: productId || normalizeShopifyId(productIdOrVariantId, "Product"),
    variantId: variantId || (fallbackType === "ProductVariant" ? normalizeShopifyId(productIdOrVariantId, "ProductVariant") : ""),
    title: !isPlaceholderText(title) ? title : "",
    variantTitle,
    image,
    imageAlt: imageAlt || title || "",
    price,
  };
}

/**
 * Creates or updates a BOGO (Buy One Get One Free) Dead Stock Bundle.
 */
async function createBOGOBundle(
  shop,
  accessToken,
  {
    deadStockProductId,
    deadStockVariantId,
    companionProductId,
    companionVariantId,
    deadStockTitle,
    companionTitle,
    deadStockImage,
    companionImage,
    deadStockPrice,
    companionPrice,
    bundleName,
    discountPercent,
    freeProductId,
    freeProductVariantId,
    freeProductTitle,
    freeProductImage,
  }
) {
  if (!shop || !String(shop).trim()) {
    return { success: false, message: "Shop domain is required." };
  }
  if (!deadStockProductId && !deadStockVariantId) {
    return { success: false, message: "Dead stock product is required." };
  }
  const targetFreeId = freeProductId || companionProductId;
  if (!targetFreeId && !companionVariantId && !freeProductVariantId) {
    return { success: false, message: "Free product must be selected for BOGO offer." };
  }

  const trimmedName = String(bundleName || "").trim() || "Buy One Get One Free Bundle";
  const cleanShopDomain = cleanShop(shop);

  let validToken = accessToken;
  if (!validToken) {
    const storeRecord = await Store.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
    }).lean().catch(() => null);
    validToken = storeRecord?.accessToken;
  }

  const [deadStockInfo, freeInfo] = await Promise.all([
    resolveProductDetails(cleanShopDomain, validToken, deadStockVariantId || deadStockProductId, "ProductVariant"),
    resolveProductDetails(cleanShopDomain, validToken, freeProductVariantId || targetFreeId, "Product"),
  ]);

  const finalDeadStockProductId = deadStockInfo.productId || normalizeShopifyId(deadStockProductId, "Product");
  const finalDeadStockVariantId = deadStockInfo.variantId || normalizeShopifyId(deadStockVariantId || deadStockProductId, "ProductVariant");
  const finalFreeProductId = freeInfo.productId || normalizeShopifyId(targetFreeId, "Product");
  const finalFreeVariantId = freeInfo.variantId || normalizeShopifyId(freeProductVariantId || companionVariantId || targetFreeId, "ProductVariant");

  const cleanDeadStockVariantId = cleanIdNumber(finalDeadStockVariantId);
  const cleanDeadStockProductId = cleanIdNumber(finalDeadStockProductId);

  const finalDeadStockTitle =
    (!isPlaceholderText(deadStockInfo.title) ? deadStockInfo.title : "") ||
    (!isPlaceholderText(deadStockTitle) ? deadStockTitle : "") ||
    deadStockInfo.variantTitle ||
    "Product unavailable";

  const finalFreeTitle =
    (!isPlaceholderText(freeInfo.title) ? freeInfo.title : "") ||
    (!isPlaceholderText(freeProductTitle) ? freeProductTitle : "") ||
    (!isPlaceholderText(companionTitle) ? companionTitle : "") ||
    freeInfo.variantTitle ||
    "Product unavailable";

  const finalDeadStockImage = deadStockInfo.image || deadStockImage || "";
  const finalFreeImage = freeInfo.image || freeProductImage || companionImage || "";

  const p1 = Number(deadStockPrice || deadStockInfo.price || 0);
  const p2 = Number(companionPrice || freeInfo.price || 0);
  const originalPrice = Number((p1 + p2).toFixed(2));
  const bundlePrice = Number(p1.toFixed(2)); // In BOGO, customer only pays for the dead-stock product
  const savings = Number(p2.toFixed(2));     // Savings is 100% of the free product value

  try {
    // Find existing bundle for this dead stock product (to update instead of creating duplicate)
    const existing = await Bundle.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
      status: "ACTIVE",
      $or: [
        { deadStockVariantId: finalDeadStockVariantId },
        { deadStockVariantId: cleanDeadStockVariantId },
        { deadStockProductId: finalDeadStockProductId },
        { deadStockProductId: cleanDeadStockProductId },
      ],
    });

    // 1. Delete previous Shopify discount if any
    const oldDiscountId = existing?.shopifyDiscountId || existing?.metadata?.shopifyDiscountId;
    if (oldDiscountId && validToken) {
      await deleteShopifyDiscount(cleanShopDomain, validToken, oldDiscountId);
    }

    // 2. Create native Shopify Automatic BXGY Discount
    let newShopifyDiscountId = "";
    if (validToken) {
      newShopifyDiscountId = await createShopifyBOGODiscount(
        cleanShopDomain,
        validToken,
        finalDeadStockProductId,
        finalFreeProductId,
        finalDeadStockTitle,
        finalFreeTitle
      );
    }

    const bundleMetadata = {
      originalPrice,
      bundlePrice,
      savings,
      handle: "",
      deadStockTitle: finalDeadStockTitle,
      companionTitle: finalFreeTitle,
      deadStockImage: finalDeadStockImage,
      companionImage: finalFreeImage,
      deadStockProductId: finalDeadStockProductId,
      deadStockVariantId: finalDeadStockVariantId,
      companionProductId: finalFreeProductId,
      companionVariantId: finalFreeVariantId,
      offerType: "BOGO",
      freeProductId: finalFreeProductId,
      freeProductVariantId: finalFreeVariantId,
      freeProductTitle: finalFreeTitle,
      freeProductImage: finalFreeImage,
      deadStockPrice: p1,
      companionPrice: p2,
      shopifyDiscountId: newShopifyDiscountId,
    };

    let bundle;
    if (existing) {
      existing.bundleName = trimmedName;
      existing.deadStockProductId = finalDeadStockProductId;
      existing.deadStockVariantId = finalDeadStockVariantId;
      existing.companionProductId = finalFreeProductId;
      existing.companionVariantId = finalFreeVariantId;
      existing.discountPercent = 100;
      existing.offerType = "BOGO";
      existing.freeProductId = finalFreeProductId;
      existing.freeProductVariantId = finalFreeVariantId;
      existing.status = "ACTIVE";
      existing.shopifyBundleId = ""; // No normal Shopify bundle product for BOGO
      existing.shopifyProductId = "";
      existing.shopifyVariantId = "";
      existing.shopifyDiscountId = newShopifyDiscountId;
      existing.type = "Bundle (BOGO)";
      existing.metadata = bundleMetadata;
      bundle = await existing.save();
    } else {
      bundle = await Bundle.create({
        shop: cleanShopDomain,
        bundleName: trimmedName,
        deadStockProductId: finalDeadStockProductId,
        deadStockVariantId: finalDeadStockVariantId,
        companionProductId: finalFreeProductId,
        companionVariantId: finalFreeVariantId,
        discountPercent: 100,
        offerType: "BOGO",
        freeProductId: finalFreeProductId,
        freeProductVariantId: finalFreeVariantId,
        status: "ACTIVE",
        shopifyBundleId: "",
        shopifyProductId: "",
        shopifyVariantId: "",
        shopifyDiscountId: newShopifyDiscountId,
        type: "Bundle (BOGO)",
        productsCount: 2,
        performance: "$0",
        metadata: bundleMetadata,
      });
    }

    try {
      await DeadStockAction.create({
        shop: cleanShopDomain,
        productId: finalDeadStockProductId,
        variantId: finalDeadStockVariantId,
        actionType: "BUNDLE",
        status: "COMPLETED",
        discountPercent: 100,
        executedAt: new Date(),
        metadata: {
          bundleId: bundle._id,
          bundleName: trimmedName,
          offerType: "BOGO",
          isUpdate: Boolean(existing),
          freeProductId: finalFreeProductId,
          companionProductId: finalFreeProductId,
        },
      });
    } catch (auditErr) {}

    return {
      success: true,
      message: existing ? "BOGO bundle updated successfully." : "BOGO bundle created successfully.",
      data: bundle,
    };
  } catch (error) {
    console.error("[BundleService] Error creating BOGO bundle:", error);
    return { success: false, message: error.message || "Failed to create BOGO bundle." };
  }
}

/**
 * Creates or updates a Normal Dead Stock Bundle (Frequently Bought Together).
 */
async function createNormalBundle(
  shop,
  accessToken,
  {
    deadStockProductId,
    deadStockVariantId,
    companionProductId,
    companionVariantId,
    deadStockTitle,
    companionTitle,
    deadStockImage,
    companionImage,
    deadStockPrice,
    companionPrice,
    bundleName,
    discountPercent,
  }
) {
  if (!shop || !String(shop).trim()) {
    return { success: false, message: "Shop domain is required." };
  }
  if (!deadStockProductId && !deadStockVariantId) {
    return { success: false, message: "Dead stock product is required." };
  }
  if (!companionProductId && !companionVariantId) {
    return { success: false, message: "Recommended companion product is required." };
  }

  const trimmedName = String(bundleName || "").trim();
  if (!trimmedName) {
    return { success: false, message: "Bundle name is required." };
  }

  const pct = Number(discountPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return { success: false, message: "Discount percent must be a valid number between 0 and 100." };
  }

  const cleanShopDomain = cleanShop(shop);

  let validToken = accessToken;
  if (!validToken) {
    const storeRecord = await Store.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
    }).lean().catch(() => null);
    validToken = storeRecord?.accessToken;
  }

  const [deadStockInfo, companionInfo] = await Promise.all([
    resolveProductDetails(cleanShopDomain, validToken, deadStockVariantId || deadStockProductId, "ProductVariant"),
    resolveProductDetails(cleanShopDomain, validToken, companionVariantId || companionProductId, "Product"),
  ]);

  const finalDeadStockProductId = deadStockInfo.productId || normalizeShopifyId(deadStockProductId, "Product");
  const finalDeadStockVariantId = deadStockInfo.variantId || normalizeShopifyId(deadStockVariantId || deadStockProductId, "ProductVariant");
  const finalCompanionProductId = companionInfo.productId || normalizeShopifyId(companionProductId, "Product");
  const finalCompanionVariantId = companionInfo.variantId || normalizeShopifyId(companionVariantId || companionProductId, "ProductVariant");

  const cleanDeadStockVariantId = cleanIdNumber(finalDeadStockVariantId);
  const cleanDeadStockProductId = cleanIdNumber(finalDeadStockProductId);

  const finalDeadStockTitle =
    (!isPlaceholderText(deadStockInfo.title) ? deadStockInfo.title : "") ||
    (!isPlaceholderText(deadStockTitle) ? deadStockTitle : "") ||
    deadStockInfo.variantTitle ||
    "Product unavailable";

  const finalCompanionTitle =
    (!isPlaceholderText(companionInfo.title) ? companionInfo.title : "") ||
    (!isPlaceholderText(companionTitle) ? companionTitle : "") ||
    companionInfo.variantTitle ||
    "Product unavailable";

  const finalDeadStockImage = deadStockInfo.image || deadStockImage || "";
  const finalCompanionImage = companionInfo.image || companionImage || "";

  const p1 = Number(deadStockPrice || deadStockInfo.price || 0);
  const p2 = Number(companionPrice || companionInfo.price || 0);
  const originalPrice = Number((p1 + p2).toFixed(2));
  const bundlePrice = originalPrice > 0 ? Number((originalPrice * (1 - pct / 100)).toFixed(2)) : 0;
  const savings = Number(Math.max(0, originalPrice - bundlePrice).toFixed(2));

  try {
    const existing = await Bundle.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
      status: "ACTIVE",
      $or: [
        { deadStockVariantId: finalDeadStockVariantId },
        { deadStockVariantId: cleanDeadStockVariantId },
        { deadStockProductId: finalDeadStockProductId },
        { deadStockProductId: cleanDeadStockProductId },
      ],
    });

    // If switching from BOGO to Normal, delete any previous Shopify BXGY discount
    const oldDiscountId = existing?.shopifyDiscountId || existing?.metadata?.shopifyDiscountId;
    if (oldDiscountId && validToken) {
      await deleteShopifyDiscount(cleanShopDomain, validToken, oldDiscountId);
    }

    let shopifyBundleResult = null;
    if (validToken) {
      try {
        const deadStockProductObj = await getProduct(cleanShopDomain, validToken, finalDeadStockProductId);
        const companionProductObj = await getProduct(cleanShopDomain, validToken, finalCompanionProductId);

        const deadStockVarObj =
          deadStockProductObj?.variants?.nodes?.find(
            (v) => v.id === finalDeadStockVariantId || cleanIdNumber(v.id) === cleanDeadStockVariantId
          ) || deadStockProductObj?.variants?.nodes?.[0];

        const companionVarObj =
          companionProductObj?.variants?.nodes?.find(
            (v) => v.id === finalCompanionVariantId || cleanIdNumber(v.id) === cleanIdNumber(finalCompanionVariantId)
          ) || companionProductObj?.variants?.nodes?.[0];

        if (deadStockProductObj && companionProductObj && deadStockVarObj && companionVarObj) {
          shopifyBundleResult = await createBundleProduct({
            shop: cleanShopDomain,
            accessToken: validToken,
            bundleName: trimmedName,
            deadStockProduct: deadStockProductObj,
            deadStockVariant: deadStockVarObj,
            companionProduct: companionProductObj,
            companionVariant: companionVarObj,
            discountPercent: pct,
          });
        }
      } catch (shopifyErr) {
        console.warn("[BundleService] Shopify GraphQL bundle sync warning:", shopifyErr.message);
      }
    }

    const bundleMetadata = {
      originalPrice: shopifyBundleResult?.originalPrice || originalPrice || existing?.metadata?.originalPrice || 0,
      bundlePrice: shopifyBundleResult?.bundlePrice || bundlePrice || existing?.metadata?.bundlePrice || 0,
      savings: savings || existing?.metadata?.savings || 0,
      handle: shopifyBundleResult?.handle || existing?.metadata?.handle || "",
      deadStockTitle: finalDeadStockTitle,
      companionTitle: finalCompanionTitle,
      deadStockImage: finalDeadStockImage,
      companionImage: finalCompanionImage,
      deadStockProductId: finalDeadStockProductId,
      deadStockVariantId: finalDeadStockVariantId,
      companionProductId: finalCompanionProductId,
      companionVariantId: finalCompanionVariantId,
      offerType: "NO_OFFER",
      freeProductId: "",
      freeProductVariantId: "",
      freeProductTitle: "",
      freeProductImage: "",
    };

    let bundle;
    if (existing) {
      existing.bundleName = trimmedName;
      existing.deadStockProductId = finalDeadStockProductId;
      existing.deadStockVariantId = finalDeadStockVariantId;
      existing.companionProductId = finalCompanionProductId;
      existing.companionVariantId = finalCompanionVariantId;
      existing.discountPercent = pct;
      existing.offerType = "NO_OFFER";
      existing.freeProductId = "";
      existing.freeProductVariantId = "";
      existing.type = "Dead Stock Bundle";
      existing.status = "ACTIVE";
      if (shopifyBundleResult?.productId) {
        existing.shopifyBundleId = shopifyBundleResult.productId;
        existing.shopifyProductId = shopifyBundleResult.productId;
        existing.shopifyVariantId = shopifyBundleResult.variantId || "";
      }
      existing.metadata = bundleMetadata;
      bundle = await existing.save();
    } else {
      bundle = await Bundle.create({
        shop: cleanShopDomain,
        bundleName: trimmedName,
        deadStockProductId: finalDeadStockProductId,
        deadStockVariantId: finalDeadStockVariantId,
        companionProductId: finalCompanionProductId,
        companionVariantId: finalCompanionVariantId,
        discountPercent: pct,
        offerType: "NO_OFFER",
        freeProductId: "",
        freeProductVariantId: "",
        status: "ACTIVE",
        shopifyBundleId: shopifyBundleResult?.productId || "",
        shopifyProductId: shopifyBundleResult?.productId || "",
        shopifyVariantId: shopifyBundleResult?.variantId || "",
        type: "Dead Stock Bundle",
        productsCount: 2,
        performance: "$0",
        metadata: bundleMetadata,
      });
    }

    try {
      await DeadStockAction.create({
        shop: cleanShopDomain,
        productId: finalDeadStockProductId,
        variantId: finalDeadStockVariantId,
        actionType: "BUNDLE",
        status: "COMPLETED",
        discountPercent: pct,
        executedAt: new Date(),
        metadata: {
          bundleId: bundle._id,
          bundleName: trimmedName,
          isUpdate: Boolean(existing),
          shopifyProductId: shopifyBundleResult?.productId || bundle.shopifyProductId || "",
          companionProductId: finalCompanionProductId,
          companionVariantId: finalCompanionVariantId,
        },
      });
    } catch (auditErr) {}

    return {
      success: true,
      message: existing ? "Dead stock bundle updated successfully." : "Dead stock bundle created successfully.",
      data: bundle,
    };
  } catch (error) {
    console.error("[BundleService] Error creating normal bundle:", error);
    return { success: false, message: error.message || "Failed to create normal bundle." };
  }
}

/**
 * Main dispatcher: Mutually exclusive bundle creation.
 */
async function createDeadStockBundle(shop, accessToken, payload = {}) {
  const isBOGO = String(payload?.offerType || "").trim().toUpperCase() === "BOGO";
  if (isBOGO) {
    return await createBOGOBundle(shop, accessToken, payload);
  } else {
    return await createNormalBundle(shop, accessToken, payload);
  }
}

/**
 * Fetches recommended companion products for a given dead stock product.
 */
async function getCompanionProducts(shop, accessToken, deadStockProductId) {
  try {
    const cleanShopDomain = cleanShop(shop);
    const formattedDeadStockProductId = normalizeShopifyId(deadStockProductId, "Product");
    const cleanProductId = cleanIdNumber(deadStockProductId);

    let validToken = accessToken;
    if (!validToken && cleanShopDomain) {
      const storeRecord = await Store.findOne({
        $or: [{ shop: cleanShopDomain }, { shop }],
      }).lean().catch(() => null);
      validToken = storeRecord?.accessToken;
    }

    // 1. Primary: Query Shopify GraphQL if token is available
    if (validToken && cleanShopDomain) {
      try {
        const data = await shopifyGraphQL(cleanShopDomain, validToken, PRODUCTS_QUERY, { first: 20 });
        const nodes = data?.products?.nodes || [];

        const filtered = nodes.filter((p) => {
          const pClean = cleanIdNumber(p.id);
          return p.id !== formattedDeadStockProductId && pClean !== cleanProductId;
        });

        if (filtered.length > 0) {
          return filtered.map((p) => {
            const firstVariant = p.variants?.nodes?.[0];
            return {
              id: p.id,
              productId: p.id,
              variantId: firstVariant?.id || "",
              title: p.title || "Product",
              sku: firstVariant?.sku || "N/A",
              image: p.featuredImage?.url || "",
              price: Number(firstVariant?.price || 0),
              stock: 10,
            };
          });
        }
      } catch (gqlErr) {
        console.warn("[BundleService] Shopify GraphQL companion fetch warning:", gqlErr.message);
      }
    }

    // 2. Fallback: Try Product collection
    const productItems = await Product.find({
      $or: [{ shop: cleanShopDomain }, { shop }],
      productId: {
        $nin: [
          deadStockProductId,
          formattedDeadStockProductId,
          cleanProductId,
          `gid://shopify/Product/${cleanProductId}`,
        ],
      },
    })
      .limit(15)
      .lean();

    if (productItems && productItems.length > 0) {
      return productItems.map((item) => {
        const firstVar = item.variants?.[0];
        return {
          id: item.productId,
          productId: item.productId,
          variantId: firstVar?.variantId || "",
          title: item.title || "Product",
          sku: firstVar?.sku || "N/A",
          image: item.image || "",
          price: Number(firstVar?.price || 0),
          stock: Number(item.totalInventory || firstVar?.inventoryQuantity || 0),
        };
      });
    }

    // 3. Fallback: Try DeadStock collection
    const dbItems = await DeadStock.find({
      $or: [{ shopId: cleanShopDomain }, { shop: cleanShopDomain }, { shopId: shop }, { shop: shop }],
      status: { $ne: "archived" },
      productId: {
        $nin: [
          deadStockProductId,
          formattedDeadStockProductId,
          cleanProductId,
          `gid://shopify/Product/${cleanProductId}`,
        ],
      },
    })
      .limit(15)
      .lean();

    if (dbItems && dbItems.length > 0) {
      return dbItems.map((item) => ({
        id: item.productId || item.variantId,
        productId: item.productId || "",
        variantId: item.variantId || "",
        title: item.title || "Product",
        sku: item.sku || "N/A",
        image: item.image || "",
        price: Number(item.currentPrice || item.costPrice || 0),
        stock: Number(item.stock) || 0,
      }));
    }

    return [];
  } catch (err) {
    console.error("[BundleService] Error fetching companion products:", err.message);
    return [];
  }
}

/**
 * Deletes / Deactivates all active Dead Stock Bundles for a product/variant.
 */
async function deleteDeadStockBundle(shop, accessToken, productIdOrVariantId) {
  try {
    if (!shop) return { success: false, message: "Shop domain is required." };

    const cleanShopDomain = cleanShop(shop);
    const cleanId = cleanIdNumber(productIdOrVariantId);
    const formattedProdId = normalizeShopifyId(productIdOrVariantId, "Product");
    const formattedVarId = normalizeShopifyId(productIdOrVariantId, "ProductVariant");

    // Gather all related IDs (both variant and product level)
    const targetIds = new Set([
      cleanId,
      productIdOrVariantId,
      formattedProdId,
      formattedVarId,
      `gid://shopify/Product/${cleanId}`,
      `gid://shopify/ProductVariant/${cleanId}`,
    ]);

    // Also look up related product or variant IDs from MongoDB models
    try {
      const [matchedProd, matchedDs] = await Promise.all([
        Product.findOne({
          $or: [{ productId: cleanId }, { "variants.variantId": cleanId }],
        }).lean().catch(() => null),
        DeadStock.findOne({
          $or: [{ productId: cleanId }, { variantId: cleanId }],
        }).lean().catch(() => null),
      ]);

      if (matchedProd) {
        const pClean = cleanIdNumber(matchedProd.productId);
        if (pClean) {
          targetIds.add(pClean);
          targetIds.add(`gid://shopify/Product/${pClean}`);
        }
        matchedProd.variants?.forEach((v) => {
          const vClean = cleanIdNumber(v.variantId);
          if (vClean) {
            targetIds.add(vClean);
            targetIds.add(`gid://shopify/ProductVariant/${vClean}`);
          }
        });
      }

      if (matchedDs) {
        const pClean = cleanIdNumber(matchedDs.productId);
        const vClean = cleanIdNumber(matchedDs.variantId);
        if (pClean) {
          targetIds.add(pClean);
          targetIds.add(`gid://shopify/Product/${pClean}`);
        }
        if (vClean) {
          targetIds.add(vClean);
          targetIds.add(`gid://shopify/ProductVariant/${vClean}`);
        }
      }
    } catch (e) {
      console.warn("[BundleService] Related ID lookup warning:", e.message);
    }

    let validToken = accessToken;
    if (!validToken) {
      const storeRecord = await Store.findOne({
        $or: [{ shop: cleanShopDomain }, { shop }],
      }).lean().catch(() => null);
      validToken = storeRecord?.accessToken;
    }

    if (validToken) {
      try {
        const varGid = normalizeShopifyId(productIdOrVariantId, "ProductVariant");
        const resVar = await shopifyGraphQL(
          cleanShopDomain,
          validToken,
          `query getVarProd($id: ID!) { productVariant(id: $id) { id product { id variants(first: 20) { nodes { id } } } } }`,
          { id: varGid }
        );
        const pObj = resVar?.productVariant?.product;
        if (pObj?.id) {
          const pClean = cleanIdNumber(pObj.id);
          targetIds.add(pObj.id);
          targetIds.add(pClean);
          targetIds.add(`gid://shopify/Product/${pClean}`);
          pObj.variants?.nodes?.forEach((v) => {
            const vClean = cleanIdNumber(v.id);
            targetIds.add(v.id);
            targetIds.add(vClean);
            targetIds.add(`gid://shopify/ProductVariant/${vClean}`);
          });
        }
      } catch (gqlErr) {
        try {
          const prodGid = normalizeShopifyId(productIdOrVariantId, "Product");
          const resProd = await shopifyGraphQL(
            cleanShopDomain,
            validToken,
            `query getProdVars($id: ID!) { product(id: $id) { id variants(first: 20) { nodes { id } } } }`,
            { id: prodGid }
          );
          const pObj = resProd?.product;
          if (pObj?.id) {
            const pClean = cleanIdNumber(pObj.id);
            targetIds.add(pObj.id);
            targetIds.add(pClean);
            targetIds.add(`gid://shopify/Product/${pClean}`);
            pObj.variants?.nodes?.forEach((v) => {
              const vClean = cleanIdNumber(v.id);
              targetIds.add(v.id);
              targetIds.add(vClean);
              targetIds.add(`gid://shopify/ProductVariant/${vClean}`);
            });
          }
        } catch (gqlErr2) {}
      }
    }

    const targetIdArray = Array.from(targetIds).filter(Boolean);

    const isHexId = String(productIdOrVariantId).trim().length === 24 && /^[0-9a-fA-F]{24}$/.test(String(productIdOrVariantId).trim());

    const shopConditions = [
      { shop: cleanShopDomain },
      { shop: `https://${cleanShopDomain}` },
      { shopId: cleanShopDomain },
      { shopId: `https://${cleanShopDomain}` },
      { shop },
    ];

    const deleteFilter = {
      $or: shopConditions,
      $and: [
        {
          $or: [
            { deadStockProductId: { $in: targetIdArray } },
            { deadStockVariantId: { $in: targetIdArray } },
            { companionProductId: { $in: targetIdArray } },
            { companionVariantId: { $in: targetIdArray } },
            { buyProductId: { $in: targetIdArray } },
            { "products.productId": { $in: targetIdArray } },
            { "products.variantId": { $in: targetIdArray } },
            ...(isHexId ? [{ _id: productIdOrVariantId }] : []),
          ],
        },
      ],
    };

    // Clean up associated Shopify Automatic Discounts from Shopify store
    if (validToken) {
      try {
        const bundlesToDelete = await Bundle.find(deleteFilter).lean();
        for (const b of bundlesToDelete) {
          const discId = b.shopifyDiscountId || b.metadata?.shopifyDiscountId;
          if (discId) {
            await deleteShopifyDiscount(cleanShopDomain, validToken, discId);
          }
        }
      } catch (discDelErr) {
        console.warn("[BundleService] Discount cleanup warning during delete:", discDelErr.message);
      }
    }

    // Remove from active MongoDB collections
    const [delBundleRes, delBogoRes] = await Promise.all([
      Bundle.deleteMany(deleteFilter),
      DeadStockBundle.deleteMany(deleteFilter),
    ]);

    console.log(`[BundleService] Deleted ${delBundleRes.deletedCount} Bundle records and ${delBogoRes.deletedCount} DeadStockBundle records for shop ${cleanShopDomain}.`);

    // Create Audit Action Log
    try {
      await DeadStockAction.create({
        shop: cleanShopDomain,
        productId: formattedProdId,
        variantId: formattedVarId,
        actionType: "BUNDLE",
        status: "CANCELLED",
        executedAt: new Date(),
        metadata: {
          deletedId: productIdOrVariantId,
          deletedAt: new Date(),
        },
      });
    } catch (auditErr) {
      console.warn("[BundleService] Audit log warning:", auditErr.message);
    }

    return {
      success: true,
      message: "Bundle deleted successfully. It will no longer appear on your storefront.",
    };
  } catch (error) {
    console.error("[BundleService] Error deleting bundle:", error);
    return { success: false, message: error.message || "Failed to delete bundle." };
  }
}

/**
 * Ensures an active BOGO bundle has its Shopify Automatic BXGY discount created.
 */
async function ensureBOGODiscount(shop, accessToken, bundle) {
  if (!shop || !bundle) return "";
  const existingDiscountId = bundle.shopifyDiscountId || bundle.metadata?.shopifyDiscountId;
  if (existingDiscountId) return existingDiscountId;

  const isBOGO =
    bundle.offerType === "BOGO" ||
    bundle.type === "Bundle (BOGO)" ||
    bundle.type === "BOGO" ||
    Number(bundle.discountPercent) === 100 ||
    Boolean(bundle.freeProductId);

  if (!isBOGO) return "";

  const cleanShopDomain = cleanShop(shop);
  let validToken = accessToken;
  if (!validToken) {
    const storeRecord = await Store.findOne({
      $or: [{ shop: cleanShopDomain }, { shop }],
    }).lean().catch(() => null);
    validToken = storeRecord?.accessToken;
  }

  if (!validToken) return "";

  const deadStockProdId = bundle.deadStockProductId;
  const freeProdId = bundle.freeProductId || bundle.companionProductId;
  if (!deadStockProdId || !freeProdId) return "";

  const deadStockTitle = bundle.deadStockTitle || bundle.metadata?.deadStockTitle || "Product";
  const freeTitle = bundle.freeProductTitle || bundle.companionTitle || bundle.metadata?.freeProductTitle || "Free Gift";

  const discountId = await createShopifyBOGODiscount(
    cleanShopDomain,
    validToken,
    deadStockProdId,
    freeProdId,
    deadStockTitle,
    freeTitle
  );

  if (discountId) {
    bundle.shopifyDiscountId = discountId;
    if (!bundle.metadata) bundle.metadata = {};
    bundle.metadata.shopifyDiscountId = discountId;
    Bundle.updateOne(
      { _id: bundle._id },
      { $set: { shopifyDiscountId: discountId, "metadata.shopifyDiscountId": discountId } }
    ).catch(() => {});
  }

  return discountId;
}

module.exports = {
  createDeadStockBundle,
  getCompanionProducts,
  deleteDeadStockBundle,
  resolveProductDetails,
  isPlaceholderText,
  createShopifyBOGODiscount,
  deleteShopifyDiscount,
  ensureBOGODiscount,
};
