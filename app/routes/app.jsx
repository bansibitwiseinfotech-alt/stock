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
import responsiveStyles from "../../src/styles/responsive.css?url";
import "../../src/styles/responsive.css";
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
            str.includes("reportAllChanges") ||
            str.includes("validateDOMNesting")
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
    // 1. Wrap window.setTimeout to catch reportAllChanges & startTime inside n.timeout
    try {
      var origSetTimeout = window.setTimeout;
      window.setTimeout = function(fn, delay) {
        var extraArgs = Array.prototype.slice.call(arguments, 2);
        if (typeof fn === 'function') {
          var wrappedFn = function() {
            try {
              return fn.apply(this, arguments);
            } catch (err) {
              var msg = (err && (err.message || err.stack || String(err))) || '';
              if (msg.indexOf('startTime') !== -1 || msg.indexOf('reportAllChanges') !== -1) {
                return;
              }
              throw err;
            }
          };
          return origSetTimeout.apply(this, [wrappedFn, delay].concat(extraArgs));
        }
        return origSetTimeout.apply(this, arguments);
      };
    } catch (e) {}

    // 2. Wrap window.requestIdleCallback
    try {
      if (typeof window.requestIdleCallback === 'function') {
        var origRIC = window.requestIdleCallback;
        window.requestIdleCallback = function(fn, options) {
          if (typeof fn === 'function') {
            var wrappedFn = function() {
              try {
                return fn.apply(this, arguments);
              } catch (err) {
                var msg = (err && (err.message || err.stack || String(err))) || '';
                if (msg.indexOf('startTime') !== -1 || msg.indexOf('reportAllChanges') !== -1) {
                  return;
                }
                throw err;
              }
            };
            return origRIC.call(this, wrappedFn, options);
          }
          return origRIC.apply(this, arguments);
        };
      }
    } catch (e) {}

    // 3. Wrap PerformanceObserver
    try {
      if (typeof window.PerformanceObserver === 'function') {
        var OrigPO = window.PerformanceObserver;
        window.PerformanceObserver = function(callback) {
          var safeCb = function(entryList, observer) {
            try {
              return callback.call(this, entryList, observer);
            } catch (err) {
              var msg = (err && (err.message || err.stack || String(err))) || '';
              if (msg.indexOf('startTime') !== -1 || msg.indexOf('reportAllChanges') !== -1) {
                return;
              }
              throw err;
            }
          };
          return new OrigPO(safeCb);
        };
        window.PerformanceObserver.prototype = OrigPO.prototype;
        if (OrigPO.supportedEntryTypes) {
          window.PerformanceObserver.supportedEntryTypes = OrigPO.supportedEntryTypes;
        }
      }
    } catch (e) {}

    // 4. Safely intercept Chrome DevTools window.devToolsReportSoftNavs
    try {
      var _devToolsReportSoftNavs = undefined;
      Object.defineProperty(window, 'devToolsReportSoftNavs', {
        configurable: true,
        enumerable: true,
        get: function() { return _devToolsReportSoftNavs; },
        set: function(val) {
          if (typeof val === 'function') {
            _devToolsReportSoftNavs = function() {
              try {
                return val.apply(this, arguments);
              } catch (err) {}
            };
          } else {
            _devToolsReportSoftNavs = val;
          }
        }
      });
    } catch (e) {}

    // 5. Global error event listener (capture phase)
    window.addEventListener('error', function(e) {
      var msg = (e && (e.message || (e.error && (e.error.message || e.error.stack)))) ? String(e.message || (e.error && (e.error.message || e.error.stack))) : '';
      if (
        msg.indexOf('postMessage') !== -1 ||
        msg.indexOf('target origin') !== -1 ||
        msg.indexOf('startTime') !== -1 ||
        msg.indexOf('reportAllChanges') !== -1 ||
        msg.indexOf('validateDOMNesting') !== -1
      ) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        return true;
      }
    }, true);

    // 6. Unhandled rejection listener
    window.addEventListener('unhandledrejection', function(e) {
      var reason = e && e.reason;
      var msg = reason ? (typeof reason === 'object' ? (reason.message || reason.stack || JSON.stringify(reason)) : String(reason)) : '';
      if (
        msg.indexOf('postMessage') !== -1 ||
        msg.indexOf('target origin') !== -1 ||
        msg.indexOf('startTime') !== -1 ||
        msg.indexOf('reportAllChanges') !== -1
      ) {
        if (e.preventDefault) e.preventDefault();
        return true;
      }
    }, true);

    // 7. Lock window.onerror with permanent filtering
    try {
      var _currentOnError = null;
      Object.defineProperty(window, 'onerror', {
        configurable: true,
        enumerable: true,
        get: function() { return _currentOnError; },
        set: function(handler) {
          _currentOnError = function(message, source, lineno, colno, error) {
            var str = String(message || '') + ' ' + (error ? String(error.message || error.stack || error) : '');
            if (
              str.indexOf('startTime') !== -1 ||
              str.indexOf('reportAllChanges') !== -1 ||
              str.indexOf('postMessage') !== -1
            ) {
              return true;
            }
            if (typeof handler === 'function') {
              return handler.apply(this, arguments);
            }
          };
        }
      });
      window.onerror = null;
    } catch (e) {
      window.onerror = function(message, source, lineno, colno, error) {
        var str = String(message || '') + ' ' + (error ? String(error.message || error) : '');
        if (
          str.indexOf('startTime') !== -1 ||
          str.indexOf('reportAllChanges') !== -1 ||
          str.indexOf('postMessage') !== -1
        ) {
          return true;
        }
      };
    }
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