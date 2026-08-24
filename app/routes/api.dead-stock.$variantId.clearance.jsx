import { authenticate } from "../shopify.server";

async function proxyClearanceRequest(request, params) {
  const { session } = await authenticate.admin(request);
  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  const requestUrl = new URL(request.url);
  const shop = requestUrl.searchParams.get("shop") || session?.shop || "";
  const variantId = encodeURIComponent(params.variantId || "");
  const backendUrl = new URL(`/api/dead-stock/${variantId}/clearance`, backendBaseUrl);
  backendUrl.search = requestUrl.search;

  const backendResponse = await fetch(backendUrl.toString(), {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-Access-Token": session?.accessToken || "",
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  });

  return new Response(await backendResponse.text(), {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") || "application/json",
    },
  });
}

export const loader = async ({ request, params }) => proxyClearanceRequest(request, params);
export const action = async ({ request, params }) => proxyClearanceRequest(request, params);
