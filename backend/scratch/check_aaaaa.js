const connectDB = require("../config/mongodb");
const MarkdownConfig = require("../models/MarkdownConfig");
const MarkdownRule = require("../models/MarkdownRule");
const SmartBadgeApplication = require("../models/SmartBadgeApplication");
const { getProductWidgetData } = require("../controllers/storefrontController");

async function run() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const shop = "promobile-hub.myshopify.com";
  console.log("=== CHECKING CUSTOMIZATION CONFIG ===");
  const mdConfig = await MarkdownConfig.findOne({ shop }).lean();
  console.log("MarkdownConfig:", mdConfig);

  console.log("=== CHECKING SMART BADGES ===");
  const badges = await SmartBadgeApplication.find({ shop }).lean();
  console.log("SmartBadgeApplications:", badges);

  console.log("=== CHECKING MARKDOWN RULES ===");
  const rules = await MarkdownRule.find({ shop }).lean();
  console.log("MarkdownRules:", rules);

  console.log("=== SIMULATING PRODUCT WIDGET CALL FOR AAAAA ===");
  const mockReq = {
    query: { shop },
    headers: {},
  };
  const mockRes = {
    set: () => {},
    status: () => ({ json: (d) => console.log("Response:", JSON.stringify(d, null, 2)) }),
  };
  await getProductWidgetData(mockReq, mockRes);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
