const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connectDB = require("../backend/config/mongodb");
const ClearanceSale = require("../server/models/ClearanceSale");
const ClearanceSaleConfig = require("../server/models/ClearanceSaleConfig");

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
