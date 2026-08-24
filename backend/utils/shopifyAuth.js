function normalizeAppUrl(appUrl) {
  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not configured");
  }

  return appUrl.replace(/\/+$/, "");
}

function buildInstallUrl({ shop, apiKey, scopes, appUrl }) {
  const redirectUri = `${normalizeAppUrl(appUrl)}/auth/callback`;
  const scopeValue = Array.isArray(scopes)
    ? scopes.join(",")
    : String(scopes || "").trim();

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopeValue,
    redirect_uri: redirectUri,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

function parseScopes(scopeString) {
  return (scopeString || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasRequiredScopes(grantedScopes, requiredScopes) {
  const granted = new Set(parseScopes(grantedScopes));

  return requiredScopes.every((scope) => granted.has(scope));
}

module.exports = {
  buildInstallUrl,
  normalizeAppUrl,
  parseScopes,
  hasRequiredScopes,
};
