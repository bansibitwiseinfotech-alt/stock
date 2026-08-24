const mongoose = require("mongoose");

const storefrontSaleSettingsSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    title: {
      type: String,
      default: "Clearance Sale",
    },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },

    limitedTimeText: {
      type: String,
      default: "Limited time offer",
    },

    fontFamily: {
      type: String,
      default: "Arial",
    },

    fontSize: {
      type: String,
      default: "18px",
    },

    fontWeight: {
      type: String,
      default: "700",
    },

    textColor: {
      type: String,
      default: "#ffffff",
    },

    backgroundColor: {
      type: String,
      default: "#dc2626",
    },

    borderColor: {
      type: String,
      default: "#b91c1c",
    },

    borderRadius: {
      type: String,
      default: "8px",
    },

    buttonText: {
      type: String,
      default: "Shop Now",
    },

    buttonTextColor: {
      type: String,
      default: "#ffffff",
    }, 

    buttonBackgroundColor: {
      type: String,
      default: "#111827",
    },

    customCss: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "StorefrontSaleSettings",
  storefrontSaleSettingsSchema,
  "tbl_storefrontsalesettings"
);