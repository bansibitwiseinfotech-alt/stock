const connectDB = require("../config/mongodb");
const ClearanceSaleConfig = require("../models/ClearanceSaleConfig");
const BundleConfig = require("../models/BundleConfig");
const MarkdownConfig = require("../models/MarkdownConfig");
const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");
const PreOrderConfig = require("../models/PreOrderConfig");

async function inspectConfigs() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const [clearance, bundle, markdown, lowStock, preOrder] = await Promise.all([
    ClearanceSaleConfig.find({}).lean(),
    BundleConfig.find({}).lean(),
    MarkdownConfig.find({}).lean(),
    LowStockBadgeConfig.find({}).lean(),
    PreOrderConfig.find({}).lean(),
  ]);

  console.log("Clearance configs:", clearance);
  console.log("Bundle configs:", bundle);
  console.log("Markdown configs:", markdown);
  console.log("LowStock configs:", lowStock);
  console.log("PreOrder configs:", preOrder);

  process.exit(0);
}

inspectConfigs().catch(e => { console.error(e); process.exit(1); });
