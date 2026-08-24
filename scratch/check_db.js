const mongoose = require("mongoose");
const connectDB = require("../backend/config/mongodb");
const ClearanceSale = require("../backend/models/ClearanceSale");
const ClearanceSaleConfig = require("../backend/models/ClearanceSaleConfig");

async function check() {
  await connectDB();
  console.log("=== ClearanceSaleConfig ===");
  const configs = await ClearanceSaleConfig.find({}).lean();
  console.log(JSON.stringify(configs, null, 2));

  console.log("=== ClearanceSale Active Sales ===");
  const sales = await ClearanceSale.find({}).lean();
  console.log(JSON.stringify(sales, null, 2));

  process.exit(0);
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
