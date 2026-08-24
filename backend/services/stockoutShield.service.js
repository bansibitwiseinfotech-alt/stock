function getStockoutShieldAction({
  currentStock,
  salesVelocity,
  daysUntilStockout,
  riskLevel,
}) {
  const stock = Number(currentStock) || 0;

  // Stock completely finished or critical risk
  if (stock <= 0 || riskLevel === "CRITICAL") {
    return {
      action: "IMMEDIATE_REORDER",
      actionLabel: "🚨 Immediate Reorder",
      priority: "CRITICAL",
      message: stock <= 0
        ? "Product is out of stock."
        : "Product is expected to stock out soon.",
    };
  }

  // High risk: >3–7 days
  if (riskLevel === "HIGH") {
    return {
      action: "REORDER_SOON",
      actionLabel: "📦 Reorder Soon",
      priority: "HIGH",
      message: "Product has a high stockout risk based on current sales velocity.",
    };
  }

  // Medium risk: >7–14 days
  if (riskLevel === "MEDIUM") {
    return {
      action: "MONITOR",
      actionLabel: "👀 Monitor",
      priority: "MEDIUM",
      message: "Monitor inventory because demand may cause stockout within 14 days.",
    };
  }

  // Safe / No Action
  return {
    action: "NO_ACTION",
    actionLabel: "✅ No Action",
    priority: "LOW",
    message: "Current inventory is sufficient based on recent sales velocity.",
  };
}

module.exports = {
  getStockoutShieldAction,
};