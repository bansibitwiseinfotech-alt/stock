const ClearanceSale = require("../models/ClearanceSale");
const DeadStockAction = require("../models/DeadStockAction");

async function updateSaleActionStatus(sale, status) {
  await DeadStockAction.updateOne(
    {
      shop: sale.shop,
      actionType: "CLEARANCE_SALE_CREATED",
      "metadata.shopifyDiscountId": sale.shopifyDiscountId,
      status: { $in: ["SCHEDULED", "ACTIVE"] },
    },
    { $set: { status } }
  ).catch(() => {});
}

async function processClearanceSales(now = new Date()) {
  const scheduledSales = await ClearanceSale.find({
    status: "SCHEDULED",
    startDate: { $lte: now },
    endDate: { $gt: now },
  }).lean();

  for (const sale of scheduledSales) {
    const updated = await ClearanceSale.findOneAndUpdate(
      { _id: sale._id, status: "SCHEDULED" },
      { $set: { status: "ACTIVE" } },
      { returnDocument: "after" }
    ).lean();
    if (updated) await updateSaleActionStatus(updated, "ACTIVE");
  }

  const expiredSales = await ClearanceSale.find({
    status: { $in: ["SCHEDULED", "ACTIVE"] },
    endDate: { $lte: now },
  }).lean();

  for (const sale of expiredSales) {
    const updated = await ClearanceSale.findOneAndUpdate(
      { _id: sale._id, status: { $in: ["SCHEDULED", "ACTIVE"] } },
      { $set: { status: "EXPIRED" } },
      { returnDocument: "after" }
    ).lean();
    if (updated) await updateSaleActionStatus(updated, "EXPIRED");
  }

  return { activated: scheduledSales.length, expired: expiredSales.length };
}

module.exports = { processClearanceSales };
