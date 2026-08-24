const mongoose = require("mongoose");

const highDemandStorefrontSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    variantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    productId: {
      type: String,
      default: "",
      trim: true,
    },

    lowStockBadge: {
      enabled: {
        type: Boolean,
        default: false,
      },
      threshold: {
        type: Number,
        default: 5,
      },
      showDaysRemaining: {
        type: Boolean,
        default: true,
      },
    },

    preOrder: {
      enabled: {
        type: Boolean,
        default: false,
      },
      buttonText: {
        type: String,
        default: "🛒 Pre-Order Now",
      },
    },

    notifyMe: {
      enabled: {
        type: Boolean,
        default: true,
      },
      buttonText: {
        type: String,
        default: "🔔 Notify Me",
      },
    },

    monitor: {
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // Legacy fields for backward compatibility
    urgencyBadgeEnabled: {
      type: Boolean,
      default: false,
    },

    preOrderEnabled: {
      type: Boolean,
      default: false,
    },

    notifyMeEnabled: {
      type: Boolean,
      default: true,
    },

    badgeText: {
      type: String,
      default: "Only {stock} left in stock!",
    },

    badgeColor: {
      type: String,
      default: "#991B1B",
    },

    badgeBackgroundColor: {
      type: String,
      default: "#FFF1F2",
    },

    preOrderText: {
      type: String,
      default: "Pre-Order Now",
    },
  },
  {
    timestamps: true,
  }
);

highDemandStorefrontSchema.index(
  { shop: 1, variantId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.HighDemandStorefront ||
  mongoose.model(
    "HighDemandStorefront",
    highDemandStorefrontSchema,
    "tbl_high_demand_storefronts"
  );
