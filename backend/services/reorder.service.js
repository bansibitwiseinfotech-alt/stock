function calculateReorderQuantity({
    currentStock,
    salesVelocity,
    targetCoverageDays = 30,
}) {
    const stock = Math.max(
        0,
        Number(currentStock) || 0
    );

    const velocity = Math.max(
        0,
        Number(salesVelocity) || 0
    );

    const coverageDays = Math.max(
        1,
        Number(targetCoverageDays) || 30
    );

    // No sales history = cannot safely calculate quantity
    if (velocity <= 0) {
        return {
            quantity: 0,
            status: "INSUFFICIENT_DATA",
            message:
                "Reorder quantity cannot be calculated because there is no sales velocity.",
        };
    }

    const requiredStock = Math.ceil(
        velocity * coverageDays
    );

    const reorderQuantity = Math.max(
        0,
        requiredStock - stock
    );

    return {
        quantity: reorderQuantity,
        status:
            reorderQuantity > 0
                ? "REORDER_REQUIRED"
                : "STOCK_SUFFICIENT",
        message:
            reorderQuantity > 0
                ? `Recommended reorder quantity is ${reorderQuantity} units.`
                : "Current stock is sufficient for the target coverage period.",
    };
}

module.exports = {
    calculateReorderQuantity,
};