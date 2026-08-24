const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

async function shopifyGraphql({
  shop,
  accessToken,
  query,
  variables = {},
}) {
  if (!shop || !accessToken) {
    const err = new Error("Shopify authentication required: shop domain or accessToken missing");
    err.status = 401;
    throw err;
  }

  const cleanShop = String(shop).trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const endpoint = `https://${cleanShop}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
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

  if (response.status === 401) {
    const err = new Error("Shopify authentication failed: invalid or expired access token.");
    err.status = 401;
    throw err;
  }

  if (response.status === 403) {
    const err = new Error("Shopify permission error: required access scope missing.");
    err.status = 403;
    throw err;
  }

  if (response.status === 429) {
    const err = new Error("Shopify API rate limit exceeded. Please retry in a moment.");
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`Shopify API HTTP error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    throw err;
  }

  const body = await response.json();

  if (body.errors?.length) {
    const firstError = body.errors[0];
    const errMsg = firstError?.message || JSON.stringify(body.errors);
    const err = new Error(`Shopify GraphQL error: ${errMsg}`);
    err.graphqlErrors = body.errors;
    throw err;
  }

  return body.data;
}

module.exports = {
  shopifyGraphql,
};