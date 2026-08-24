// ─────────────────────────────────────────────────────────────────────────────
// deadStockApi.js  — Frontend service layer for Dead Stock module
//
// All API calls go through the Remix/React Router frontend proxy routes
// (e.g. /api/dead-stock/store-products) which authenticate with Shopify
// session before forwarding to the backend. This means the frontend never
// directly calls the backend Express server.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/store-products
//
// Shopify GraphQL cursor-paginated product listing.
//
// Parameters:
//   shop    — Shopify store domain
//   search  — optional title search string (server-side via Shopify GraphQL)
//   token   — Shopify access token (for header)
//   limit   — products per page (default 50, max 250)
//   cursor  — Shopify endCursor from previous page (null = first page)
//
// Returns:
//   {
//     success, data,
//     pagination: { limit, hasNextPage, hasPreviousPage, nextCursor, previousCursor }
//   }
//
// Architecture:
//   Page 1: cursor=null   → Shopify returns first 50 + endCursor
//   Page 2: cursor=endCursor → Shopify returns next 50 + endCursor
//   ...supports 100,000+ products without loading full catalog
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStoreProducts({
  shop = "",
  search = "",
  token = "",
  limit = 50,
  cursor = null,
} = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";

  if (!targetShop) throw new Error("Shop domain is missing.");

  const params = new URLSearchParams();
  params.set("shop", targetShop);
  params.set("limit", String(limit));
  if (search && search.trim()) params.set("search", search.trim());
  if (cursor) params.set("cursor", cursor);

  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-Shopify-Access-Token"] = token;

  const res = await fetch(`/api/dead-stock/store-products?${params.toString()}`, { headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || `Store Products API Error: ${res.statusText}`);
  }
  return json; // { success, data, pagination }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/summary  — MongoDB dead-stock aggregate
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDeadStockSummary(shop = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const res = await fetch(`/api/dead-stock/summary?shop=${encodeURIComponent(targetShop)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Summary API Error: ${res.statusText}`);
  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock  — MongoDB dead-stock list (offset-paginated)
// Used only in Dead Stock Mode (showStoreProducts = false)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDeadStockProducts({
  shop = "",
  days = "60",
  locationId = "all",
  collectionId = "all",
  search = "",
  page = 1,
  limit = 10,
} = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const params = new URLSearchParams();
  if (targetShop) params.set("shop", targetShop);
  if (days && days !== "all") params.set("days", days);
  if (locationId && locationId !== "all") params.set("locationId", locationId);
  if (collectionId && collectionId !== "all") params.set("collectionId", collectionId);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));

  const res = await fetch(`/api/dead-stock?${params.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Products API Error: ${res.statusText}`);
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/sync
// ─────────────────────────────────────────────────────────────────────────────
export async function syncDeadStockData(shop = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const res = await fetch(`/api/dead-stock/sync?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Sync failed: ${res.statusText}`);
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — extracts and encodes a clean product/variant ID
// ─────────────────────────────────────────────────────────────────────────────
function getDeadStockId(id, actionName = "dead stock request") {
  const value = String(id || "").trim();
  if (!value) throw new Error(`Missing variant or product ID for ${actionName}.`);
  const cleanId = value
    .replace("gid://shopify/ProductVariant/", "")
    .replace("gid://shopify/Product/", "");
  if (!cleanId) throw new Error(`Missing variant or product ID for ${actionName}.`);
  return encodeURIComponent(cleanId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDeadStockVariantDetail(shop = "", variantId = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(variantId, "fetch dead stock variant detail");
  const res = await fetch(`/api/dead-stock/${cleanId}?shop=${encodeURIComponent(targetShop)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Product Detail Error: ${res.statusText}`);
  return json.product || json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/clearance
// ─────────────────────────────────────────────────────────────────────────────
export async function executeClearanceSale(shop = "", productId = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "create clearance sale");
  const res = await fetch(`/api/dead-stock/${cleanId}/clearance?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to create clearance sale");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/dead-stock/:variantId/clearance
// ─────────────────────────────────────────────────────────────────────────────
export async function executeDeleteClearanceSale(shop = "", productId = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "delete clearance sale");
  const res = await fetch(`/api/dead-stock/${cleanId}/clearance?shop=${encodeURIComponent(targetShop)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete clearance sale");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/collection
// ─────────────────────────────────────────────────────────────────────────────
export async function executeAddToCollection(shop = "", productId = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "add to clearance collection");
  const res = await fetch(`/api/dead-stock/${cleanId}/collection?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to add product to Flash Clearance collection");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/markdown
// ─────────────────────────────────────────────────────────────────────────────
export async function executeProgressiveMarkdown(shop = "", productId = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "create progressive markdown");
  const res = await fetch(`/api/dead-stock/${cleanId}/markdown?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to enable progressive markdown");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/dead-stock/:variantId/markdown
// ─────────────────────────────────────────────────────────────────────────────
export async function executeStopProgressiveMarkdown(shop = "", productId = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "stop progressive markdown");
  const res = await fetch(`/api/dead-stock/${cleanId}/markdown?shop=${encodeURIComponent(targetShop)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to stop progressive markdown");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/:variantId/bundle
// ─────────────────────────────────────────────────────────────────────────────
export async function executeCreateBundle(shop = "", productId = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "create bundle");
  const res = await fetch(`/api/dead-stock/${cleanId}/bundle?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to create dead stock bundle");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/dead-stock/:variantId/bundle
// ─────────────────────────────────────────────────────────────────────────────
export async function executeDeleteBundle(shop = "", productId = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "delete bundle");
  const res = await fetch(`/api/dead-stock/${cleanId}/bundle?shop=${encodeURIComponent(targetShop)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete bundle");
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId/companion-products
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCompanionProducts(shop = "", productId = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "fetch companion products");
  const res = await fetch(`/api/dead-stock/${cleanId}/companion-products?shop=${encodeURIComponent(targetShop)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Failed to fetch companion products");
  return json.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dead-stock/:variantId/actions
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchProductActions(shop = "", productId = "") {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const cleanId = getDeadStockId(productId, "fetch product actions");
  const res = await fetch(`/api/dead-stock/${cleanId}/actions?shop=${encodeURIComponent(targetShop)}`);
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dead-stock/bulk-sale
// ─────────────────────────────────────────────────────────────────────────────
export async function executeBulkSale(shop = "", payload = {}) {
  const targetShop = shop || new URLSearchParams(window.location.search).get("shop") || "";
  const res = await fetch(`/api/dead-stock/bulk-sale?shop=${encodeURIComponent(targetShop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop: targetShop, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to create bulk clearance sale");
  return json;
}