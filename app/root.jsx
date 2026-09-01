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
                    ['warn', 'log', 'info', 'debug'].forEach(function(level) {
                      var original = target.console[level];
                      if (!original) return;
                      target.console[level] = function() {
                        var msg = "";
                        for (var i = 0; i < arguments.length; i++) {
                          try {
                            var item = arguments[i];
                            msg += " " + (typeof item === "object" ? (item ? item.message || JSON.stringify(item) : "") : String(item));
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
                          msg.indexOf("Direct API Access") !== -1
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
