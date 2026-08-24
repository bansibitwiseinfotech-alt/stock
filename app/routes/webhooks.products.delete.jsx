import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log(`[Webhook] ${topic} received for shop ${shop}, product ID: ${payload?.id}`);

    if (shop && payload?.id) {
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
      await fetch(`${backendBaseUrl}/api/dead-stock/webhook/product-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, productId: payload.id }),
      }).catch((err) => console.error("Webhook proxy error:", err.message));
    }
  } catch (err) {
    console.error("Webhook auth error:", err.message);
  }

  return new Response("OK", { status: 200 });
};
