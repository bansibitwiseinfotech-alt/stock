import { data as json } from "react-router";
import { authenticate } from "../shopify.server";

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Mutation: Create an automatic basic discount targeting a collection
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
// GraphQL Query: Fetch products + variants from a collection
// ─────────────────────────────────────────────────────────────────────────────

const GET_COLLECTION_PRODUCTS = `#graphql
  query GetCollectionProducts($collectionId: ID!, $first: Int!, $after: String) {
    collection(id: $collectionId) {
      id
      title
      products(first: $first, after: $after) {
        nodes {
          id
          title
          variants(first: 100) {
            nodes {
              id
              price
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Action handler: POST /app/api/collection-bulk-sale
// ─────────────────────────────────────────────────────────────────────────────

export async function action({ request }) {
  try {
    if (request.method === "DELETE") {
      const { admin, session } = await authenticate.admin(request);
      const body = await request.json().catch(() => ({}));
      const { collectionId, collectionTitle } = body;

      if (!collectionId) {
        return json({ success: false, error: "Collection ID is required." }, { status: 400 });
      }

      const collectionGid = collectionId.startsWith("gid://shopify/Collection/")
        ? collectionId
        : `gid://shopify/Collection/${collectionId}`;

      const shop = session?.shop || "";
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";

      const deleteResponse = await fetch(
        `${backendBaseUrl}/api/dead-stock/collection-sale-records/delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Shop-Domain": shop,
            "X-Shopify-Access-Token": session?.accessToken || "",
          },
          body: JSON.stringify({
            shop,
            collectionId: collectionGid,
            collectionTitle: collectionTitle || "",
          }),
        }
      );

      const deleteResult = await deleteResponse.json().catch(() => ({}));

      if (!deleteResponse.ok || !deleteResult?.success) {
        return json(
          {
            success: false,
            error: deleteResult?.message || "Failed to delete collection sale.",
          },
          { status: 500 }
        );
      }

      return json({
        success: true,
        message: `Collection sale deleted successfully for "${collectionTitle || "selected collection"}".`,
        collectionId: collectionGid,
      });
    }

    const { admin, session } = await authenticate.admin(request);

    const body = await request.json();

    const { collectionId, collectionTitle, discount, duration, startDate } = body;

    // ─── Validate collection ID ──────────────────────────────────────────────
    if (!collectionId) {
      return json({ success: false, error: "Collection ID is required." }, { status: 400 });
    }

    // Ensure the collection ID is a valid Shopify GID
    const collectionGid = collectionId.startsWith("gid://shopify/Collection/")
      ? collectionId
      : `gid://shopify/Collection/${collectionId}`;

    // ─── Validate discount ───────────────────────────────────────────────────
    const discountValue = Number(discount);
    if (!discountValue || discountValue <= 0 || discountValue >= 100) {
      return json(
        { success: false, error: "Discount must be between 1 and 99." },
        { status: 400 }
      );
    }

    // ─── Validate duration ───────────────────────────────────────────────────
    const durationValue = Number(duration);
    if (!durationValue || durationValue <= 0) {
      return json(
        { success: false, error: "Duration must be greater than 0." },
        { status: 400 }
      );
    }

    // ─── Validate start date ─────────────────────────────────────────────────
    if (!startDate) {
      return json(
        { success: false, error: "Start date is required." },
        { status: 400 }
      );
    }

    // Use UTC to avoid timezone issues
    const start = new Date(`${startDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      return json(
        { success: false, error: "Invalid start date format." },
        { status: 400 }
      );
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + durationValue);

    // Verify end is after start
    if (end <= start) {
      return json(
        { success: false, error: "End date must be after start date." },
        { status: 400 }
      );
    }

    // ─── Build mutation variables ────────────────────────────────────────────
    // NOTE: DiscountAutomaticBasicInput does NOT have a `customerSelection` field.
    // Automatic basic discounts apply to ALL customers by default.
    // The collection targeting is handled entirely via customerGets.items.collections.

    const variables = {
      automaticBasicDiscount: {
        title: `${collectionTitle || "Collection"} - ${discountValue}% Clearance`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        customerGets: {
          value: {
            percentage: discountValue / 100, // Shopify expects decimal: 20% → 0.20
          },
          items: {
            collections: {
              add: [collectionGid],
            },
          },
        },
        combinesWith: {
          productDiscounts: false,
          orderDiscounts: false,
          shippingDiscounts: true,
        },
      },
    };

    // ─── Execute GraphQL mutation ────────────────────────────────────────────
    const response = await admin.graphql(CREATE_COLLECTION_DISCOUNT, { variables });
    const result = await response.json();

    // Handle top-level GraphQL errors
    if (result.errors) {
      console.error("Shopify GraphQL errors:", JSON.stringify(result.errors, null, 2));

      const messages = result.errors.map((e) => e.message).join("; ");
      return json(
        { success: false, error: `Shopify API error: ${messages}` },
        { status: 500 }
      );
    }

    // Handle Shopify userErrors
    const payload = result?.data?.discountAutomaticBasicCreate;

    if (payload?.userErrors?.length) {
      console.error("Shopify discount userErrors:", JSON.stringify(payload.userErrors, null, 2));

      const messages = payload.userErrors.map((e) => e.message).join("; ");
      return json(
        { success: false, error: messages, userErrors: payload.userErrors },
        { status: 400 }
      );
    }

    // ─── Discount created successfully ───────────────────────────────────────
    const discountNode = payload?.automaticDiscountNode;
    const createdDiscount = discountNode?.automaticDiscount;
    const discountId = discountNode?.id || null;

    console.log(`[CollectionBulkSale] Shopify discount created: ${discountId}`);

    // ─── Fetch collection products + variants for storefront records ─────────
    // The storefront widget (clearance_sale.liquid) relies on ClearanceSale
    // MongoDB records to display the badge. We query the collection's products
    // and then save records via the Express backend.

    let collectionVariants = [];
    try {
      collectionVariants = await fetchCollectionVariants(admin, collectionGid);
      console.log(
        `[CollectionBulkSale] Found ${collectionVariants.length} variants in collection "${collectionTitle}"`
      );
    } catch (fetchError) {
      console.error("[CollectionBulkSale] Failed to fetch collection products:", fetchError.message);
    }

    // ─── Save ClearanceSale records via Express backend ──────────────────────
    let savedCount = 0;
    let saveWarning = null;

    if (collectionVariants.length === 0) {
      saveWarning = "No products found in the collection. Storefront badges will not appear.";
      return json(
        {
          success: false,
          error: saveWarning,
          discountId,
          title: createdDiscount?.title || null,
          collectionId: collectionGid,
          collectionTitle,
          discount: discountValue,
          duration: durationValue,
          startDate: start.toISOString(),
          endsAt: end.toISOString(),
          savedCount: 0,
          warning: saveWarning,
        },
        { status: 500 }
      );
    }

    try {
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
      const shop = session?.shop || "";

      const saveResponse = await fetch(
        `${backendBaseUrl}/api/dead-stock/collection-sale-records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Shop-Domain": shop,
            "X-Shopify-Access-Token": session?.accessToken || "",
          },
          body: JSON.stringify({
            shop,
            accessToken: session?.accessToken || "",
            shopifyDiscountId: discountId,
            collectionId: collectionGid,
            collectionTitle: collectionTitle || "",
            discountValue,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            variants: collectionVariants,
          }),
        }
      );

      const saveResult = await saveResponse.json().catch(() => ({}));

      if (!saveResponse.ok || !saveResult?.success) {
        saveWarning = saveResult?.message || "Failed to save storefront sale records.";
        console.error("[CollectionBulkSale] Save records failed:", saveWarning);
        return json(
          {
            success: false,
            error: saveWarning,
            discountId,
            title: createdDiscount?.title || null,
            collectionId: collectionGid,
            collectionTitle,
            discount: discountValue,
            duration: durationValue,
            startDate: start.toISOString(),
            endsAt: end.toISOString(),
            savedCount: 0,
            warning: saveWarning,
          },
          { status: 500 }
        );
      }

      savedCount = saveResult.savedCount || 0;
      console.log(`[CollectionBulkSale] Saved ${savedCount} ClearanceSale records to MongoDB`);
    } catch (saveError) {
      saveWarning = saveError.message || "Failed to save storefront sale records.";
      console.error("[CollectionBulkSale] Save records error:", saveWarning);
      return json(
        {
          success: false,
          error: saveWarning,
          discountId,
          title: createdDiscount?.title || null,
          collectionId: collectionGid,
          collectionTitle,
          discount: discountValue,
          duration: durationValue,
          startDate: start.toISOString(),
          endsAt: end.toISOString(),
          savedCount: 0,
          warning: saveWarning,
        },
        { status: 500 }
      );
    }

    // ─── Success response ────────────────────────────────────────────────────
    return json({
      success: true,
      message: "Collection sale created successfully.",
      discountId,
      title: createdDiscount?.title || null,
      collectionId: collectionGid,
      collectionTitle,
      discount: discountValue,
      duration: durationValue,
      startDate: start.toISOString(),
      endsAt: end.toISOString(),
      savedCount,
      warning: saveWarning || null,
    });
  } catch (error) {
    console.error("Collection bulk sale error:", error);

    return json(
      { success: false, error: error?.message || "Unable to create collection sale." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fetch all product variants from a collection (paginated)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCollectionVariants(admin, collectionGid) {
  const allVariants = [];
  let hasNextPage = true;
  let cursor = null;
  const PAGE_SIZE = 50;

  while (hasNextPage) {
    const response = await admin.graphql(GET_COLLECTION_PRODUCTS, {
      variables: {
        collectionId: collectionGid,
        first: PAGE_SIZE,
        after: cursor,
      },
    });

    const result = await response.json();
    const collection = result?.data?.collection;

    if (!collection) {
      console.warn("[CollectionBulkSale] Collection not found:", collectionGid);
      break;
    }

    const products = collection.products?.nodes || [];

    for (const product of products) {
      const variants = product.variants?.nodes || [];

      for (const variant of variants) {
        allVariants.push({
          productId: product.id,
          productTitle: product.title,
          variantId: variant.id,
          price: variant.price,
        });
      }
    }

    hasNextPage = collection.products?.pageInfo?.hasNextPage || false;
    cursor = collection.products?.pageInfo?.endCursor || null;
  }

  return allVariants;
}
