const mongoose = require("mongoose");

// The project has two separate node_modules directories (backend/ and root/).
// Models in server/ resolve require("mongoose") to the ROOT node_modules,
// while backend/ code resolves to backend/node_modules.
// We must connect BOTH instances so all models work against the same database.
let rootMongoose;
try {
  const rootMongoosePath = require.resolve("mongoose", {
    paths: [require("path").resolve(__dirname, "../../")],
  });
  const resolved = require(rootMongoosePath);
  if (resolved !== mongoose) {
    rootMongoose = resolved;
  }
} catch (_) {
  // Root mongoose not found or same instance — no action needed
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables.");
    }

    const connectOpts = {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    };

    // Connect the backend mongoose instance
    mongoose.set("bufferCommands", false);
    await mongoose.connect(mongoUri, connectOpts);
    console.log("MongoDB Connected Successfully ✅ Database:", mongoose.connection.name);

    // Also connect the root mongoose instance (used by server/ models)
    if (rootMongoose && rootMongoose.connection.readyState !== 1) {
      rootMongoose.set("bufferCommands", false);
      await rootMongoose.connect(mongoUri, connectOpts);
      console.log("Root Mongoose Connected Successfully ✅");
    }
  } catch (error) {
    console.error("MongoDB Connection Failed ❌", error.message);
  }
};

module.exports = connectDB;