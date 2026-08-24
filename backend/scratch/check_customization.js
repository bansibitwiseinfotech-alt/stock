const connectDB = require("../config/mongodb");
const { loadCustomizationSettings } = require("../services/smartBadgeCustomizationLoader");

async function checkCustomization() {
  require("dotenv").config({ path: "../.env" });
  await connectDB();

  const settings = await loadCustomizationSettings("promobile-hub.myshopify.com");
  console.log("------------------------------------------");
  console.log("LOADED CUSTOMIZATION SETTINGS:");
  console.log(JSON.stringify(settings, (key, value) => value instanceof Set ? Array.from(value) : value, 2));
  console.log("------------------------------------------");

  process.exit(0);
}

checkCustomization().catch(e => { console.error(e); process.exit(1); });
