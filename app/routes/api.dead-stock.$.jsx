/* global process */
import { authenticate } from "../shopify.server";

async function proxyToBackend(request) {
  let session = null;
  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
  } catch (err) {
    // If iframe fetch missing session token, fallback gracefully
  }

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  const requestUrl = new URL(request.url);

  const shop = requestUrl.searchParams.get("shop") || session?.shop || "";
  if (shop && !requestUrl.searchParams.has("shop")) {
    requestUrl.searchParams.set("shop", shop);
  }

  let backendPathname = requestUrl.pathname;
  const pathSegments = backendPathname.split("/").filter(Boolean);
  const actionNames = new Set(["clearance", "collection", "markdown", "bundle"]);

  let bodyText = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      bodyText = await request.text();
    } catch {
      bodyText = undefined;
    }
  }

  if (
    pathSegments.length === 3 &&
    pathSegments[0] === "api" &&
    pathSegments[1] === "dead-stock" &&
    actionNames.has(pathSegments[2])
  ) {
    try {
      const bodyData = bodyText ? JSON.parse(bodyText) : {};
      const fallbackId = bodyData.variantId || bodyData.productId || bodyData.deadStockVariantId;
      if (fallbackId) {
        const cleanId = String(fallbackId)
          .replace("gid://shopify/ProductVariant/", "")
          .replace("gid://shopify/Product/", "");
        if (cleanId) {
          backendPathname = `/api/dead-stock/${encodeURIComponent(cleanId)}/${pathSegments[2]}`;
        }
      }
    } catch {
      // ignore parse failures and forward original path
    }
  }

  const backendUrl = new URL(backendPathname, backendBaseUrl);
  backendUrl.search = requestUrl.search;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Shop-Domain": shop,
    "X-Shopify-Access-Token": session?.accessToken || "",
  };

  const body = bodyText;

  try {
    const backendResponse = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body,
    });

    const responseText = await backendResponse.text();

    return new Response(responseText, {
      status: backendResponse.status,
      headers: {
        "Content-Type": backendResponse.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Backend Proxy Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unable to connect to backend engine server.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const loader = async ({ request, params }) => {
  return proxyToBackend(request, params);
};

export const action = async ({ request, params }) => {
  return proxyToBackend(request, params);
};
