const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });

const Store = require("../backend/models/Store");
const shopifyGraphQL = require("../backend/services/shopifyGraphql");
const ClearanceSale = require("../backend/models/ClearanceSale");
const connectDB = require("../backend/config/mongodb");

async function main() {
  await connectDB();
  console.log("MongoDB Connected ✅");

  const shop = "promobile-hub.myshopify.com";
  const store = await Store.findOne({ shop }).lean();

  if (!store || !store.accessToken) {
    console.error("Store not found or missing access token");
    process.exit(1);
  }

  console.log("Found Store:", store.shop);

  // 1. Query all automatic discount nodes from Shopify GraphQL
  const query = `
    query GetAllDiscounts {
      discountNodes(first: 50) {
        nodes {
          id
          discount {
            ... on DiscountAutomaticBasic {
              title
              status
            }
            ... on DiscountAutomaticApp {
              title
              status
            }
            ... on DiscountAutomaticBxgy {
              title
              status
            }
          }
        }
      }
    }
  `;

  try {
    const res = await shopifyGraphQL(shop, store.accessToken, query);
    const nodes = res?.discountNodes?.nodes || [];
    console.log(`Found ${nodes.length} discount nodes in Shopify.`);

    const deleteMutation = `
      mutation discountAutomaticDelete($id: ID!) {
        discountAutomaticDelete(id: $id) {
          deletedAutomaticDiscountId
          userErrors {
            field
            message
          }
        }
      }
    `;

    for (const node of nodes) {
      const title = node.discount?.title || "";
      console.log(`- Discount ID: ${node.id} | Title: "${title}" | Status: ${node.discount?.status}`);

      // If it's a Clearance discount or contains Clearance
      if (title.toLowerCase().includes("clearance") || title.includes("1786442096660") || title.toLowerCase().includes("apple iphone 17 pro")) {
        console.log(`  🗑️ Deleting Shopify Discount: ${node.id} ("${title}")...`);
        const delRes = await shopifyGraphQL(shop, store.accessToken, deleteMutation, { id: node.id });
        console.log("  Result:", JSON.stringify(delRes));
      }
    }
  } catch (err) {
    console.error("GraphQL Error:", err.message);
  }

  // 2. Clean any local clearance sales records
  const cleared = await ClearanceSale.deleteMany({ shop });
  console.log(`Deleted ${cleared.deletedCount} local ClearanceSale records from DB.`);

  console.log("\n🎉 ALL CLEARANCE DISCOUNTS CLEANED SUCCESSFULLY!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
