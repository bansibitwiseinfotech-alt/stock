import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";

export const loader = async () => {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function patchConsole(target) {
                  if (!target || !target.console || target.__silence_patched) return;
                  try {
                    target.__silence_patched = true;
                    ['warn', 'log', 'info', 'debug', 'error'].forEach(function(level) {
                      var original = target.console[level];
                      if (!original) return;
                      target.console[level] = function() {
                        var msg = "";
                        for (var i = 0; i < arguments.length; i++) {
                          try {
                            var item = arguments[i];
                            msg += " " + (typeof item === "object" ? (item ? item.message || item.stack || JSON.stringify(item) : "") : String(item));
                          } catch (e) {
                            msg += " " + String(arguments[i]);
                          }
                        }
                        if (
                          msg.indexOf("deprecated parameters") !== -1 ||
                          msg.indexOf("initialization function") !== -1 ||
                          msg.indexOf("[Violation]") !== -1 ||
                          msg.indexOf("handler took") !== -1 ||
                          msg.indexOf("ShopifyQL") !== -1 ||
                          msg.indexOf("Direct API Access") !== -1 ||
                          msg.indexOf("preloaded using link preload") !== -1 ||
                          msg.indexOf("pass a single object instead") !== -1 ||
                          msg.indexOf("postMessage") !== -1 ||
                          msg.indexOf("target origin") !== -1 ||
                          msg.indexOf("DOMWindow") !== -1 ||
                          msg.indexOf("startTime") !== -1 ||
                          msg.indexOf("reportAllChanges") !== -1 ||
                          msg.indexOf("validateDOMNesting") !== -1
                        ) {
                          return;
                        }
                        return original.apply(target.console, arguments);
                      };
                    });
                  } catch (e) {}
                }
                patchConsole(window);
                try { patchConsole(window.parent); } catch (e) {}
                try { patchConsole(window.top); } catch (e) {}

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

                // 2. Wrap window.requestIdleCallback to catch soft nav metrics
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

                // 3. Wrap PerformanceObserver to prevent undefined entries crashing web-vitals
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

                if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (var i = 0; i < registrations.length; i++) {
                      registrations[i].unregister();
                    }
                  });
                }
              })();
            `,
          }}
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <meta name="shopify-api-key" content={apiKey} />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
