const mongoose = require("mongoose");

const bundleProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: [true, "Product ID is required."],
    },

    variantId: {
      type: String,
      default: null,
    },

    title: {
      type: String,
      required: [true, "Product title is required."],
    },

    handle: {
      type: String,
      default: null,
    },

    image: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: {
        values: ["BUY", "GET_FREE"],
        message: "Role must be either BUY or GET_FREE.",
      },
      required: [true, "Role is required."],
    },
  },
  { _id: false }
);

const deadStockBundleSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: [true, "Shop is required."],
      index: true,
    },

    bundleName: {
      type: String,
      required: [true, "Bundle name is required."],
      trim: true,
    },

    offerType: {
      type: String,
      enum: {
        values: ["BOGO"],
        message: "Only BOGO offer is supported.",
      },
      default: "BOGO",
      required: [true, "Offer type is required."],
    },

    products: {
      type: [bundleProductSchema],   
      required: [true, "Products are required."],
      validate: [
        {
          validator: function (products) {
            return Array.isArray(products) && products.length >= 2 && products.length <= 3;
          },
          message: "A BOGO bundle must contain 2 or 3 products.",
        },
        {
          validator: function (products) {
            if (!Array.isArray(products)) return false;
            const buyCount = products.filter((p) => p.role === "BUY").length;
            return buyCount === 1;
          },
          message: "BOGO bundle must have exactly 1 BUY product.",
        },
        {
          validator: function (products) {
            if (!Array.isArray(products)) return false;
            const getFreeCount = products.filter((p) => p.role === "GET_FREE").length;
            return getFreeCount >= 1 && getFreeCount <= 2;
          },
          message: "BOGO bundle can contain maximum 2 GET_FREE products.",
        },
      ],
    },

    buyProductId: {
      type: String,
      required: [true, "BUY product ID is required."],
    },

    getProductIds: {
      type: [String],
      required: [true, "GET FREE product IDs are required."],
      validate: {
        validator: function (ids) {
          return Array.isArray(ids) && ids.length >= 1 && ids.length <= 2;
        },
        message: "A BOGO bundle can have maximum 2 free products.",
      },
    },

    status: {
      type: String,
      enum: {
        values: ["DRAFT", "ACTIVE", "INACTIVE"],
        message: "Status must be DRAFT, ACTIVE, or INACTIVE.",
      },
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
  }
);

// Helpful transformations for JSON serialization
deadStockBundleSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret.__v;
    return ret;
  },
});

module.exports = 
  mongoose.models.DeadStockBundle ||
  mongoose.model("DeadStockBundle", deadStockBundleSchema, "tbl_deadstockbundles");