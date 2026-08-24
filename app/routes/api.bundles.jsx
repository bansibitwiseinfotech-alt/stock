import { authenticate } from "../shopify.server";

async function proxyToBackend(request) {
  let session = null;
  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
  } catch (err) {
    // If session is missing, continue gracefully
  }

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  const requestUrl = new URL(request.url);

  const shop = requestUrl.searchParams.get("shop") || session?.shop || "";
  if (shop && !requestUrl.searchParams.has("shop")) {
    requestUrl.searchParams.set("shop", shop);
  }

  const backendUrl = new URL("/api/bundles", backendBaseUrl);
  backendUrl.search = requestUrl.search;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Shop-Domain": shop,
    "X-Shopify-Access-Token": session?.accessToken || "",
  };

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

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
    console.error("Bundles API Proxy Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unable to connect to backend server.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const loader = async ({ request }) => {
  return proxyToBackend(request);
};

export const action = async ({ request }) => {
  return proxyToBackend(request);
};