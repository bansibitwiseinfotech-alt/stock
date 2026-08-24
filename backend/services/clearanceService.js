const shopifyGraphQL = require("./shopifyGraphql");
const DeadStockAction = require("../models/DeadStockAction");
const ClearanceSale = require("../models/ClearanceSale");

// ============================================================
// SHOPIFY GRAPHQL MUTATIONS / QUERIES
// ============================================================

// Create automatic discount
const CREATE_AUTOMATIC_DISCOUNT_MUTATION = `
mutation discountAutomaticBasicCreate(
  $automaticBasicDiscount: DiscountAutomaticBasicInput!
) {
  discountAutomaticBasicCreate(
    automaticBasicDiscount: $automaticBasicDiscount
  ) {
    automaticDiscountNode {
      id
    }

    userErrors {
      field
      message
      code
    }
  }
}
`;

// Delete automatic discount
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

// Find Flash Clearance collection
const FIND_COLLECTION_QUERY = `
query findCollection($query: String!) {
  collections(first: 10, query: $query) {
    nodes {
      id
      title
      handle
    }
  }
}
`;

// Create collection
const CREATE_COLLECTION_MUTATION = `
mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      title
      handle
    }

    userErrors {
      field
      message
      code
    }
  }
}
`;

// Add products to collection
const ADD_PRODUCT_TO_COLLECTION_MUTATION = `
mutation collectionAddProducts(
  $id: ID!
  $productIds: [ID!]!
) {
  collectionAddProducts(
    id: $id
    productIds: $productIds
  ) {
    collection {
      id
      title
    }

    userErrors {
      field
      message
      code
    }
  }
}
`;

const GET_VARIANT_FOR_CLEARANCE_QUERY = `
query clearanceVariant($id: ID!) {
  productVariant(id: $id) {
    id
    price
    product {
      id
      title
    }
  }
}
`;

// ============================================================
// HELPERS
// ============================================================

/**
 * Convert numeric Shopify ID to GID.
 *
 * Example:
 * 123456789
 * =>
 * gid://shopify/Product/123456789
 */
function ensureGid(id, type = "Product") {
  if (!id) {
    return "";
  }

  const value = String(id).trim();

  // Already a Shopify GID
  if (value.startsWith("gid://shopify/")) {
    return value;
  }

  // Numeric Shopify ID
  if (/^\d+$/.test(value)) {
    return `gid://shopify/${type}/${value}`;
  }

  throw new Error(`Invalid Shopify ${type} ID: ${id}`);
}

/**
 * Validate discount percentage.
 */
function validateDiscountPercent(value) {
  const discount = Number(value);

  if (!Number.isFinite(discount)) {
    throw new Error("Discount percentage must be a valid number.");
  }

  if (discount <= 0 || discount > 100) {
    throw new Error("Discount percentage must be between 1 and 100.");
  }

  return discount;
}

/**
 * Convert date safely to ISO.
 */
function toISOStringSafe(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date.toISOString();
}

/**
 * Extract Shopify GraphQL errors.
 */
function extractGraphQLErrors(data) {
  if (!data) {
    return [];
  }

  const errors = [];

  if (Array.isArray(data.errors)) {
    errors.push(...data.errors);
  }

  return errors;
}

function formatActionError(error) {
  if (error?.graphqlErrors?.length) {
    return error.graphqlErrors
      .map((item) => item.message || JSON.stringify(item))
      .join(", ");
  }

  if (error?.response?.data?.errors) {
    return error.response.data.errors
      .map((item) => item.message || JSON.stringify(item))
      .join(", ");
  }

  return error?.message || "Unable to create clearance sale.";
}

async function createClearanceSale(
  shop,
  accessToken,
  { productId, variantId, discountPercent, startDate, endDate, title }
) {
  let formattedProductId = "";
  let formattedVariantId = "";
  let createdDiscountId = "";

  try {
    formattedProductId = ensureGid(productId, "Product");
    formattedVariantId = ensureGid(variantId, "ProductVariant");

    const discount = validateDiscountPercent(discountPercent);
    if (!startDate) {
      throw new Error("Start date is required.");
    }
    const startIso = toISOStringSafe(startDate);
    const startDay = new Date(`${startIso.slice(0, 10)}T00:00:00.000Z`);
    const todayDay = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (startDay < todayDay) {
      throw new Error("Start date cannot be in the past.");
    }
    const endIso = toISOStringSafe(endDate, null);

    if (!endIso || new Date(endIso) <= new Date(startIso)) {
      throw new Error("End date must be after the start date.");
    }

    const variantData = await shopifyGraphQL(
      shop,
      accessToken,
      GET_VARIANT_FOR_CLEARANCE_QUERY,
      { id: formattedVariantId }
    );
    const variant = variantData?.productVariant;

    if (!variant || variant.product?.id !== formattedProductId) {
      throw new Error("The selected product and variant do not belong to this shop.");
    }

    const now = new Date();
    const existingSale = await ClearanceSale.findOne({
      shop,
      $or: [
        { productId: formattedProductId },
        { variantId: formattedVariantId },
      ],
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    });

    if (existingSale?.shopifyDiscountId) {
      await deleteClearanceDiscount(shop, accessToken, existingSale.shopifyDiscountId);
    }

    const result = await createClearanceDiscount(shop, accessToken, {
      productId: formattedProductId,
      variantId: formattedVariantId,
      discountPercent: discount,
      startDate: startIso,
      endDate: endIso,
      title: `${title || `Clearance ${discount}% Off - ${variant.product.title}`} - ${Date.now()}`,
      failureActionType: "CLEARANCE_SALE_CREATED",
    });

    if (!result.success || !result.discountId) {
      throw new Error(result.message || "Shopify did not create the clearance discount.");
    }
    createdDiscountId = result.discountId;

    const status = new Date(startIso) > now ? "SCHEDULED" : "ACTIVE";
    let sale;
    if (existingSale) {
      existingSale.shopifyDiscountId = result.discountId;
      existingSale.discountType = "PERCENTAGE";
      existingSale.discountValue = discount;
      existingSale.originalPrice = variant.price == null ? null : Number(variant.price);
      existingSale.startDate = new Date(startIso);
      existingSale.endDate = new Date(endIso);
      existingSale.status = status;
      existingSale.active = true;
      sale = await existingSale.save();
    } else {
      sale = await ClearanceSale.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        shopifyDiscountId: result.discountId,
        discountType: "PERCENTAGE",
        discountValue: discount,
        originalPrice: variant.price == null ? null : Number(variant.price),
        startDate: new Date(startIso),
        endDate: new Date(endIso),
        status,
        active: true,
      });
    }

    await DeadStockAction.create({
      shop,
      productId: formattedProductId,
      variantId: formattedVariantId,
      actionType: "CLEARANCE_SALE_CREATED",
      status,
      discountPercent: discount,
      shopifyDiscountId: result.discountId,
      discountValue: discount,
      startDate: new Date(startIso),
      endDate: new Date(endIso),
      executedAt: new Date(),
      metadata: {
        clearanceSaleId: sale._id,
        shopifyDiscountId: result.discountId,
        startDate: startIso,
        endDate: endIso,
        isUpdate: Boolean(existingSale),
      },
    });

    return {
      success: true,
      message: `Clearance sale created successfully (${discount}% off).`,
      discountId: result.discountId,
      sale,
      discountPercent: discount,
      startsAt: startIso,
      endsAt: endIso,
    };
  } catch (error) {
    const message = formatActionError(error);

    await ClearanceSale.create({
      shop,
      productId: formattedProductId || String(productId || ""),
      variantId: formattedVariantId || String(variantId || ""),
      shopifyDiscountId: "",
      discountValue: Number(discountPercent) || 0,
      status: "FAILED",
      error: message,
    }).catch(() => {});

    if (createdDiscountId) {
      await deleteClearanceDiscount(shop, accessToken, createdDiscountId);
    }

    await DeadStockAction.create({
      shop,
      productId: formattedProductId || String(productId || ""),
      variantId: formattedVariantId || String(variantId || ""),
      actionType: "CLEARANCE_SALE_CREATED",
      status: "FAILED",
      discountPercent: Number(discountPercent) || 0,
      discountValue: Number(discountPercent) || 0,
      error: message,
    }).catch(() => {});

    return {
      success: false,
      message: message.includes("write_discounts") || message.includes("ACCESS_DENIED")
        ? "Missing Shopify permission: write_discounts. Please reauthorize the app in Shopify Admin."
        : message,
    };
  }
}

// ============================================================
// DELETE PREVIOUS AUTOMATIC DISCOUNT
// ============================================================

/**
 * Deletes a previous automatic discount.
 *
 * This is used by progressive markdown so old discounts
 * don't remain active and conflict with the new discount.
 */
async function deleteClearanceDiscount(
  shop,
  accessToken,
  discountId
) {
  if (!discountId) {
    return {
      success: true,
      deletedId: null,
    };
  }

  try {
    const formattedId = ensureGid(
      discountId,
      "DiscountAutomaticNode"
    );

    const data = await shopifyGraphQL(
      shop,
      accessToken,
      DELETE_AUTOMATIC_DISCOUNT_MUTATION,
      {
        id: formattedId,
      }
    );

    const result = data?.discountAutomaticDelete;

    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      const errorMessage = userErrors
        .map((error) => error.message)
        .join(", ");

      console.warn(
        `[ClearanceService] Delete warning: ${errorMessage}`
      );

      return {
        success: false,
        message: errorMessage,
        userErrors,
      };
    }

    return {
      success: true,
      deletedId:
        result?.deletedAutomaticDiscountId || null,
    };
  } catch (error) {
    console.warn(
      "[ClearanceService] Failed to delete previous discount:",
      error.message
    );

    return {
      success: false,
      message: error.message,
    };
  }
}

async function deleteClearanceSale(shop, accessToken, { productId, variantId }) {
  const formattedProductId = productId ? ensureGid(productId, "Product") : "";
  const formattedVariantId = variantId ? ensureGid(variantId, "ProductVariant") : "";
  const cleanProdNum = formattedProductId ? String(formattedProductId).replace("gid://shopify/Product/", "") : "";
  const cleanVarNum = formattedVariantId ? String(formattedVariantId).replace("gid://shopify/ProductVariant/", "") : "";

  const sale = await ClearanceSale.findOne({
    shop,
    status: { $in: ["SCHEDULED", "ACTIVE"] },
    $or: [
      ...(formattedVariantId ? [{ variantId: formattedVariantId }, { variantId: cleanVarNum }] : []),
      ...(formattedProductId ? [{ productId: formattedProductId }, { productId: cleanProdNum }] : []),
    ],
  });

  if (!sale) return { success: true, message: "No active clearance sale exists for this product." };

  let deleted = { success: true };
  if (sale.shopifyDiscountId) {
    deleted = await deleteClearanceDiscount(shop, accessToken, sale.shopifyDiscountId);
  }

  sale.status = "CANCELLED";
  sale.active = false;
  await sale.save();

  await DeadStockAction.create({
    shop,
    productId: sale.productId || formattedProductId,
    variantId: sale.variantId || formattedVariantId,
    actionType: "CLEARANCE_SALE_CREATED",
    status: "CANCELLED",
    shopifyDiscountId: sale.shopifyDiscountId,
    discountPercent: sale.discountValue,
    discountValue: sale.discountValue,
    startDate: sale.startDate,
    endDate: sale.endDate,
    executedAt: new Date(),
    metadata: { clearanceSaleId: sale._id, deletedAutomaticDiscountId: deleted.deletedId },
  }).catch(() => {});

  return { success: true, message: "Clearance sale deleted successfully." };
}

// ============================================================
// CREATE CLEARANCE DISCOUNT
// ============================================================

/**
 * Creates a REAL Shopify automatic discount.
 *
 * IMPORTANT:
 *
 * Variant targeting MUST use:
 *
 * customerGets: {
 *   items: {
 *     products: {
 *       productVariantsToAdd: [...]
 *     }
 *   }
 * }
 *
 * NOT:
 *
 * items: {
 *   productVariants: {...}
 * }
 */
async function createClearanceDiscount(
  shop,
  accessToken,
  {
    productId,
    variantId,
    discountPercent,
    startDate,
    endDate,
    title,
    previousDiscountId,
    failureActionType = "CLEARANCE",
  }
) {
  let formattedProductId = "";
  let formattedVariantId = "";

  try {
    // --------------------------------------------------------
    // Validate IDs
    // --------------------------------------------------------

    formattedProductId = ensureGid(
      productId,
      "Product"
    );

    if (variantId) {
      formattedVariantId = ensureGid(
        variantId,
        "ProductVariant"
      );
    }

    // --------------------------------------------------------
    // Validate discount
    // --------------------------------------------------------

    const discount = validateDiscountPercent(
      discountPercent
    );

    const percentageValue = discount / 100;

    // --------------------------------------------------------
    // Delete previous discount if provided
    // --------------------------------------------------------

    if (previousDiscountId) {
      await deleteClearanceDiscount(
        shop,
        accessToken,
        previousDiscountId
      );
    }

    // --------------------------------------------------------
    // Dates
    // --------------------------------------------------------

    const startIso = toISOStringSafe(
      startDate,
      new Date().toISOString()
    );

    const endIso = toISOStringSafe(
      endDate,
      null
    );

    // --------------------------------------------------------
    // Discount title
    // --------------------------------------------------------

    const discountTitle =
      title ||
      `Clearance ${discount}% Off - ${new Date().toISOString().split("T")[0]
      }`;

    // --------------------------------------------------------
    // IMPORTANT SHOPIFY INPUT
    // --------------------------------------------------------
    //
    // Variant:
    //
    // items: {
    //   products: {
    //     productVariantsToAdd: [...]
    //   }
    // }
    //
    // Product:
    //
    // items: {
    //   products: {
    //     productsToAdd: [...]
    //   }
    // }
    // --------------------------------------------------------

    let itemsTarget;

    if (formattedVariantId) {
      itemsTarget = {
        products: {
          productVariantsToAdd: [
            formattedVariantId,
          ],
        },
      };
    } else {
      itemsTarget = {
        products: {
          productsToAdd: [
            formattedProductId,
          ],
        },
      };
    }

    // --------------------------------------------------------
    // Shopify variables
    // --------------------------------------------------------

    const automaticBasicDiscount = {
      title: discountTitle,

      startsAt: startIso,

      customerGets: {
        value: {
          percentage: percentageValue,
        },

        items: itemsTarget,
      },
    };

    // Shopify accepts endsAt when supplied
    if (endIso) {
      automaticBasicDiscount.endsAt = endIso;
    }

    const variables = {
      automaticBasicDiscount,
    };

    console.log(
      "[ClearanceService] Creating Shopify discount..."
    );

    console.log(
      "[ClearanceService] Variables:",
      JSON.stringify(
        variables,
        null,
        2
      )
    );

    // --------------------------------------------------------
    // Execute Shopify GraphQL
    // --------------------------------------------------------

    const data = await shopifyGraphQL(
      shop,
      accessToken,
      CREATE_AUTOMATIC_DISCOUNT_MUTATION,
      variables
    );

    // --------------------------------------------------------
    // Top-level GraphQL errors
    // --------------------------------------------------------

    const graphQLErrors =
      extractGraphQLErrors(data);

    if (graphQLErrors.length > 0) {
      const errorMessage =
        graphQLErrors
          .map(
            (error) =>
              error.message ||
              JSON.stringify(error)
          )
          .join(", ");

      await DeadStockAction.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        actionType: failureActionType,
        status: "FAILED",
        discountPercent: discount,
        error: errorMessage,
        metadata: {
          graphQLErrors,
        },
      }).catch(() => { });

      return {
        success: false,
        message: errorMessage,
        errors: graphQLErrors,
      };
    }

    // --------------------------------------------------------
    // Mutation result
    // --------------------------------------------------------

    const result =
      data?.discountAutomaticBasicCreate;

    if (!result) {
      const errorMessage =
        "Shopify returned an empty discount creation response.";

      await DeadStockAction.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        actionType: failureActionType,
        status: "FAILED",
        discountPercent: discount,
        error: errorMessage,
      }).catch(() => { });

      return {
        success: false,
        message: errorMessage,
      };
    }

    // --------------------------------------------------------
    // Shopify userErrors
    // --------------------------------------------------------

    const userErrors =
      result.userErrors || [];

    if (userErrors.length > 0) {
      const errorMessage =
        userErrors
          .map(
            (error) =>
              `${error.field?.join?.(".") || ""} ${error.message
              }`
          )
          .join(", ");

      await DeadStockAction.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        actionType: failureActionType,
        status: "FAILED",
        discountPercent: discount,
        error: errorMessage,
        metadata: {
          userErrors,
        },
      }).catch(() => { });

      return {
        success: false,
        message:
          `Shopify rejected discount creation: ${errorMessage}`,
        userErrors,
      };
    }

    // --------------------------------------------------------
    // Get created discount
    // --------------------------------------------------------

    const discountNode = result.automaticDiscountNode;
    const discountId = discountNode?.id || "";

    if (!discountId) {
      const errorMessage =
        "Shopify did not return the created discount ID.";

      await DeadStockAction.create({
        shop,
        productId: formattedProductId,
        variantId: formattedVariantId,
        actionType: failureActionType,
        status: "FAILED",
        discountPercent: discount,
        error: errorMessage,
      }).catch(() => { });

      return {
        success: false,
        message: errorMessage,
      };
    }

    // --------------------------------------------------------
    // Save successful action
    // --------------------------------------------------------

    await DeadStockAction.create({
      shop,
      productId: formattedProductId,
      variantId: formattedVariantId,
      actionType: "CLEARANCE",
      status: "COMPLETED",
      discountPercent: discount,
      executedAt: new Date(),
      metadata: {
        discountId,
        title: discountTitle,
        startsAt: startIso,
        endsAt: endIso,
        targeting: formattedVariantId ? "VARIANT" : "PRODUCT",
      },
    });

    console.log(
      `[ClearanceService] Discount created successfully: ${discountId}`
    );

    return {
      success: true,
      message: `Clearance sale created successfully (${discount}% off)`,
      discountId,
      discountPercent: discount,
      title: discountTitle,
      status: null,
      startsAt: startIso,
      endsAt: endIso,
    };
  } catch (error) {
    console.error(
      "[ClearanceService] Error creating clearance discount:",
      error
    );

    let errorMessage =
      error.message ||
      "Failed to create clearance discount.";

    // --------------------------------------------------------
    // Permission error
    // --------------------------------------------------------

    if (
      errorMessage.includes(
        "write_discounts"
      ) ||
      errorMessage.includes(
        "ACCESS_DENIED"
      )
    ) {
      errorMessage =
        "Missing Shopify permission: write_discounts. Please reauthorize the app in Shopify Admin.";
    }

    // --------------------------------------------------------
    // Save failed action
    // --------------------------------------------------------

    await DeadStockAction.create({
      shop,

      productId:
        formattedProductId,

      variantId:
        formattedVariantId,

      actionType:
        "CLEARANCE",

      status:
        "FAILED",

      discountPercent:
        Number(discountPercent) || 0,

      error:
        errorMessage,
    }).catch(() => { });

    return {
      success: false,
      message: errorMessage,
    };
  }
}

// ============================================================
// ADD PRODUCT TO FLASH CLEARANCE COLLECTION
// ============================================================

async function addToClearanceCollection(
  shop,
  accessToken,
  {
    productId,
    variantId,
  }
) {
  let formattedProductId = "";

  let formattedVariantId = "";

  try {
    // --------------------------------------------------------
    // Product GID
    // --------------------------------------------------------

    formattedProductId =
      ensureGid(
        productId,
        "Product"
      );

    if (variantId) {
      formattedVariantId =
        ensureGid(
          variantId,
          "ProductVariant"
        );
    }

    // --------------------------------------------------------
    // Find collection
    // --------------------------------------------------------

    console.log(
      "[ClearanceService] Searching Flash Clearance collection..."
    );

    const searchResult =
      await shopifyGraphQL(
        shop,
        accessToken,
        FIND_COLLECTION_QUERY,
        {
          query:
            "title:'Flash Clearance'",
        }
      );

    const collections =
      searchResult?.collections?.nodes ||
      [];

    let collection =
      collections.find(
        (item) =>
          item.title?.toLowerCase() ===
          "flash clearance"
      );

    let collectionId =
      collection?.id;

    // --------------------------------------------------------
    // Create collection if missing
    // --------------------------------------------------------

    if (!collectionId) {
      console.log(
        "[ClearanceService] Creating Flash Clearance collection..."
      );

      const createResult =
        await shopifyGraphQL(
          shop,
          accessToken,
          CREATE_COLLECTION_MUTATION,
          {
            input: {
              title:
                "Flash Clearance",

              descriptionHtml:
                "<p>Limited time clearance deals on excess stock items.</p>",
            },
          }
        );

      const createErrors =
        createResult
          ?.collectionCreate
          ?.userErrors || [];

      if (
        createErrors.length > 0
      ) {
        const errorMessage =
          createErrors
            .map(
              (error) =>
                error.message
            )
            .join(", ");

        throw new Error(
          `Failed to create Flash Clearance collection: ${errorMessage}`
        );
      }

      collectionId =
        createResult
          ?.collectionCreate
          ?.collection
          ?.id;
    }

    if (!collectionId) {
      throw new Error(
        "Unable to obtain Flash Clearance collection ID from Shopify."
      );
    }

    // --------------------------------------------------------
    // Add product
    // --------------------------------------------------------

    console.log(
      `[ClearanceService] Adding product ${formattedProductId} to collection ${collectionId}`
    );

    const addResult =
      await shopifyGraphQL(
        shop,
        accessToken,
        ADD_PRODUCT_TO_COLLECTION_MUTATION,
        {
          id: collectionId,

          productIds: [
            formattedProductId,
          ],
        }
      );

    const addErrors =
      addResult
        ?.collectionAddProducts
        ?.userErrors || [];

    if (addErrors.length > 0) {
      const errorMessage =
        addErrors
          .map(
            (error) =>
              error.message
          )
          .join(", ");

      throw new Error(
        `Failed to add product to Flash Clearance collection: ${errorMessage}`
      );
    }

    // --------------------------------------------------------
    // Save action
    // --------------------------------------------------------

    await DeadStockAction.create({
      shop,

      productId:
        formattedProductId,

      variantId:
        formattedVariantId,

      actionType:
        "CLEARANCE_COLLECTION",

      status:
        "COMPLETED",

      metadata: {
        collectionId,

        collectionName:
          "Flash Clearance",
      },

      executedAt:
        new Date(),
    });

    return {
      success: true,

      message:
        "Product added to Flash Clearance collection successfully.",

      collectionId,
    };
  } catch (error) {
    console.error(
      "[ClearanceService] Error adding to clearance collection:",
      error
    );

    await DeadStockAction.create({
      shop,

      productId:
        formattedProductId,

      variantId:
        formattedVariantId,

      actionType:
        "CLEARANCE_COLLECTION",

      status:
        "FAILED",

      error:
        error.message,
    }).catch(() => { });

    return {
      success: false,

      message:
        error.message ||
        "Failed to add product to Flash Clearance collection.",
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createClearanceSale,
  createClearanceDiscount,

  deleteClearanceDiscount,
  deleteClearanceSale,

  addToClearanceCollection,

  ensureGid,
};