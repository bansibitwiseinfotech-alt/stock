const mongoose = require("mongoose");

const MarkdownConfigSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    badgeText: { type: String, default: "{discount}% OFF" },
    showStrikethroughPrice: { type: Boolean, default: true },
    badgeBackgroundColor: { type: String, default: "#E53935" },
    badgeTextColor: { type: String, default: "#FFFFFF" },
    priceColor: { type: String, default: "#111111" },
    strikethroughColor: { type: String, default: "#757575" },
    borderRadius: { type: Number, default: 4 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MarkdownConfig ||
  mongoose.model("MarkdownConfig", MarkdownConfigSchema, "tbl_markdownconfigs");
