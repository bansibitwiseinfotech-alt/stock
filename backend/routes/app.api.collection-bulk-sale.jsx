import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE AUTOMATIC COLLECTION DISCOUNT
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_COLLECTION_DISCOUNT = `#graphql
  mutation CreateCollectionDiscount(
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
                  collections(first: 10) {
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

// ─────────────────────────────────────────────────────────────────────────────
// POST / ACTION
// ─────────────────────────────────────────────────────────────────────────────

export async function action({ request }) {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // Shopify Admin authentication
    // ───────────────────────────────────────────────────────────────────────────

    const { admin } = await authenticate.admin(request);

    // ───────────────────────────────────────────────────────────────────────────
    // Read request body
    // ───────────────────────────────────────────────────────────────────────────

    const body = await request.json();

    const {
      collectionId,
      collectionTitle,
      discount,
      duration,
      startDate,
    } = body;

    // ───────────────────────────────────────────────────────────────────────────
    // Validation: Collection
    // ───────────────────────────────────────────────────────────────────────────

    if (!collectionId) {
      return json(
        {
          success: false,
          error: "Collection ID is required.",
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Validation: Discount
    // ───────────────────────────────────────────────────────────────────────────

    const discountValue = Number(discount);

    if (
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      discountValue >= 100
    ) {
      return json(
        {
          success: false,
          error: "Discount must be between 1 and 99.",
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Validation: Duration
    // ───────────────────────────────────────────────────────────────────────────

    const durationValue = Number(duration);

    if (
      !Number.isFinite(durationValue) ||
      durationValue <= 0
    ) {
      return json(
        {
          success: false,
          error: "Duration must be greater than 0.",
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Validation: Start Date
    // ───────────────────────────────────────────────────────────────────────────

    if (!startDate) {
      return json(
        {
          success: false,
          error: "Start date is required.",
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Create start date
    // ───────────────────────────────────────────────────────────────────────────

    const start = new Date(`${startDate}T00:00:00`);

    if (Number.isNaN(start.getTime())) {
      return json(
        {
          success: false,
          error: "Invalid start date.",
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Create end date
    // ───────────────────────────────────────────────────────────────────────────

    const end = new Date(start);

    end.setDate(
      end.getDate() + durationValue
    );

    // ───────────────────────────────────────────────────────────────────────────
    // UNIQUE DISCOUNT TITLE
    //
    // Shopify automatic discount titles must be unique.
    // Using timestamp + random to ensure uniqueness across rapid requests.
    //
    // Example:
    // Samsung Galaxy Collection - 20% Clearance - 1723718400-9876-5432
    // ───────────────────────────────────────────────────────────────────────────

    const timestamp = Date.now();
    const randomNum1 = Math.floor(Math.random() * 10000);
    const randomNum2 = Math.floor(Math.random() * 10000);
    const uniqueId = `${timestamp}-${randomNum1}-${randomNum2}`;

    const uniqueTitle =
      `${collectionTitle || "Collection"} - ${discountValue}% Clearance - ${uniqueId}`;

    console.log(
      "Creating Shopify automatic discount:",
      {
        title: uniqueTitle,
        collectionId,
        collectionTitle,
        discount: discountValue,
        duration: durationValue,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }
    );

    // ───────────────────────────────────────────────────────────────────────────
    // Shopify automatic discount variables
    // ───────────────────────────────────────────────────────────────────────────

    const variables = {
      automaticBasicDiscount: {
        title: uniqueTitle,

        startsAt: start.toISOString(),

        endsAt: end.toISOString(),

        customerGets: {
          value: {
            percentage: discountValue / 100,
          },

          items: {
            collections: {
              add: [
                collectionId,
              ],
            },
          },
        },

        // Apply discount to all customers
        customerSelection: {
          all: true,
        },

        // Discount combination settings
        combinesWith: {
          productDiscounts: false,
          orderDiscounts: false,
          shippingDiscounts: true,
        },
      },
    };

    // ───────────────────────────────────────────────────────────────────────────
    // Create Shopify automatic discount
    // ───────────────────────────────────────────────────────────────────────────

    const response = await admin.graphql(
      CREATE_COLLECTION_DISCOUNT,
      {
        variables,
      }
    );

    const result = await response.json();

    // ───────────────────────────────────────────────────────────────────────────
    // Shopify GraphQL errors
    // ───────────────────────────────────────────────────────────────────────────

    if (result.errors) {
      console.error(
        "Shopify GraphQL errors:",
        result.errors
      );

      return json(
        {
          success: false,
          error: "Shopify GraphQL error.",
          details: result.errors,
        },
        { status: 500 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Shopify user errors
    // ───────────────────────────────────────────────────────────────────────────

    const payload =
      result?.data?.discountAutomaticBasicCreate;

    if (!payload) {
      console.error(
        "Missing discount creation payload:",
        result
      );

      return json(
        {
          success: false,
          error:
            "Shopify did not return a discount creation response.",
          details: result,
        },
        { status: 500 }
      );
    }

    if (
      payload.userErrors &&
      payload.userErrors.length > 0
    ) {
      console.error(
        "Shopify discount user errors:",
        payload.userErrors
      );

      return json(
        {
          success: false,

          error: payload.userErrors
            .map(
              (error) =>
                error.message
            )
            .join(", "),

          userErrors:
            payload.userErrors,
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Get created discount
    // ───────────────────────────────────────────────────────────────────────────

    const discountNode =
      payload.automaticDiscountNode;

    if (!discountNode?.id) {
      console.error(
        "Discount was created but no discount ID was returned:",
        payload
      );

      return json(
        {
          success: false,
          error:
            "Discount creation completed but Shopify did not return a discount ID.",
          details: payload,
        },
        { status: 500 }
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // SUCCESS
    // ───────────────────────────────────────────────────────────────────────────

    console.log(
      "Collection clearance sale created successfully:",
      {
        discountId: discountNode.id,
        title: uniqueTitle,
        collectionId,
      }
    );

    return json({
      success: true,

      message:
        "Collection sale created successfully.",

      discountId:
        discountNode.id,

      discountTitle:
        uniqueTitle,

      collectionId,

      collectionTitle,

      discount:
        discountValue,

      duration:
        durationValue,

      startDate:
        start.toISOString(),

      endDate:
        end.toISOString(),
    });
  } catch (error) {
    // ───────────────────────────────────────────────────────────────────────────
    // Unexpected error
    // ───────────────────────────────────────────────────────────────────────────

    console.error(
      "Collection bulk sale error:",
      error
    );

    return json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to create collection sale.",
      },
      { status: 500 }
    );
  }
}