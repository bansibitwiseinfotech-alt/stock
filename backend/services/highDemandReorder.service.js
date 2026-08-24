const HighDemandReorder = require(
    "../models/highDemandReorder"
);

async function createReorderRequest({
    shop,
    productId,
    variantId,
    productName,
    variantTitle,
    currentStock,
    salesVelocity,
    recommendedQuantity,
    requestedQuantity,
    targetCoverageDays,
}) {
    if (!shop) {
        throw new Error("Shop is required");
    }

    if (!variantId) {
        throw new Error(
            "Variant ID is required"
        );
    }

    const quantity = Number(
        requestedQuantity
    );

    if (
        !Number.isFinite(quantity) ||
        quantity <= 0
    ) {
        throw new Error(
            "Requested quantity must be greater than 0"
        );
    }

    const reorder =
        await HighDemandReorder.create({
            shop,
            productId,
            variantId,
            productName,
            variantTitle,
            currentStock:
                Number(currentStock) || 0,
            salesVelocity:
                Number(salesVelocity) || 0,
            recommendedQuantity:
                Number(recommendedQuantity) || 0,
            requestedQuantity: quantity,
            targetCoverageDays:
                Number(targetCoverageDays) || 30,
            status: "PENDING",
        });

    return reorder;
}

module.exports = {
    createReorderRequest,
};