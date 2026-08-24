const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";

async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
    const response = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.errors?.[0]?.message || "Shopify API request failed"
        );
    }

    if (data.errors?.length) {
        throw new Error(data.errors[0].message);
    }

    return data.data;
}

/**
 * Get product + variants
 */
async function getProduct(shop, accessToken, productId) {
    const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        description
        featuredImage {
          url
        }
        variants(first: 20) {
          nodes {
            id
            title
            price
            inventoryQuantity
          }
        }
      }
    }
  `;

    const data = await shopifyGraphQL(shop, accessToken, query, {
        id: productId,
    });

    if (!data.product) {
        throw new Error("Product not found in Shopify");
    }

    return data.product;
}

/**
 * Create Shopify bundle product.
 *
 * We create a normal Shopify product and store the
 * two source products inside metafields.
 */
async function createBundleProduct({
    shop,
    accessToken,
    bundleName,
    deadStockProduct,
    deadStockVariant,
    companionProduct,
    companionVariant,
    discountPercent,
}) {
    const deadStockPrice = Number(deadStockVariant.price || 0);
    const companionPrice = Number(companionVariant.price || 0);

    const originalPrice = deadStockPrice + companionPrice;

    const bundlePrice =
        originalPrice - originalPrice * (Number(discountPercent) / 100);

    const mutation = `
    mutation CreateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          status
          variants(first: 1) {
            nodes {
              id
              price
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const variables = {
        product: {
            title: bundleName,

            descriptionHtml: `
        <h3>${escapeHtml(bundleName)}</h3>

        <p>
          Save ${Number(discountPercent)}% when you purchase
          these products together.
        </p>

        <ul>
          <li>${escapeHtml(deadStockProduct.title)}</li>
          <li>${escapeHtml(companionProduct.title)}</li>
        </ul>
      `,

            status: "ACTIVE",

            metafields: [
                {
                    namespace: "dead_stock_bundle",
                    key: "is_bundle",
                    type: "boolean",
                    value: "true",
                },
                {
                    namespace: "dead_stock_bundle",
                    key: "discount_percent",
                    type: "number_integer",
                    value: String(Math.round(discountPercent)),
                },
                {
                    namespace: "dead_stock_bundle",
                    key: "dead_stock_product_id",
                    type: "single_line_text_field",
                    value: deadStockProduct.id,
                },
                {
                    namespace: "dead_stock_bundle",
                    key: "dead_stock_variant_id",
                    type: "single_line_text_field",
                    value: deadStockVariant.id,
                },
                {
                    namespace: "dead_stock_bundle",
                    key: "companion_product_id",
                    type: "single_line_text_field",
                    value: companionProduct.id,
                },
                {
                    namespace: "dead_stock_bundle",
                    key: "companion_variant_id",
                    type: "single_line_text_field",
                    value: companionVariant.id,
                },
            ],
        },
    };

    const data = await shopifyGraphQL(
        shop,
        accessToken,
        mutation,
        variables
    );

    const result = data.productCreate;

    if (result.userErrors?.length) {
        throw new Error(
            result.userErrors.map((e) => e.message).join(", ")
        );
    }

    const product = result.product;

    if (!product) {
        throw new Error("Shopify did not return created bundle product");
    }

    const variant = product.variants.nodes[0];

    if (!variant) {
        throw new Error("Bundle variant was not created");
    }

    /**
     * Set bundle price.
     */
    const priceMutation = `
    mutation UpdateVariant(
      $productId: ID!,
      $variants: [ProductVariantsBulkInput!]!
    ) {
      productVariantsBulkUpdate(
        productId: $productId
        variants: $variants
      ) {
        productVariants {
          id
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const priceData = await shopifyGraphQL(
        shop,
        accessToken,
        priceMutation,
        {
            productId: product.id,
            variants: [
                {
                    id: variant.id,
                    price: bundlePrice.toFixed(2),
                },
            ],
        }
    );

    const priceErrors =
        priceData.productVariantsBulkUpdate?.userErrors || [];

    if (priceErrors.length) {
        throw new Error(
            priceErrors.map((e) => e.message).join(", ")
        );
    }

    return {
        productId: product.id,
        variantId: variant.id,
        handle: product.handle,
        originalPrice,
        bundlePrice,
        discountPercent,
    };
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

module.exports = {
    getProduct,
    createBundleProduct,
};