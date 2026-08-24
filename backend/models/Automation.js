const mongoose = require("mongoose");

const automationSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    trigger: { type: String, required: true }, // e.g. "Stock <= 5", "Stock = 0", "No sale 30 days"
    action: { type: String, required: true }, // e.g. "Show badge on product", "Enable pre-order"
    type: {
      type: String,
      enum: ["low_stock_badge", "pre_order", "progressive_markdown", "clearance_tagging"],
      required: true,
    },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

automationSchema.index({ shopId: 1, type: 1 });

module.exports = mongoose.model("Automation", automationSchema, "tbl_automations");
