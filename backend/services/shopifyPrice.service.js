const SHOPIFY_API_VERSION =
    process.env.SHOPIFY_API_VERSION || "2026-07";

function toShopifyGid(type, id) {
    if (!id) {
        throw new Error(`${type} ID is required`);
    }

    if (String(id).startsWith("gid://shopify/")) {
        return id;
    }

    return `gid://shopify/${type}/${id}`;
}

async function shopifyGraphQL({
    shop,
    accessToken,
    query,
    variables = {},
}) {
    if (!shop) {
        throw new Error("Shop is required");
    }

    if (!accessToken) {
        throw new Error("Shopify access token is missing");
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            body?.errors?.[0]?.message ||
            `Shopify API request failed with status ${response.status}`
        );
    }

    if (body.errors?.length) {
        throw new Error(
            body.errors.map((error) => error.message).join(", ")
        );
    }

    return body.data;
}

/**
 * Fetch current Shopify variant information.
 */
async function getVariant({
    shop,
    accessToken,
    variantId,
}) {
    const query = `
    query GetProductVariant($id: ID!) {
      productVariant(id: $id) {
        id
        price
        compareAtPrice
        availableForSale
        inventoryQuantity
        product {
          id
        }
      }
    }
  `;

    const data = await shopifyGraphQL({
        shop,
        accessToken,
        query,
        variables: {
            id: toShopifyGid("ProductVariant", variantId),
        },
    });

    if (!data.productVariant) {
        throw new Error("Shopify product variant not found");
    }

    return data.productVariant;
}

/**
 * Update actual Shopify variant price.
 */
async function updateVariantPrice({
    shop,
    accessToken,
    productId,
    variantId,
    price,
}) {
    const query = `
    mutation UpdateProductVariantPrice(
      $productId: ID!
      $variants: [ProductVariantsBulkInput!]!
    ) {
      productVariantsBulkUpdate(
        productId: $productId
        variants: $variants
      ) {
        productVariants {
          id
          price
          compareAtPrice
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

    const data = await shopifyGraphQL({
        shop,
        accessToken,
        query,
        variables: {
            productId: toShopifyGid("Product", productId),

            variants: [
                {
                    id: toShopifyGid("ProductVariant", variantId),
                    price: Number(price).toFixed(2),
                },
            ],
        },
    });

    const result = data.productVariantsBulkUpdate;

    if (result.userErrors?.length) {
        throw new Error(
            result.userErrors
                .map((error) => {
                    const field = error.field
                        ? `${error.field.join(".")}: `
                        : "";

                    return `${field}${error.message}`;
                })
                .join(", ")
        );
    }

    if (!result.productVariants?.length) {
        throw new Error(
            "Shopify did not return the updated product variant"
        );
    }

    return result.productVariants[0];
}

module.exports = {
    getVariant,
    updateVariantPrice,
    shopifyGraphQL,
};
