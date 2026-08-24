const axios = require("axios");

async function shopifyGraphQL(
  shop,
  accessToken,
  query,
  variables = {}
) {
  if (!shop) {
    throw new Error("Shop domain is required.");
  }

  if (!accessToken) {
    throw new Error("Shopify access token is required.");
  }

  const apiVersion =
    process.env.SHOPIFY_API_VERSION || "2026-07";

  const response = await axios.post(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      query,
      variables,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      timeout: 30000,
    }
  );

  if (response.data?.errors?.length) {
    console.error(
      "Shopify GraphQL Errors:",
      response.data.errors
    );

    throw new Error(
      response.data.errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  if (response.data?.data == null) {
    throw new Error(
      "Shopify GraphQL returned no data."
    );
  }

  return response.data.data;
}

module.exports = shopifyGraphQL;