import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const COLLECTIONS_TO_DELETE = [
  "tbl_deadstock",
  "tbl_products",
  "tbl_orders",
  "tbl_automations",
  "tbl_deadstockbundles",
];

async function dropUnusedCollections() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB database:", mongoose.connection.name);

    const existingCollections = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name);

    const deletedList = [];

    for (const collName of COLLECTIONS_TO_DELETE) {
      if (existingCollections.includes(collName)) {
        await mongoose.connection.db.dropCollection(collName);
        deletedList.push(collName);
        console.log(`✓ Deleted unused collection from MongoDB: "${collName}"`);
      } else {
        console.log(`- Collection "${collName}" does not exist in MongoDB.`);
      }
    }

    console.log("\n=== COMPLETED MONGODB COLLECTION CLEANUP ===");
    console.log("Deleted Collections List:", deletedList);
    process.exit(0);
  } catch (err) {
    console.error("Error dropping collections:", err);
    process.exit(1);
  }
}

dropUnusedCollections();
