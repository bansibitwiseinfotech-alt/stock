const express = require("express");
const router = express.Router();
const {
  createSupportRequest,
  getSupportRequests,
} = require("../controllers/contactSupportController");

router.post("/", createSupportRequest);
router.get("/", getSupportRequests);

module.exports = router;
