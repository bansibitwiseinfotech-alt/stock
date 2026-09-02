import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import {
  boundary,
} from "@shopify/shopify-app-react-router/server";
import App from "../../src/App";
import {
  AppProvider as ShopifyAppProvider,
} from "@shopify/shopify-app-react-router/react";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import "../../src/styles/responsive.css";
import enTranslations from "@shopify/polaris/locales/en.json";

import {
  authenticate,
} from "../shopify.server";
export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
];

if (typeof window !== "undefined") {
  const silence = (win) => {
    if (!win || !win.console || win.__violation_patched) return;
    try {
      win.__violation_patched = true;
      ["log", "warn", "info", "debug", "error"].forEach((method) => {
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
            str.includes("handler took") ||
            str.includes("preloaded using link preload") ||
            str.includes("postMessage") ||
            str.includes("target origin") ||
            str.includes("DOMWindow") ||
            str.includes("startTime") ||
            str.includes("reportAllChanges")
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
  try {
    window.addEventListener('error', function(e) {
      var msg = (e && e.message) ? String(e.message) : '';
      if (
        msg.indexOf('postMessage') !== -1 ||
        msg.indexOf('target origin') !== -1 ||
        msg.indexOf('startTime') !== -1 ||
        msg.indexOf('reportAllChanges') !== -1
      ) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        return true;
      }
    }, true);
    var oldOnError = window.onerror;
    window.onerror = function(message) {
      var str = String(message || '');
      if (
        str.indexOf('startTime') !== -1 ||
        str.indexOf('reportAllChanges') !== -1 ||
        str.indexOf('postMessage') !== -1
      ) {
        return true;
      }
      if (oldOnError) return oldOnError.apply(this, arguments);
    };
  } catch (e) {}
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

export default function AppLayout() {
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
            CURRENT PAGE WRAPPED IN SRC/APP
        ================================================== */}
        <App>
          <Outlet />
        </App>
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