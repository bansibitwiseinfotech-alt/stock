const mongoose = require("mongoose");

const PreOrderConfigSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    buttonText: { type: String, default: "PRE-ORDER NOW" },
    badgeText: { type: String, default: "🛒 PRE-ORDER" },
    launchLabel: { type: String, default: "NEW LAUNCH" },
    cardBackgroundColor: { type: String, default: "#FFFFFF" },
    borderColor: { type: String, default: "#E2E8F0" },
    textColor: { type: String, default: "#111827" },
    accentColor: { type: String, default: "#4F46E5" },
    badgeBackgroundColor: { type: String, default: "#0F172A" },
    badgeTextColor: { type: String, default: "#FFFFFF" },
    borderRadius: { type: Number, default: 12 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PreOrderConfig ||
  mongoose.model("PreOrderConfig", PreOrderConfigSchema, "tbl_preorderconfigs");
