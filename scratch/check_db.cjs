const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("../backend/config/mongodb");

const Store = require("../backend/models/Store");

async function check() {
  await connectDB();
  const stores = await Store.find({}).lean();
  console.log("Total stores in MongoDB tbl_stores:", stores.length);
  console.log(JSON.stringify(stores, null, 2));
  mongoose.connection.close();
}

check();
