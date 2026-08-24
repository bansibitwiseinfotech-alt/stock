import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  const requestUrl = new URL(request.url);

  if (!requestUrl.searchParams.has("shop") && session?.shop) {
    requestUrl.searchParams.set("shop", session.shop);
  }

  const backendUrl = new URL("/api/dead-stock/sync", backendBaseUrl);
  backendUrl.search = requestUrl.search;

  let requestBody = {};
  try {
    requestBody = await request.json();
  } catch {
    requestBody = {};
  }
  requestBody.shop = requestBody.shop || session?.shop || "";
  requestBody.accessToken = session?.accessToken || "";

  const backendResponse = await fetch(backendUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Shop-Domain": session?.shop || "",
      "X-Shopify-Access-Token": session?.accessToken || "",
    },
    body: JSON.stringify(requestBody),
  });

  const body = await backendResponse.text();

  return new Response(body, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") || "application/json",
    },
  });
};
