const http = require("http");

console.log("Connecting to live backend for shop: promobile-hub.myshopify.com...");

const postData = JSON.stringify({ shop: "promobile-hub.myshopify.com" });

const req = http.request(
  {
    hostname: "localhost",
    port: 5000,
    path: "/api/smart-badges/scan?shop=promobile-hub.myshopify.com",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      "x-shopify-shop-domain": "promobile-hub.myshopify.com",
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      console.log("HTTP Status:", res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log("Success:", json.success);
        console.log("Total Scanned:", json.scanned);
        console.log("Summary:", JSON.stringify(json.summary, null, 2));
        if (json.products && json.products.length > 0) {
          console.log("\nFirst 3 Real Products Analyzed:");
          json.products.slice(0, 3).forEach((p, idx) => {
            console.log(`\n[${idx + 1}] Title: ${p.title} (ID: ${p.productId})`);
            console.log(`    Inventory: ${p.inventory} | Sales (30d): ${p.unitsSold30d} | Velocity: ${p.salesVelocity}/day`);
            console.log(`    Stock Risk: ${p.stockRisk} | Days Until Stockout: ${p.daysUntilStockout}`);
            console.log(`    Recommendation: ${p.recommendation.badge} (Score: ${p.recommendation.score}, Confidence: ${p.recommendation.confidence})`);
            console.log(`    Reason: ${p.recommendation.reason}`);
          });
        }
      } catch (e) {
        console.log("Raw Response:", data);
      }
    });
  }
);

req.on("error", (e) => console.error("Request Error:", e));
req.write(postData);
req.end();
