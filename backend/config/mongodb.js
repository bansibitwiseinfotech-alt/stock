const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// connectDB
//
// Connects backend mongoose to MongoDB Atlas.
//
// IMPORTANT: This function intentionally does NOT fall back to an in-memory
// database. A silent in-memory fallback was the #1 root cause of the bug
// where data appeared to save successfully but disappeared after server
// restart. If Atlas is unreachable, we fail loudly so the problem is
// immediately visible.
// ─────────────────────────────────────────────────────────────────────────────

// The project has two node_modules directories (backend/ and root/).
// Models in server/ resolve require("mongoose") to ROOT node_modules,
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
    console.log("[MongoDB] Found separate root mongoose instance — will connect both.");
  }
} catch (_) {
  // Root mongoose not found or same instance — no action needed
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  // ==================================================
  // VALIDATE URI
  // ==================================================

  if (!mongoUri) {
    throw new Error(
      "[MongoDB] MONGODB_URI is not defined in environment variables. " +
      "Add it to your .env file before starting the server."
    );
  }

  const connectOpts = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  };

  // ==================================================
  // CONNECT BACKEND MONGOOSE INSTANCE
  // ==================================================

  await mongoose.connect(mongoUri, connectOpts);

  // ==================================================
  // DIAGNOSTICS — verify we are on Atlas, not fallback
  // ==================================================

  console.log("────────────────────────────────────────");
  console.log("[MongoDB] ✅ Connected Successfully");
  console.log("[MongoDB] Host     :", mongoose.connection.host);
  console.log("[MongoDB] Database :", mongoose.connection.name);
  console.log("[MongoDB] State    :", mongoose.connection.readyState);
  console.log("────────────────────────────────────────");

  // ==================================================
  // CONNECT ROOT MONGOOSE INSTANCE (if separate)
  // ==================================================

  if (rootMongoose && rootMongoose.connection.readyState !== 1) {
    await rootMongoose.connect(mongoUri, connectOpts);
    console.log("[MongoDB] ✅ Root Mongoose also connected. Host:", rootMongoose.connection.host);
  }
};

module.exports = connectDB;