import { data as json } from "react-router";
import { authenticate } from "../shopify.server";

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SHOPIFY COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTIONS_QUERY = `#graphql
  query GetCollections($first: Int!) {
    collections(first: $first) {
      nodes {
        id
        title
        handle

        productsCount {
          count
          precision
        }
      }
    }
  }
`;

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(
      COLLECTIONS_QUERY,
      {
        variables: {
          first: 250,
        },
      }
    );

    const result = await response.json();

    if (result.errors) {
      console.error(
        "Shopify collections query error:",
        result.errors
      );

      return json(
        {
          success: false,
          error: "Unable to load Shopify collections",
          collections: [],
        },
        {
          status: 500,
        }
      );
    }

    const collections =
      result?.data?.collections?.nodes?.map(
        (collection) => ({
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          productsCount:
            collection.productsCount?.count ?? 0, 
        })
      ) || [];

    return json({
      success: true,
      collections,
    });
  } catch (error) {
    console.error(
      "Collections loader error:",
      error
    );

    return json(
      {
        success: false,
        error: "Something went wrong",
        collections: [],
      },
      {
        status: 500,
      }
    );
  }
}