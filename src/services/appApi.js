// ==================================================
// DASHBOARD
// ==================================================

export async function fetchDashboardData(shop = "") {
  const res = await fetch(
    `/api/dashboard?shop=${encodeURIComponent(shop)}`
  );

  if (!res.ok) {
    throw new Error("Failed to load dashboard data.");
  }

  const json = await res.json();

  return json.data;
}

// ==================================================
// MODULE B — HIGH DEMAND
// ==================================================

export async function fetchHighDemandData({
  shop = "",
  riskLevel = "all",
  search = "",
  page = 1,
} = {}) {
  const params = new URLSearchParams();

  if (shop) {
    params.set("shop", shop);
  }

  if (riskLevel && riskLevel !== "all") {
    params.set("riskLevel", riskLevel);
  }

  if (search) {
    params.set("search", search);
  }

  params.set("page", String(page));

  const res = await fetch(
    `/api/high-demand?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load high demand stockout predictions."
    );
  }

  return await res.json();
}

// ==================================================
// HIGH DEMAND — VARIANT DETAIL
// ==================================================

export async function fetchHighDemandVariantDetail(
  shop = "",
  variantId = ""
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  const cleanId = encodeURIComponent(
    String(variantId).replace(
      "gid://shopify/ProductVariant/",
      ""
    )
  );

  const res = await fetch(
    `/api/high-demand/variant/${cleanId}?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load variant detail."
    );
  }

  const json = await res.json();

  return json.data || json;
}

// ==================================================
// HIGH DEMAND — CREATE REORDER
// ==================================================

export async function createHighDemandReorderApi(
  reorderPayload = {}
) {
  if (!reorderPayload.shop) {
    throw new Error("Shop is required.");
  }

  if (!reorderPayload.variantId) {
    throw new Error("Variant ID is required.");
  }

  const requestedQuantity = Number(
    reorderPayload.requestedQuantity ||
    reorderPayload.reorderQuantity ||
    0
  );

  if (requestedQuantity <= 0) {
    throw new Error(
      "Reorder quantity must be greater than 0."
    );
  }

  const payload = {
    ...reorderPayload,

    requestedQuantity,

    reorderQuantity: Number(
      reorderPayload.reorderQuantity ||
      requestedQuantity
    ),

    targetCoverageDays: Number(
      reorderPayload.targetCoverageDays || 30
    ),

    status: "PENDING",
  };

  const res = await fetch(
    `/api/high-demand/reorder`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to create reorder request."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — GET REORDERS
// ==================================================

export async function getHighDemandReordersApi({
  shop = "",
  status = "",
} = {}) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  const params = new URLSearchParams();

  params.set("shop", shop);

  if (
    status &&
    status !== "all"
  ) {
    params.set(
      "status",
      String(status).toUpperCase()
    );
  }

  const res = await fetch(
    `/api/high-demand/reorders?${params.toString()}`
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to fetch reorder requests."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — CONFIRM REORDER
// ==================================================

export async function confirmHighDemandReorderApi(
  id = ""
) {
  if (!id) {
    throw new Error(
      "Reorder ID is required."
    );
  }

  const res = await fetch(
    `/api/high-demand/reorder/${encodeURIComponent(
      id
    )}/confirm`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to confirm reorder."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — CANCEL REORDER
// ==================================================

export async function cancelHighDemandReorderApi(
  id = ""
) {
  if (!id) {
    throw new Error(
      "Reorder ID is required."
    );
  }

  const res = await fetch(
    `/api/high-demand/reorder/${encodeURIComponent(
      id
    )}/cancel`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to cancel reorder."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — URGENCY BADGE
// ==================================================

export async function toggleUrgencyBadgeApi(
  shop = "",
  variantId = "",
  enabled = true
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error(
      "Variant ID is required."
    );
  }

  const res = await fetch(
    `/api/high-demand/toggle-badge?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        variantId,
        enabled,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update urgency badge setting."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — PRE ORDER
// ==================================================

export async function togglePreOrderApi(
  shop = "",
  variantId = "",
  enabled = true
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error(
      "Variant ID is required."
    );
  }

  const res = await fetch(
    `/api/high-demand/toggle-preorder?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        variantId,
        enabled,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update pre-order setting."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — NOTIFY ME (BACK IN STOCK)
// ==================================================

export async function toggleNotifyMeApi(
  shop = "",
  variantId = "",
  enabled = true
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error(
      "Variant ID is required."
    );
  }

  const res = await fetch(
    `/api/high-demand/toggle-notify-me?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        variantId,
        enabled,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update Notify Me setting."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — MONITOR
// ==================================================

export async function toggleStockoutMonitorApi(
  shop = "",
  variantId = "",
  enabled = true
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  const cleanId = encodeURIComponent(
    String(variantId).replace(
      "gid://shopify/ProductVariant/",
      ""
    )
  );

  const res = await fetch(
    `/api/high-demand/monitor/${cleanId}?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        variantId,
        enabled,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update monitor setting."
    );
  }

  return json;
}

// ==================================================
// HIGH DEMAND — UPDATE STOREFRONT CONFIG
// ==================================================

export async function updateStockoutShieldConfigApi(
  shop = "",
  variantId = "",
  configPayload = {}
) {
  if (!shop) {
    throw new Error("Shop is required.");
  }

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  const cleanId = encodeURIComponent(
    String(variantId).replace(
      "gid://shopify/ProductVariant/",
      ""
    )
  );

  const res = await fetch(
    `/api/high-demand/storefront/${cleanId}?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        variantId,
        ...configPayload,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update storefront configuration."
    );
  }

  return json;
}

// ==================================================
// BUNDLES
// ==================================================

export async function fetchBundlesData(
  shop = ""
) {
  const res = await fetch(
    `/api/bundles?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load bundles."
    );
  }

  const json = await res.json();

  return json.data || [];
}

// ==================================================

export async function createBundleApi(
  shop = "",
  bundlePayload = {}
) {
  const res = await fetch(
    `/api/bundles?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        ...bundlePayload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to create bundle."
    );
  }

  return await res.json();
}

// ==================================================
// AUTOMATIONS
// ==================================================

export async function fetchAutomationsData(
  shop = ""
) {
  const res = await fetch(
    `/api/automations?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load automations."
    );
  }

  const json = await res.json();

  return json.data || [];
}

// ==================================================

export async function toggleAutomationApi(
  shop = "",
  id = "",
  enabled = true
) {
  const res = await fetch(
    `/api/automations/toggle?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        id,
        enabled,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to update automation."
    );
  }

  return await res.json();
}

// ==================================================
// REPORTS
// ==================================================

export async function fetchReportsData(
  shop = ""
) {
  const res = await fetch(
    `/api/reports?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load reports."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================
// SETTINGS
// ==================================================

export async function fetchSettingsData(
  shop = ""
) {
  const res = await fetch(
    `/api/settings?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load settings."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function saveSettingsApi(
  shop = "",
  settingsPayload = {}
) {
  const res = await fetch(
    `/api/settings?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        ...settingsPayload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save settings."
    );
  }

  return await res.json();
}

// ==================================================
// CLEARANCE SALE CUSTOMIZATION
// ==================================================

export async function fetchClearanceSaleConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/clearance-sale?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load clearance sale configuration."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function saveClearanceSaleConfigApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/customization/clearance-sale?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save clearance sale configuration."
    );
  }

  return await res.json();
}

// ==================================================

export async function resetClearanceSaleConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/clearance-sale/reset?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reset clearance sale configuration."
    );
  }

  return await res.json();
}

// ==================================================
// BUNDLE CUSTOMIZATION
// ==================================================

export async function fetchBundleConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/bundle?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load bundle configuration."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function saveBundleConfigApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/customization/bundle?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save bundle configuration."
    );
  }

  return await res.json();
}

// ==================================================

export async function resetBundleConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/bundle/reset?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reset bundle configuration."
    );
  }

  return await res.json();
}

// ==================================================
// MARKDOWN CUSTOMIZATION
// ==================================================

export async function fetchMarkdownConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/markdown?shop=${encodeURIComponent(
      shop
    )}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load markdown configuration."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function saveMarkdownConfigApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/customization/markdown?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save markdown configuration."
    );
  }

  return await res.json();
}

// ==================================================

export async function resetMarkdownConfigApi(
  shop = ""
) {
  const res = await fetch(
    `/api/customization/markdown/reset?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reset markdown configuration."
    );
  }

  return await res.json();
}

// ==================================================
// LOW STOCK BADGE CUSTOMIZATION
// ==================================================

export async function fetchLowStockConfigApi(shop = "") {
  const res = await fetch(
    `/api/customization/low-stock?shop=${encodeURIComponent(shop)}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load low stock badge configuration."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function saveLowStockConfigApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/customization/low-stock?shop=${encodeURIComponent(shop)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save low stock badge configuration."
    );
  }

  return await res.json();
}

// ==================================================

export async function resetLowStockConfigApi(shop = "") {
  const res = await fetch(
    `/api/customization/low-stock/reset?shop=${encodeURIComponent(shop)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reset low stock badge configuration."
    );
  }

  return await res.json();
}

// ==================================================
// PRE-ORDER CUSTOMIZATION (COLORS & STYLING)
// ==================================================

export async function fetchPreOrderConfigApi(shop = "") {
  const res = await fetch(
    `/api/customization/pre-order?shop=${encodeURIComponent(shop)}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load pre-order styling configuration."
    );
  }

  const json = await res.json();

  return json.data;
}

// ==================================================

export async function savePreOrderConfigApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/customization/pre-order?shop=${encodeURIComponent(shop)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to save pre-order styling configuration."
    );
  }

  return await res.json();
}

// ==================================================

export async function resetPreOrderConfigApi(shop = "") {
  const res = await fetch(
    `/api/customization/pre-order/reset?shop=${encodeURIComponent(shop)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reset pre-order styling configuration."
    );
  }

  return await res.json();
}

// ==================================================
// NOTIFICATIONS / BACK-IN-STOCK REQUESTS
// ==================================================

export async function fetchNotificationsApi({
  shop = "",
  status = "ALL",
  search = "",
  productId = "",
  variantId = "",
  page = 1,
  limit = 25,
} = {}) {
  const params = new URLSearchParams();

  if (shop) params.set("shop", shop);
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (search) params.set("search", search);
  if (productId) params.set("productId", productId);
  if (variantId) params.set("variantId", variantId);

  params.set("page", String(page));
  params.set("limit", String(limit));

  const res = await fetch(
    `/api/notifications?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load back-in-stock notifications."
    );
  }

  return await res.json();
}

export async function cancelNotificationApi(
  shop,
  notificationId,
  hardDelete = false
) {
  const res = await fetch(
    `/api/notifications/${encodeURIComponent(
      notificationId
    )}?shop=${encodeURIComponent(
      shop
    )}&hard=${hardDelete}`,
    {
      method: "DELETE",
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to delete/cancel notification request."
    );
  }

  return await res.json();
}

export async function triggerRestockApi(
  shop,
  variantId,
  currentStock = 10
) {
  const quantity = Number(
    currentStock || 10
  );

  const res = await fetch(
    `/api/notifications/test-restock`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        variantId,
        quantity,
        currentStock: quantity,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok && res.status !== 207) {
    throw new Error(
      data.message ||
      `Restock failed (Status ${res.status})`
    );
  }

  return data;
}

// ==================================================
// PRE-ORDERS API
// ==================================================

export async function fetchPreOrdersApi({
  shop = "",
  status = "ALL",
  search = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams();

  if (shop) params.set("shop", shop);
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (search) params.set("search", search);

  params.set("page", String(page));
  params.set("limit", String(limit));

  const res = await fetch(
    `/api/pre-orders?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load pre-orders."
    );
  }

  return await res.json();
}

export async function updatePreOrderStatusApi(
  id,
  payload = {}
) {
  if (!id) {
    throw new Error(
      "Pre-order ID is required"
    );
  }

  const res = await fetch(
    `/api/pre-orders/${encodeURIComponent(
      id
    )}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to update pre-order status."
    );
  }

  return await res.json();
}

export async function syncPreOrdersApi(shop = "") {
  const res = await fetch(
    "/api/pre-orders/sync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to sync pre-orders from Shopify."
    );
  }

  return await res.json();
}

export async function deletePreOrderApi(id) {
  if (!id) {
    throw new Error(
      "Pre-order ID is required"
    );
  }

  const res = await fetch(
    `/api/pre-orders/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to delete pre-order."
    );
  }

  return await res.json();
}

// ==================================================
// NEW PRODUCT LAUNCH PRE-ORDERS API
// ==================================================

export async function fetchLaunchPreOrdersApi(
  shop = ""
) {
  const params = new URLSearchParams();

  if (shop) {
    params.set("shop", shop);
  }

  const res = await fetch(
    `/api/pre-orders/launch-config?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load launch pre-order configurations."
    );
  }

  return await res.json();
}

export async function fetchLaunchPreOrderByIdApi(
  shop = "",
  productId = ""
) {
  const params = new URLSearchParams();

  if (shop) {
    params.set("shop", shop);
  }

  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/pre-orders/launch-config/${cleanId}?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load launch pre-order details."
    );
  }

  return await res.json();
}

export async function saveLaunchPreOrderApi(
  shop = "",
  payload = {}
) {
  const res = await fetch(
    `/api/pre-orders/launch-config?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        ...payload,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to save launch pre-order configuration."
    );
  }

  return data;
}

export async function toggleLaunchPreOrderApi(
  shop = "",
  productId = "",
  enabled = true
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/pre-orders/launch-config/${cleanId}/toggle?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        enabled,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to toggle launch pre-order."
    );
  }

  return data;
}

export async function deleteLaunchPreOrderApi(
  shop = "",
  productId = ""
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/pre-orders/launch-config/${cleanId}?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "DELETE",
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to delete launch pre-order configuration."
    );
  }

  return data;
}

export async function fetchLaunchStoreProductsApi(
  shop = "",
  search = ""
) {
  const params = new URLSearchParams();

  if (shop) params.set("shop", shop);
  if (search) params.set("search", search);

  const res = await fetch(
    `/api/pre-orders/products?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load store products."
    );
  }

  return await res.json();
}

// ==================================================
// SMART BADGE RECOMMENDATIONS
// ==================================================

export async function scanSmartBadgesApi(
  shop = ""
) {
  const res = await fetch(
    `/api/smart-badges/scan?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Unable to scan Shopify products."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function fetchSmartBadgeRecommendationsApi(
  shop = ""
) {
  const res = await fetch(
    `/api/smart-badges/recommendations?shop=${encodeURIComponent(
      shop
    )}`,
    {
      headers: {
        "x-shopify-shop-domain": shop,
      },
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to load smart badge recommendations."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function fetchSmartBadgeSummaryApi(
  shop = ""
) {
  const res = await fetch(
    `/api/smart-badges/summary?shop=${encodeURIComponent(
      shop
    )}`,
    {
      headers: {
        "x-shopify-shop-domain": shop,
      },
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to load smart badge summary."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function applySmartBadgeApi(
  shop = "",
  productId = "",
  badge = ""
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/smart-badges/${cleanId}/apply?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
        productId,
        badge,
        badgeType: badge,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      `Failed to apply ${badge} badge.`
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function disableSmartBadgeApi(
  shop = "",
  productId = "",
  badge = ""
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/smart-badges/${cleanId}/disable?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
        productId,
        badge,
        badgeType: badge,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to disable badge."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function bulkApplySmartBadgesApi(
  shop = "",
  items = []
) {
  const res = await fetch(
    `/api/smart-badges/bulk-apply?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
        items,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to bulk apply recommendations."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function retryFailedSmartBadgesApi(
  shop = "",
  productIds = []
) {
  const res = await fetch(
    `/api/smart-badges/retry-failed?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
        productIds,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to retry products."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

// ==================================================
// STORE BADGE SETTINGS & ASSIGNMENTS API
// ==================================================

export async function fetchBadgeSettingsApi(
  shop = ""
) {
  const res = await fetch(
    `/api/badge-settings?shop=${encodeURIComponent(
      shop
    )}`,
    {
      headers: {
        "x-shopify-shop-domain": shop,
      },
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to load store badge settings."
    );
  }

  return data.data;
}

export async function saveBadgeSettingsApi(
  shop = "",
  settingsPayload = {}
) {
  const res = await fetch(
    `/api/badge-settings?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify(
        settingsPayload
      ),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to save store badge settings."
    );
  }

  return data.data;
}

export async function validateBadgeSettingsApi(
  shop = "",
  badgeType = ""
) {
  const params = new URLSearchParams({
    shop,
  });

  if (badgeType) {
    params.set(
      "badgeType",
      badgeType
    );
  }

  const res = await fetch(
    `/api/badge-settings/validate?${params.toString()}`,
    {
      headers: {
        "x-shopify-shop-domain": shop,
      },
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to validate badge settings."
    );
  }

  return data;
}

export async function applyAllSmartBadgesApi(
  shop = ""
) {
  const res = await fetch(
    `/api/smart-badges/apply-all?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data.message ||
      "Failed to apply all recommendations."
    );

    err.error = data.error;
    err.status = res.status;

    throw err;
  }

  return data;
}

export async function fetchProductBadgeAssignmentApi(
  shop = "",
  productId = ""
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/smart-badges/${cleanId}?shop=${encodeURIComponent(
      shop
    )}`,
    {
      headers: {
        "x-shopify-shop-domain": shop,
      },
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to load product badge assignment."
    );
  }

  return data.assignment;
}

export async function removeProductBadgeAssignmentApi(
  shop = "",
  productId = ""
) {
  const cleanId = encodeURIComponent(
    String(productId).replace(
      /^gid:\/\/shopify\/Product\//,
      ""
    )
  );

  const res = await fetch(
    `/api/smart-badges/${cleanId}/disable?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": shop,
      },
      body: JSON.stringify({
        shop,
        productId,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
      "Failed to remove product badge assignment."
    );
  }

  return data;
}

// ==================================================
// WEEKLY EMAIL DIGEST SETTINGS
// ==================================================

export async function fetchEmailSettingsApi(
  shop = ""
) {
  if (!shop) {
    throw new Error(
      "Shop domain is required."
    );
  }

  const res = await fetch(
    `/api/email/settings?shop=${encodeURIComponent(
      shop
    )}`
  );

  const json = await res
    .json()
    .catch(() => ({}));

  if (res.status === 404) {
    return null;
  }

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to load email settings."
    );
  }

  return json.settings;
}

export async function saveEmailSettingsApi(
  data = {}
) {
  if (!data.shop) {
    throw new Error(
      "Shop domain is required."
    );
  }

  const res = await fetch(
    `/api/email/settings`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const json = await res
    .json()
    .catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to save email settings."
    );
  }

  return json.settings;
}

// ==================================================
// WEEKLY EMAIL DIGEST — SEND TEST EMAIL
// ==================================================

export async function sendTestEmailDigestApi(
  shop = ""
) {
  if (!shop) {
    throw new Error(
      "Shop domain is required."
    );
  }

  const res = await fetch(
    `/api/email/test?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
      }),
    }
  );

  const json = await res
    .json()
    .catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to send test email."
    );
  }

  return json;
}

// ==================================================
// WEEKLY EMAIL DIGEST — TOGGLE ENABLED STATUS
// ==================================================

export async function toggleWeeklyDigestApi(
  shop = "",
  enabled = true
) {
  if (!shop) {
    throw new Error(
      "Shop domain is required."
    );
  }

  const res = await fetch(
    `/api/email/settings/toggle`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        weeklyDigestEnabled: enabled,
      }),
    }
  );

  const json = await res
    .json()
    .catch(() => ({}));

  if (!res.ok || !json.success) {
    throw new Error(
      json.message ||
      "Failed to update weekly digest setting."
    );
  }

  return json.settings;
}