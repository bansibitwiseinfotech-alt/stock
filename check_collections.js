import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkCollections() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB database:", mongoose.connection.name);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\n=== ALL MONGODB COLLECTIONS & DOCUMENT COUNTS ===");
    for (const c of collections) {
      const count = await mongoose.connection.db.collection(c.name).countDocuments();
      console.log(`- Collection Name: "${c.name}" | Document Count: ${count}`);
    }
    process.exit(0);
  } catch (err) {
    console.error("Error listing collections:", err);
    process.exit(1);
  }
}

checkCollections();
