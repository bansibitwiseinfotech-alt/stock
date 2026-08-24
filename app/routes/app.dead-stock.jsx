import { useLoaderData, useLocation, Outlet } from "react-router";
import { authenticate } from "../shopify.server";
import DeadStock from "../../src/pages/DeadStock/DeadStock";

// ─────────────────────────────────────────────────────────────────────────────
// SSR Loader — runs on the server, provides initial page data.
//
// Fetches:
//   1. Global dead-stock summary (MongoDB aggregate)
//   2. First page of Shopify products (50 items, cursor = null)
//
// This means the page renders with real Shopify data immediately on first load.
// The client-side React component detects initialProducts and skips re-fetching.
// ─────────────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const token = session?.accessToken || "";

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";

  let initialSummary = { totalCashTiedUp: 0, deadStockSkuCount: 0 };
  let initialProducts = [];
  let initialPagination = {
    limit: 50,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
    previousCursor: null,
    totalItems: null,
    totalPages: null,
  };

  const commonHeaders = {
    "Content-Type": "application/json",
    "X-Shopify-Shop-Domain": shop,
    "X-Shopify-Access-Token": token,
  };

  try {
    const [summaryRes, productsRes] = await Promise.all([
      fetch(
        `${backendBaseUrl}/api/dead-stock/summary?shop=${encodeURIComponent(shop)}`,
        { headers: commonHeaders }
      ),
      fetch(
        `${backendBaseUrl}/api/dead-stock/store-products?shop=${encodeURIComponent(shop)}&limit=50`,
        { headers: commonHeaders }
      ),
    ]);

    if (summaryRes.ok) {
      const summaryJson = await summaryRes.json().catch(() => ({}));
      if (summaryJson.success && summaryJson.data) {
        initialSummary = summaryJson.data;
      }
    }

    if (productsRes.ok) {
      const productsJson = await productsRes.json().catch(() => ({}));
      if (productsJson.success) {
        initialProducts = productsJson.data || [];
        if (productsJson.pagination) {
          initialPagination = productsJson.pagination;
        }
      }
    }
  } catch (err) {
    console.error("Dead Stock SSR Loader Error:", err.message);
  }

  return {
    shop,
    token,
    initialSummary,
    initialProducts,
    initialPagination,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Route component
//
// NESTED ROUTE HANDLING:
//   app.dead-stock.$variantId.jsx is a CHILD route of this file in React Router.
//   When on /app/dead-stock/:variantId, we must render <Outlet /> so the child
//   route (DeadStockProduct) can render. When on /app/dead-stock exactly,
//   we render the Dead Stock list.
// ─────────────────────────────────────────────────────────────────────────────
export default function DeadStockRoute() {
  const { shop, token, initialSummary, initialProducts, initialPagination } = useLoaderData();
  const location = useLocation();

  // Detect if a child route is active (URL has more path after /app/dead-stock)
  const isChildRoute =
    location.pathname !== "/app/dead-stock" &&
    location.pathname !== "/app/dead-stock/";

  if (isChildRoute) {
    // Render the child route (e.g. app.dead-stock.$variantId → DeadStockProduct)
    return <Outlet />;
  }

  return (
    <DeadStock
      shopDomain={shop}
      shopToken={token}
      initialSummary={initialSummary}
      initialProducts={initialProducts}
      initialPagination={initialPagination}
    />
  );
}