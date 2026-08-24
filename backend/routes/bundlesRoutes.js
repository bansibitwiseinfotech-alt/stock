const express = require("express");
const router = express.Router();
const { getBundles, createBundle } = require("../controllers/bundlesController");
const { authenticateShop } = require("../middleware/auth");

router.use(authenticateShop);
router.get("/", getBundles);
router.post("/", createBundle);

module.exports = router;
