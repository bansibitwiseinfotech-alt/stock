module.exports = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET,
  appUrl: process.env.SHOPIFY_APP_URL,
  apiVersion: process.env.SHOPIFY_API_VERSION || "2026-07",
  scopes: (process.env.SHOPIFY_SCOPES || "read_products,read_inventory,read_orders").split(","),
};
