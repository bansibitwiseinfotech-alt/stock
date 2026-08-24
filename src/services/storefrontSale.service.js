const API_BASE_URL = "http://localhost:5000";

export async function getSaleSettings(shop) {
  const response = await fetch(
    `${API_BASE_URL}/api/storefront-sale/sale-settings?shop=${encodeURIComponent(shop)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch sale settings");
  }

  return response.json();
}

export async function saveSaleSettings(settings) {
  const response = await fetch(
    `${API_BASE_URL}/api/storefront-sale/sale-settings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.message || "Failed to save sale settings"
    );
  }

  return response.json();
}

export async function updateSaleSettings(shop, settings) {
  const response = await fetch(
    `${API_BASE_URL}/api/storefront-sale/sale-settings?shop=${encodeURIComponent(
      shop
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.message || "Failed to update sale settings"
    );
  }

  return response.json();
}