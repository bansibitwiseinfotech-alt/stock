/**
 * Dead Stock Calculator Helper
 */

function calculateDaysUnsold(lastSoldAt, createdAt) {
  const now = new Date();

  if (lastSoldAt) {
    const saleDate = new Date(lastSoldAt);
    if (!isNaN(saleDate.getTime())) {
      const diffMs = now.getTime() - saleDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Never sold: calculate days based on product creation date
  if (createdAt) {
    const createdDate = new Date(createdAt);
    if (!isNaN(createdDate.getTime())) {
      const diffMs = now.getTime() - createdDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Default fallback if no date available
  return 999;
}

function calculateCashTiedUp(stock, costPrice) {
  const safeStock = Number.isFinite(Number(stock)) && Number(stock) > 0 ? Number(stock) : 0;
  const safeCost = Number.isFinite(Number(costPrice)) && Number(costPrice) > 0 ? Number(costPrice) : 0;
  return Number((safeStock * safeCost).toFixed(2));
}

function calculateSalesVelocity(salesLast30Days) {
  const safeSales = Number.isFinite(Number(salesLast30Days)) && Number(salesLast30Days) > 0 ? Number(salesLast30Days) : 0;
  return Number((safeSales / 30).toFixed(4));
}

function determineStatus(daysUnsold, previousStatus = null, threshold = 60) {
  if (daysUnsold >= threshold) {
    return "dead_stock";
  }

  if (previousStatus === "dead_stock" && daysUnsold < threshold) {
    return "recovered";
  }

  return "active";
}

module.exports = {
  calculateDaysUnsold,
  calculateCashTiedUp,
  calculateSalesVelocity,
  determineStatus,
};
