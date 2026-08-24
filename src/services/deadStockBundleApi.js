// ─────────────────────────────────────────────────────────────────────────────
// deadStockBundleApi.js — Frontend API service for Dead Stock BOGO Bundles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new Dead Stock BOGO Bundle.
 * POST /api/dead-stock/bundles/create
 */
export async function createDeadStockBundle(payload, shop = "") {
  const targetShop =
    shop ||
    payload?.shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const cleanPayload = {
    ...payload,
    shop: targetShop,
    offerType: "BOGO",
  };

  const response = await fetch(
    `/api/dead-stock/bundles/create?shop=${encodeURIComponent(targetShop)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanPayload),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "Failed to create BOGO bundle.");
  }

  return data;
}

/**
 * Fetches all Dead Stock Bundles for a merchant store.
 * GET /api/dead-stock/bundles?shop={shop}
 */
export async function fetchDeadStockBundles(shop = "") {
  const targetShop =
    shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const response = await fetch(
    `/api/dead-stock/bundles?shop=${encodeURIComponent(targetShop)}`
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "Failed to load dead stock bundles.");
  }

  return data.data || [];
}

/**
 * Fetches a single Dead Stock Bundle by ID.
 * GET /api/dead-stock/bundles/:id?shop={shop}
 */
export async function fetchDeadStockBundleById(id, shop = "") {
  if (!id) throw new Error("Bundle ID is required.");

  const targetShop =
    shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const response = await fetch(
    `/api/dead-stock/bundles/${encodeURIComponent(id)}?shop=${encodeURIComponent(targetShop)}`
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "Failed to load bundle detail.");
  }

  return data.data;
}

/**
 * Updates an existing Dead Stock BOGO Bundle.
 * PUT /api/dead-stock/bundles/:id
 */
export async function updateDeadStockBundle(id, payload, shop = "") {
  if (!id) throw new Error("Bundle ID is required.");

  const targetShop =
    shop ||
    payload?.shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const cleanPayload = {
    ...payload,
    shop: targetShop,
    offerType: "BOGO",
  };

  const response = await fetch(
    `/api/dead-stock/bundles/${encodeURIComponent(id)}?shop=${encodeURIComponent(targetShop)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanPayload),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "Failed to update BOGO bundle.");
  }

  return data;
}

/**
 * Deletes a Dead Stock Bundle by ID.
 * DELETE /api/dead-stock/bundles/:id?shop={shop}
 */
export async function deleteDeadStockBundle(id, shop = "") {
  if (!id) throw new Error("Bundle ID is required.");

  const targetShop =
    shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const response = await fetch(
    `/api/dead-stock/bundles/${encodeURIComponent(id)}?shop=${encodeURIComponent(targetShop)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "Failed to delete bundle.");
  }

  return data;
}
