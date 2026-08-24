/**
 * Evaluates bundle (Frequently Bought Together) opportunity using real Shopify order co-purchases
 */
function analyzeBundleOpportunity({
  productId,
  coPurchasesMap = {},
  totalOrdersWithProduct = {},
  productMap = {},
}) {
  const pairings = coPurchasesMap[productId];
  if (!pairings || Object.keys(pairings).length === 0) {
    return {
      hasBundle: false,
      topComplementaryProductId: null,
      topComplementaryProductTitle: null,
      coPurchaseCount: 0,
      relationshipStrength: 0,
    };
  }

  // Find top co-purchased product
  let topProductId = null;
  let maxCount = 0;

  for (const [otherId, count] of Object.entries(pairings)) {
    if (count > maxCount) {
      maxCount = count;
      topProductId = otherId;
    }
  }

  if (!topProductId || maxCount < 1) {
    return {
      hasBundle: false,
      topComplementaryProductId: null,
      topComplementaryProductTitle: null,
      coPurchaseCount: 0,
      relationshipStrength: 0,
    };
  }

  const totalOrders = totalOrdersWithProduct[productId] || 1;
  const relationshipStrength = parseFloat((maxCount / totalOrders).toFixed(2));
  const complementaryProduct = productMap[topProductId];

  return {
    hasBundle: true,
    topComplementaryProductId: topProductId,
    topComplementaryProductTitle: complementaryProduct?.title || null,
    coPurchaseCount: maxCount,
    relationshipStrength, // 0.0 to 1.0
  };
}

module.exports = {
  analyzeBundleOpportunity,
};
