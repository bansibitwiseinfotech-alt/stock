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
import responsiveStyles from "../../src/styles/responsive.css?url";
import enTranslations from "@shopify/polaris/locales/en.json";

import {
  authenticate,
} from "../shopify.server";
export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: responsiveStyles },
];

if (typeof window !== "undefined") {
  const silence = (win) => {
    if (!win || !win.console || win.__violation_patched) return;
    try {
      win.__violation_patched = true;
      ["log", "warn", "info", "debug"].forEach((method) => {
        const orig = win.console[method];
        if (!orig) return;
        win.console[method] = function (...args) {
          const str = args
            .map((a) => {
              try {
                return typeof a === "object" ? (a?.message || JSON.stringify(a)) : String(a);
              } catch (e) {
                return String(a);
              }
            })
            .join(" ");
          if (
            str.includes("deprecated parameters") ||
            str.includes("initialization function") ||
            str.includes("ShopifyQL plugin is not available") ||
            str.includes("Direct API Access") ||
            str.includes("[Violation]") ||
            str.includes("handler took")
          ) {
            return;
          }
          orig.apply(win.console, args);
        };
      });
    } catch (e) {}
  };
  silence(window);
  try { silence(window.parent); } catch (e) {}
  try { silence(window.top); } catch (e) {}
}

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