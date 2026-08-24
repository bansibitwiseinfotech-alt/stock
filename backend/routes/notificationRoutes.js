const express = require("express");
const router = express.Router();
const {
  listNotifications,
  removeNotification,
  triggerRestock,
  handleInventoryWebhook,
} = require("../controllers/notificationController");

router.get("/", listNotifications);
router.delete("/:id", removeNotification);
router.post("/test-restock", triggerRestock);
router.post("/webhook/inventory-update", handleInventoryWebhook);

module.exports = router;
