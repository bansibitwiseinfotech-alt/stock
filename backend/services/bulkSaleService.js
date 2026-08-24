const shopifyGraphQL = require("./shopifyGraphql");
const DeadStockAction = require("../models/DeadStockAction");

const CREATE_COLLECTION_SALE_MUTATION = `
  mutation CreateCollectionSale(
    $automaticBasicDiscount: DiscountAutomaticBasicInput!
  ) {
    discountAutomaticBasicCreate(
      automaticBasicDiscount: $automaticBasicDiscount
    ) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            startsAt
            endsAt

            customerGets {
              value {
                ... on DiscountPercentage {
                  percentage
                }
              }

              items {
                ... on DiscountCollections {
                  collections(first: 20) {
                    nodes {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
        }
      }

      userErrors {
        field
        code
        message
      }
    }
  }
`;

function ensureCollectionGid(collectionId) {
  if (!collectionId) {
    throw new Error("Collection ID is required.");
  }

  if (String(collectionId).startsWith("gid://shopify/Collection/")) {
    return String(collectionId);
  }

  return `gid://shopify/Collection/${collectionId}`;
}

function validateDate(dateValue) {
  if (!dateValue) {
    throw new Error("Start date is required.");
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid start date.");
  }

  return date;
}

async function createCollectionSale({
  shop,
  accessToken,
  collectionId,
  collectionTitle,
  discountPercent,
  durationDays,
  startDate,
}) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!accessToken) {
    throw new Error("Shopify access token is required.");
  }

  const discount = Number(discountPercent);
  const duration = Number(durationDays);

  if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
    throw new Error(
      "Discount must be greater than 0 and no more than 100%."
    );
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Duration must be greater than 0 days.");
  }

  const start = validateDate(startDate);

  // Prevent past dates
  const now = new Date();

  if (start < now) {
    throw new Error("Start date cannot be in the past.");
  }

  const end = new Date(start);

  end.setDate(end.getDate() + duration);

  const collectionGid = ensureCollectionGid(collectionId);

  const title = collectionTitle
    ? `Dead Stock - ${collectionTitle} - ${discount}% Off`
    : `Dead Stock Collection Sale - ${discount}% Off`;

  const variables = {
    automaticBasicDiscount: {
      title,

      startsAt: start.toISOString(),

      endsAt: end.toISOString(),

      customerGets: {
        value: {
          percentage: discount / 100,
        },

        items: {
          collections: {
            add: [collectionGid],
          },
        },
      },
    },
  };

  try {
    const data = await shopifyGraphQL(
      shop,
      accessToken,
      CREATE_COLLECTION_SALE_MUTATION,
      variables
    );

    const result = data.discountAutomaticBasicCreate;

    if (!result) {
      throw new Error(
        "Shopify did not return a discount creation response."
      );
    }

    if (result.userErrors?.length) {
      const message = result.userErrors
        .map((error) => {
          const field = error.field
            ? `${error.field.join(".")}: `
            : "";

          return `${field}${error.message}`;
        })
        .join(", ");

      throw new Error(message);
    }

    const discountNode = result.automaticDiscountNode;

    if (!discountNode?.id) {
      throw new Error(
        "Shopify discount was not created."
      );
    }

    // Log successful action
    try {
      await DeadStockAction.create({
        shopId: shop,

        actionType: "BULK_COLLECTION_CLEARANCE_SALE",

        status: "COMPLETED",

        metadata: {
          collectionId: collectionGid,
          collectionTitle: collectionTitle || "",
          discountPercent: discount,
          durationDays: duration,
          startDate: start.toISOString(),
          endsAt: end.toISOString(),
          discountId: discountNode.id,
        },
      });
    } catch (logError) {
      console.error(
        "Bulk collection sale action log failed:",
        logError.message
      );
    }

    return {
      success: true,

      discountId: discountNode.id,

      collectionId: collectionGid,

      collectionTitle: collectionTitle || "",

      discountPercent: discount,

      durationDays: duration,

      startsAt: start.toISOString(),

      endsAt: end.toISOString(),
    };
  } catch (error) {
    // Log failed action
    try {
      await DeadStockAction.create({
        shopId: shop,

        actionType: "BULK_COLLECTION_CLEARANCE_SALE",

        status: "FAILED",

        metadata: {
          collectionId: collectionGid,
          collectionTitle: collectionTitle || "",
          discountPercent: discount,
          durationDays: duration,
          startDate: start.toISOString(),
          error: error.message,
        },

        error: error.message,
      });
    } catch (logError) {
      console.error(
        "Failed action logging error:",
        logError.message
      );
    }

    throw error;
  }
}

module.exports = {
  createCollectionSale,
};