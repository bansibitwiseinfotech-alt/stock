import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log(`[Webhook] ${topic} received for shop ${shop}, Order ID: ${payload?.id}, Name: ${payload?.name}`);

    if (shop) {
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
      await fetch(`${backendBaseUrl}/api/pre-orders/webhook/order-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, order: payload, topic }),
      }).catch((err) => console.error("[Order Webhook Error]:", err.message));
    }
  } catch (err) {
    console.error("[Order Webhook Auth Error]:", err.message);
  }

  return new Response("OK", { status: 200 });
};
