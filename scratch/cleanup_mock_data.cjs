const path = require("path");
require(path.join(__dirname, "../backend/node_modules/dotenv")).config({ path: path.join(__dirname, "../backend/.env") });
const mongoose = require(path.join(__dirname, "../backend/node_modules/mongoose"));

async function cleanupMockData() {
  console.log("--- CLEANING UP MOCK/SEED DEAD STOCK DATA FROM MONGO ATLAS ---");
  const baseUri = "mongodb+srv://bansibitwiseinfotech_db_user:dAnfjuKYSgliNIi5@cluster0.mt614mu.mongodb.net";
  const dbNames = ["smart-stock", "test"];

  const mockSkus = ["SST-001", "BHT-002", "CCS-003", "WH-001", "RS-002"];
  const mockTitles = ["Summer Shirt", "Beach Hat", "Canvas Shoes", "Wireless Headphones", "Running Shoes"];

  for (const dbName of dbNames) {
    const mongoUri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;
    console.log(`Connecting to database '${dbName}'...`);
    const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();

    const deadstocksCol = conn.db.collection("deadstocks");
    const highdemandsCol = conn.db.collection("highdemands");

    const deadStockResult = await deadstocksCol.deleteMany({
      $or: [{ sku: { $in: mockSkus } }, { title: { $in: mockTitles } }],
    });

    const highDemandResult = await highdemandsCol.deleteMany({
      $or: [{ sku: { $in: mockSkus } }, { title: { $in: mockTitles } }],
    });

    console.log(`[${dbName}] Removed ${deadStockResult.deletedCount} mock deadstock items.`);
    console.log(`[${dbName}] Removed ${highDemandResult.deletedCount} mock highdemand items.`);

    await conn.close();
  }

  console.log("--- CLEANUP COMPLETED SUCCESSFULLY ✅ ---");
}

cleanupMockData().catch((err) => {
  console.error("Cleanup failed ❌:", err);
  process.exit(1);
});
