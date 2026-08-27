// =====================================================
// SUBSCRIPTION & BILLING API SERVICE
// =====================================================

/**
 * Fetches the merchant's current subscription, feature usages, and plan permissions.
 * @param {string} shop - Shopify store domain
 * @returns {Promise<{ success: boolean, subscription: object }>}
 */
export async function fetchSubscription(shop = "") {
  const queryParam = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const res = await fetch(`/api/subscription${queryParam}`, {
    headers: {
      "Content-Type": "application/json",
      ...(shop ? { "X-Shopify-Shop-Domain": shop } : {}),
    },
  });

  if (!res.ok) {
    let errorData = null;
    try {
      errorData = await res.json();
    } catch {
      // JSON parse fallback
    }
    const message =
      errorData?.message ||
      `Failed to fetch subscription details (HTTP ${res.status})`;
    throw new Error(message);
  }

  const json = await res.json();
  return json;
}

/**
 * Requests an AppSubscription upgrade from the backend.
 * Returns the Shopify confirmation URL for checkout redirection.
 * @param {object} params
 * @param {string} params.shop
 * @param {string} params.plan - "basic" | "pro" | "premium"
 * @param {string} params.billingCycle - "monthly" | "yearly"
 * @returns {Promise<{ success: boolean, confirmationUrl: string, plan: string, billingCycle: string }>}
 */
export async function upgradeSubscriptionApi({
  shop = "",
  plan,
  billingCycle = "monthly",
}) {
  const queryParam = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const res = await fetch(`/api/subscription/upgrade${queryParam}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(shop ? { "X-Shopify-Shop-Domain": shop } : {}),
    },
    body: JSON.stringify({
      shop,
      plan,
      billingCycle,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message || `Failed to create upgrade checkout (HTTP ${res.status})`
    );
  }

  return json;
}

/**
 * Cancels any active Shopify AppSubscription and reverts store to the Free plan.
 * @param {string} shop - Shopify store domain
 * @returns {Promise<{ success: boolean, message: string, subscription: object }>}
 */
export async function switchFreeApi(shop = "") {
  const queryParam = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const res = await fetch(`/api/subscription/switch-free${queryParam}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(shop ? { "X-Shopify-Shop-Domain": shop } : {}),
    },
    body: JSON.stringify({ shop }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message || `Failed to switch to Free plan (HTTP ${res.status})`
    );
  }

  return json;
}

/**
 * Verifies and activates a completed Shopify subscription.
 * @param {object} params
 * @param {string} params.shop
 * @param {string} params.charge_id
 * @param {string} params.plan
 * @param {string} params.billingCycle
 * @returns {Promise<{ success: boolean, subscription: object }>}
 */
export async function verifySubscriptionApi({
  shop = "",
  charge_id = "",
  plan = "",
  billingCycle = "",
}) {
  const queryParam = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const res = await fetch(`/api/subscription/verify${queryParam}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(shop ? { "X-Shopify-Shop-Domain": shop } : {}),
    },
    body: JSON.stringify({
      shop,
      charge_id,
      plan,
      billingCycle,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message || `Failed to verify subscription (HTTP ${res.status})`
    );
  }

  return json;
}

