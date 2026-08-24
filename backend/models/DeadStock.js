const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// DeadStock model — MongoDB collection: tb_deadstock
//
// Populated by runDeadStockEngine() via POST /api/dead-stock/sync.
// Used by Dead Stock Mode (showStoreProducts = false) for filtered,
// offset-paginated listing with sales-history fields (daysUnsold, etc.)
//
// NOT used for the main product listing — that uses Shopify GraphQL directly.
// ─────────────────────────────────────────────────────────────────────────────
const deadStockSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, index: true },

    // Shopify IDs
    productId: { type: String, required: true },
    variantId: { type: String, default: "" },

    // Product info
    title: { type: String, default: "" },
    sku: { type: String, default: "" },
    image: { type: String, default: "" },
    handle: { type: String, default: "" },
    status: { type: String, default: "active" },

    // Inventory
    stock: { type: Number, default: 0 },
    locationId: { type: String, default: "" },
    locationName: { type: String, default: "" },

    // Pricing
    costPrice: { type: Number, default: 0 },
    currentPrice: { type: Number, default: 0 },
    cashTiedUp: { type: Number, default: 0 },

    // Sales history (populated by dead stock engine via Orders API)
    daysUnsold: { type: Number, default: 0 },
    lastSoldAt: { type: Date, default: null },
    salesVelocity: { type: Number, default: 0 },
    salesLast7Days: { type: Number, default: 0 },
    salesLast30Days: { type: Number, default: 0 },
    salesLast60Days: { type: Number, default: 0 },

    // Classification
    deadStockStatus: {
      type: String,
      enum: ["dead_stock", "slow_moving", "out_of_stock", "in_stock", "active"],
      default: "active",
    },

    // Collection membership (for collection-based filtering)
    collectionIds: [{ type: String }],
  },
  {
    timestamps: true,
    collection: "tbl_deadstock",
  }
);

// Compound index for fast shop-scoped queries
deadStockSchema.index({ shopId: 1, productId: 1, variantId: 1 }, { unique: true });
deadStockSchema.index({ shopId: 1, daysUnsold: -1 });
deadStockSchema.index({ shopId: 1, status: 1 });
deadStockSchema.index({ shopId: 1, locationId: 1 });

module.exports = mongoose.model("DeadStock", deadStockSchema, "tbl_deadstock");
