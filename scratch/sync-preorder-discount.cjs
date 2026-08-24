const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });

const connectDB = require("../backend/config/mongodb");
const Store = require("../backend/models/Store");
const LaunchPreOrder = require("../backend/models/LaunchPreOrder");
const shopifyGraphQL = require("../backend/services/shopifyGraphql");

const CREATE_AUTOMATIC_DISCOUNT_MUTATION = `
mutation discountAutomaticBasicCreate(
  $automaticBasicDiscount: DiscountAutomaticBasicInput!
) {
  discountAutomaticBasicCreate(
    automaticBasicDiscount: $automaticBasicDiscount
  ) {
    automaticDiscountNode {
      id
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

async function main() {
  await connectDB();
  console.log("MongoDB Connected ✅");

  const shop = "promobile-hub.myshopify.com";
  const store = await Store.findOne({ shop }).lean();
  const config = await LaunchPreOrder.findOne({ shop }).lean();

  if (!store || !config) {
    console.error("Missing store or config");
    process.exit(1);
  }

  console.log(`Config found for product: ${config.productId} (${config.productTitle})`);
  console.log(`Deposit %: ${config.depositPercentage}% | Launch Date: ${config.launchDate}`);

  const rawProdId = String(config.productId).replace(/^gid:\/\/shopify\/Product\//, "");
  const formattedProdGid = `gid://shopify/Product/${rawProdId}`;
  const discountPercent = (100 - Number(config.depositPercentage || 50)) / 100;

  const automaticBasicDiscount = {
    title: `Pre-Order ${config.depositPercentage}% Deposit - ${config.productTitle || "Apple iPhone 17 Pro"}`,
    startsAt: new Date().toISOString(),
    endsAt: new Date(config.launchDate).toISOString(),
    customerGets: {
      value: {
        percentage: discountPercent,
      },
      items: {
        products: {
          productsToAdd: [formattedProdGid],
        },
      },
    },
  };

  console.log("Creating Shopify Automatic Basic Discount for 50% Deposit:", JSON.stringify(automaticBasicDiscount, null, 2));

  const res = await shopifyGraphQL(shop, store.accessToken, CREATE_AUTOMATIC_DISCOUNT_MUTATION, {
    automaticBasicDiscount,
  });

  console.log("Shopify Response:", JSON.stringify(res, null, 2));

  const discountId = res?.discountAutomaticBasicCreate?.automaticDiscountNode?.id;
  if (discountId) {
    await LaunchPreOrder.updateOne({ _id: config._id }, { $set: { shopifyDiscountId: discountId } });
    console.log(`✅ Saved shopifyDiscountId: ${discountId} to LaunchPreOrder document!`);
  }

  console.log("\n🎉 PRE-ORDER 50% DEPOSIT DISCOUNT CREATED AND SYNCED SUCCESSFULLY!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
