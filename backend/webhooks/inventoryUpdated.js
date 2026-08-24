const DeadStock = require("../models/DeadStock");
const { calculateCashTiedUp } = require("../services/deadStock/deadStockCalculator");

async function handleInventoryUpdated(shopId, inventoryData) {
  try {
    if (!shopId || !inventoryData?.inventory_item_id) return;

    const stock = Number(inventoryData.available) || 0;
    const inventoryItemId = inventoryData.inventory_item_id;

    const items = await DeadStock.find({ shopId }).lean();
    for (const item of items) {
      if (item.stock !== stock) {
        const cashTiedUp = calculateCashTiedUp(stock, item.costPrice);
        await DeadStock.updateOne(
          { _id: item._id },
          { $set: { stock, cashTiedUp } }
        );
      }
    }
  } catch (error) {
    console.error("Webhook handleInventoryUpdated Error:", error.message);
  }
}

module.exports = handleInventoryUpdated;
