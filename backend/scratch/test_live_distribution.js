const connectDB = require("../config/mongodb");
const Store = require("../models/Store");
const { runSmartBadgeAnalysis } = require("../controllers/smartBadgeController");

async function testLiveDistribution() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const store = await Store.findOne({ shop: /promobile-hub/i }).lean();
  if (!store) {
    console.log("Store not found");
    process.exit(1);
  }

  const { products, summary } = await runSmartBadgeAnalysis({
    shop: store.shop,
    accessToken: store.accessToken,
  });

  console.log("----------------------------------------------");
  console.log("LIVE SCAN SUMMARY FOR PROMOBILE-HUB:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("----------------------------------------------");

  const sampleByBadge = {};
  for (const p of products) {
    const badge = p.recommendation.badge;
    if (!sampleByBadge[badge]) sampleByBadge[badge] = [];
    if (sampleByBadge[badge].length < 2) {
      sampleByBadge[badge].push({
        title: p.title,
        inventory: p.inventory,
        velocity: p.salesVelocity,
        badge: p.recommendation.badge,
        score: p.recommendation.score,
        confidence: p.recommendation.confidence,
        reason: p.recommendation.reason,
      });
    }
  }

  console.log("SAMPLE PRODUCTS PER BADGE CATEGORY:");
  console.log(JSON.stringify(sampleByBadge, null, 2));

  process.exit(0);
}

testLiveDistribution().catch(e => { console.error(e); process.exit(1); });
