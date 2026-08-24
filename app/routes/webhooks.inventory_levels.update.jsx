import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log(`[Webhook] ${topic} received for shop ${shop}, inventory_item_id: ${payload?.inventory_item_id}, available: ${payload?.available}`);

    if (shop && payload?.inventory_item_id) {
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
      await fetch(`${backendBaseUrl}/api/notifications/webhook/inventory-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          inventoryItemId: payload.inventory_item_id,
          available: payload.available,
          locationId: payload.location_id,
        }),
      }).catch((err) => console.error("Webhook proxy error:", err.message));
    }
  } catch (err) {
    console.error("Inventory webhook auth error:", err.message);
  }

  return new Response("OK", { status: 200 });
};
