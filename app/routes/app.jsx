import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
//import App from "../../src/App";
import {
  boundary,
} from "@shopify/shopify-app-react-router/server";

import {
  AppProvider as ShopifyAppProvider,
} from "@shopify/shopify-app-react-router/react";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import enTranslations from "@shopify/polaris/locales/en.json";

import {
  authenticate,
} from "../shopify.server";
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// ======================================================
// LOADER
// ======================================================

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

// ======================================================
// APP LAYOUT
// ======================================================

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisProvider i18n={enTranslations}>
        {/* ==================================================
            SHOPIFY NATIVE APP NAVIGATION (LEFT SIDEBAR)
        ================================================== */}
        <s-app-nav>
          <s-link href="/app/dead-stock">
            Dead Stock
          </s-link>
          <s-link href="/app/customization">
            Customization                             
          </s-link>
           <s-link href="/app/high-demand">
            High Demand
          </s-link>
          <s-link href="/app/pre-orders">
            Pre-Orders
          </s-link>
          <s-link href="/app/smart-badges">
            Smart Badges
          </s-link>
          <s-link href="/app/settings">
            Email Schedule
          </s-link>
          <s-link href="/app/billing">
            Billing & Plans
          </s-link>
        </s-app-nav>

        {/* ==================================================
            CURRENT PAGE
        ================================================== */}
        <Outlet />
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

// ======================================================
// ERROR BOUNDARY
// ======================================================

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// ======================================================
// HEADERS
// ======================================================

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};