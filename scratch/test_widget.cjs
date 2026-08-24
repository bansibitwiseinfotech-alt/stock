const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../backend/config/mongodb");
const ClearanceSale = require("../server/models/ClearanceSale");
const ClearanceSaleConfig = require("../server/models/ClearanceSaleConfig");

async function test() {
  await connectDB();
  const shopId = "promobile-hub.myshopify.com";
  const cleanVarId = "42734944518231";
  const cleanProdId = "7635374276695";
  const now = new Date();

  const clearanceQuery = {
    shop: shopId,
    status: { $in: ["ACTIVE", "SCHEDULED"] },
    startDate: { $lte: now },
    endDate: { $gt: now },
  };

  if (cleanVarId) {
    clearanceQuery.variantId = { $in: [cleanVarId, `gid://shopify/ProductVariant/${cleanVarId}`] };
  }

  if (cleanProdId) {
    clearanceQuery.productId = { $in: [cleanProdId, `gid://shopify/Product/${cleanProdId}`] };
  }

  console.log("Query:", JSON.stringify(clearanceQuery, null, 2));

  const result = await ClearanceSale.findOne(clearanceQuery).sort({ createdAt: -1 }).lean();
  console.log("Result:", result);

  const config = await ClearanceSaleConfig.findOne({ shopId }).lean();
  console.log("Config:", config);

  process.exit(0);
}

test().catch(console.error);
