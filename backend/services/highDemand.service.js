// ==================================================
// SALES VELOCITY
// ==================================================

function calculateSalesVelocity(last30DaysSales) {
  const sales = Number(last30DaysSales) || 0;
  return Number((sales / 30).toFixed(2));
}

// ==================================================
// DAYS UNTIL STOCKOUT
// ==================================================

function calculateDaysUntilStockout(currentStock, salesVelocity) {
  const stock = Number(currentStock) || 0;
  const velocity = Number(salesVelocity) || 0;

  if (stock <= 0) {
    return 0;
  }

  if (velocity <= 0) {
    return null;
  }

  return Number((stock / velocity).toFixed(2));
}

// ==================================================
// RISK LEVEL
// ==================================================

function calculateRiskLevel(arg1, arg2, arg3) {
  // Support both (daysUntilStockout, currentStock, salesVelocity)
  // and (currentStock, daysUntilStockout, salesVelocity)
  let daysUntilStockout = null;
  let currentStock = 0;
  let salesVelocity = 0;

  if (typeof arg2 === "number" && typeof arg1 === "number" && arg1 > 0 && (arg2 === null || arg2 <= 0 || arg2 > 0)) {
    // If called as (currentStock, daysUntilStockout, salesVelocity)
    currentStock = arg1;
    daysUntilStockout = arg2;
    salesVelocity = Number(arg3) || 0;
  } else {
    // If called as (daysUntilStockout, currentStock, salesVelocity)
    daysUntilStockout = arg1;
    currentStock = Number(arg2) || 0;
    salesVelocity = Number(arg3) || 0;
  }

  const stock = Number(currentStock) || 0;
  const velocity = Number(salesVelocity) || 0;
  const days = daysUntilStockout;

  if (stock === 0 || stock <= 0) {
    return "CRITICAL";
  }

  if (velocity === 0 || days === null) {
    return "SAFE";
  }

  if (days <= 3) {
    return "CRITICAL";
  }

  if (days > 3 && days <= 7) {
    return "HIGH";
  }

  if (days > 7 && days <= 14) {
    return "MEDIUM";
  }

  return "SAFE";
}

// ==================================================
// REORDER QUANTITY
// ==================================================

function calculateReorderQuantity(
  currentStock,
  salesVelocity,
  targetCoverageDays = 30
) {
  // Support object parameter { currentStock, salesVelocity, targetCoverageDays }
  let stock = 0;
  let velocity = 0;
  let coverage = 30;

  if (typeof currentStock === "object" && currentStock !== null) {
    stock = Number(currentStock.currentStock) || 0;
    velocity = Number(currentStock.salesVelocity) || 0;
    coverage = Number(currentStock.targetCoverageDays) || 30;
  } else {
    stock = Number(currentStock) || 0;
    velocity = Number(salesVelocity) || 0;
    coverage = Number(targetCoverageDays) || 30;
  }

  if (velocity <= 0) {
    return 0;
  }

  const requiredStock = velocity * coverage;
  return Math.max(0, Math.ceil(requiredStock - stock));
}

// ==================================================
// SHIELD ACTION
// ==================================================

function getShieldAction({
  currentStock = 0,
  salesVelocity = 0,
  daysUntilStockout = null,
  riskLevel = "SAFE",
  reorderQuantity = 0,
} = {}) {
  const stock = Number(currentStock) || 0;

  if (stock === 0 || stock <= 0) {
    return {
      action: "IMMEDIATE_REORDER",
      recommendedAction: "IMMEDIATE_REORDER",
      label: "🚨 Immediate Reorder",
      actionLabel: "🚨 Immediate Reorder",
      priority: "CRITICAL",
      actionPriority: "CRITICAL",
      message: "Product is out of stock.",
      actionMessage: "Product is out of stock.",
    };
  }

  if (riskLevel === "CRITICAL") {
    return {
      action: "IMMEDIATE_REORDER",
      recommendedAction: "IMMEDIATE_REORDER",
      label: "🚨 Immediate Reorder",
      actionLabel: "🚨 Immediate Reorder",
      priority: "CRITICAL",
      actionPriority: "CRITICAL",
      message: "Product is expected to stock out very soon.",
      actionMessage: "Product is expected to stock out very soon.",
    };
  }

  if (riskLevel === "HIGH") {
    return {
      action: "REORDER_STOCK",
      recommendedAction: "REORDER_STOCK",
      label: "📦 Reorder Stock",
      actionLabel: "📦 Reorder Stock",
      priority: "HIGH",
      actionPriority: "HIGH",
      message: "Product may stock out soon. Restock needed.",
      actionMessage: "Product may stock out soon. Restock needed.",
    };
  }

  if (riskLevel === "MEDIUM") {
    return {
      action: "MONITOR",
      recommendedAction: "MONITOR",
      label: "👀 Monitor",
      actionLabel: "👀 Monitor",
      priority: "MEDIUM",
      actionPriority: "MEDIUM",
      message: "Demand is elevated. Monitor inventory.",
      actionMessage: "Demand is elevated. Monitor inventory.",
    };
  }

  return {
    action: "NO_ACTION",
    recommendedAction: "NO_ACTION",
    label: "✓ No Immediate Action Required",
    actionLabel: "✓ No Immediate Action Required",
    priority: "LOW",
    actionPriority: "LOW",
    message: "Inventory level is currently safe.",
    actionMessage: "Inventory level is currently safe.",
  };
}

module.exports = {
  calculateSalesVelocity,
  calculateDaysUntilStockout,
  calculateRiskLevel,
  calculateReorderQuantity,
  getShieldAction,
};
