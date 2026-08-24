export const ALLOWED_DEAD_STOCK_ACTIONS = [
  "CLEARANCE_SALE",
  "DEAD_STOCK_BUNDLE",
  "PROGRESSIVE_MARKDOWN",
];

export const ACTION_ORDER = [
  "CLEARANCE_SALE",
  "DEAD_STOCK_BUNDLE",
  "PROGRESSIVE_MARKDOWN",
];

export const ACTION_LABELS = {
  CLEARANCE_SALE: "🏷️ Clearance Sale",
  DEAD_STOCK_BUNDLE: "📦 Dead Stock Bundle Offer",
  PROGRESSIVE_MARKDOWN: "📉 Progressive Markdown",
};

export const ACTION_ALIASES = {
  CLEARANCE_SALE: "CLEARANCE_SALE",
  "CLEARANCE SALE": "CLEARANCE_SALE",
  CLEARANCE: "CLEARANCE_SALE",
  clearance: "CLEARANCE_SALE",
  clearanceSale: "CLEARANCE_SALE",

  DEAD_STOCK_BUNDLE: "DEAD_STOCK_BUNDLE",
  "DEAD STOCK BUNDLE OFFER": "DEAD_STOCK_BUNDLE",
  "DEAD STOCK BUNDLE": "DEAD_STOCK_BUNDLE",
  BUNDLE_OR_BOGO: "DEAD_STOCK_BUNDLE",
  BUNDLE: "DEAD_STOCK_BUNDLE",
  bundle: "DEAD_STOCK_BUNDLE",
  deadStockBundle: "DEAD_STOCK_BUNDLE",

  PROGRESSIVE_MARKDOWN: "PROGRESSIVE_MARKDOWN",
  "PROGRESSIVE MARKDOWN": "PROGRESSIVE_MARKDOWN",
  MARKDOWN: "PROGRESSIVE_MARKDOWN",
  markdown: "PROGRESSIVE_MARKDOWN",
  progressiveMarkdown: "PROGRESSIVE_MARKDOWN",
};

/**
 * Normalizes any action type/object to canonical allowed action structure.
 * Returns null if the action is invalid or not in ALLOWED_DEAD_STOCK_ACTIONS.
 */
export function normalizeAction(action) {
  if (!action) return null;

  const rawType =
    typeof action === "string"
      ? action
      : action.type || action.recommendedAction || "";

  const trimmed = String(rawType || "").trim();
  const normalizedType =
    ACTION_ALIASES[trimmed] ||
    ACTION_ALIASES[trimmed.toUpperCase()] ||
    null;

  // Strict allowlist validation — reject anything not in ALLOWED_DEAD_STOCK_ACTIONS
  if (!normalizedType || !ALLOWED_DEAD_STOCK_ACTIONS.includes(normalizedType)) {
    return null;
  }

  const eligible =
    typeof action === "object" && action !== null
      ? action.eligible !== false
      : true;

  const score =
    typeof action === "object" && action !== null && typeof action.score === "number"
      ? action.score
      : 0;

  const confidence =
    typeof action === "object" && action !== null && action.confidence
      ? action.confidence
      : score >= 80
      ? "HIGH"
      : score >= 60
      ? "MEDIUM"
      : "LOW";

  const reason =
    typeof action === "object" && action !== null && action.reason
      ? action.reason
      : "";

  return {
    ...(typeof action === "object" && action !== null ? action : {}),
    type: normalizedType,
    label: ACTION_LABELS[normalizedType] || normalizedType,
    eligible,
    score,
    confidence,
    reason,
  };
}

/**
 * Filters, normalizes, deduplicates, and sorts raw actions according to dead stock analysis rules.
 */
export function filterAndSortVisibleActions(rawActions = []) {
  let actionsList = [];

  if (Array.isArray(rawActions)) {
    actionsList = rawActions;
  } else if (rawActions && typeof rawActions === "object") {
    if (Array.isArray(rawActions.recommendedActions)) {
      actionsList = rawActions.recommendedActions;
    } else if (Array.isArray(rawActions.analysis?.recommendedActions)) {
      actionsList = rawActions.analysis.recommendedActions;
    } else if (rawActions.type || rawActions.recommendedAction) {
      actionsList = [rawActions];
    }
  }

  // 1. Normalize
  // 2. Filter allowed actions
  // 3. Filter eligible actions (eligible !== false)
  const visible = actionsList
    .map(normalizeAction)
    .filter(Boolean)
    .filter((action) => ALLOWED_DEAD_STOCK_ACTIONS.includes(action.type))
    .filter((action) => action.eligible !== false);

  // 4. Deduplicate by action type
  const uniqueMap = new Map();
  for (const act of visible) {
    if (!uniqueMap.has(act.type)) {
      uniqueMap.set(act.type, act);
    }
  }
  const uniqueActions = Array.from(uniqueMap.values());

  // 5. Sort in exact canonical order:
  //    1. 🏷️ Clearance Sale
  //    2. 📦 Dead Stock Bundle Offer
  //    3. 📉 Progressive Markdown
  return uniqueActions.sort(
    (a, b) => ACTION_ORDER.indexOf(a.type) - ACTION_ORDER.indexOf(b.type)
  );
}
