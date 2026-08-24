const mongoose = require("mongoose");

const markdownRuleSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: String,
      required: true,
      index: true,
    },

    variantId: {
      type: String,
      required: true,
      index: true,
    },

    actionType: {
      type: String,
      default: "PROGRESSIVE_MARKDOWN",
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    startingDiscount: {
      type: Number,
      required: true,
      default: 10,
      min: 5,
      max: 50,
    },

    increasePercent: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      max: 50,
    },

    // Backward-compatible alias for increasePercent
    incrementPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },

    decreasePercent: {
      type: Number,
      required: true,
      default: 3,
      min: 0,
      max: 50,
    },

    minimumDiscount: {
      type: Number,
      required: true,
      default: 5,
      min: 5,
      max: 50,
    },

    maximumDiscount: {
      type: Number,
      required: true,
      default: 50,
      min: 5,
      max: 50,
    },

    currentDiscount: {
      type: Number,
      required: true,
      default: 10,
      min: 5,
      max: 50,
    },

    evaluationIntervalHours: {
      type: Number,
      default: 24,
    },

    // Legacy support
    intervalDays: {
      type: Number,
      default: 1,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "COMPLETED", "FAILED"],
      default: "ACTIVE",
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    processing: {
      type: Boolean,
      default: false,
      index: true,
    },

    isProcessing: {
      type: Boolean,
      default: false,
      index: true,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    lastProcessingAt: {
      type: Date,
      default: null,
    },

    lastEvaluatedAt: {
      type: Date,
      default: null,
    },

    nextEvaluationAt: {
      type: Date,
      default: null,
      index: true,
    },

    nextRunAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastExecutedAt: {
      type: Date,
      default: null,
    },

    lastSalesCount: {
      type: Number,
      default: 0,
    },

    lastEvaluationReason: {
      type: String,
      default: "",
    },

    lastError: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to ensure originalPrice and currentPrice are always initialized
markdownRuleSchema.pre("validate", function () {
  if (this.originalPrice == null && this.currentPrice != null) {
    this.originalPrice = this.currentPrice;
  }
  if (this.currentPrice == null && this.originalPrice != null) {
    this.currentPrice = this.originalPrice;
  }
  if (this.originalPrice == null) {
    this.originalPrice = 0;
  }
  if (this.currentPrice == null) {
    this.currentPrice = 0;
  }
});

// Pre-save synchronization for legacy and new fields
markdownRuleSchema.pre("save", function () {
  if (this.minimumDiscount == null) this.minimumDiscount = 5;
  if (this.maximumDiscount == null) this.maximumDiscount = 50;
  if (this.decreasePercent == null) this.decreasePercent = 3;
  if (this.evaluationIntervalHours == null) this.evaluationIntervalHours = 24;

  if (this.increasePercent == null && this.incrementPercent != null) {
    this.increasePercent = this.incrementPercent;
  }
  if (this.incrementPercent == null && this.increasePercent != null) {
    this.incrementPercent = this.increasePercent;
  }
  if (!this.increasePercent) {
    this.increasePercent = 10;
  }
  if (this.nextEvaluationAt && !this.nextRunAt) {
    this.nextRunAt = this.nextEvaluationAt;
  }
  if (this.nextRunAt && !this.nextEvaluationAt) {
    this.nextEvaluationAt = this.nextRunAt;
  }
  if (this.status === "ACTIVE") {
    this.active = true;
  } else if (this.status === "PAUSED" || this.status === "COMPLETED") {
    this.active = false;
  }
  if (this.active && this.status !== "ACTIVE") {
    this.status = "ACTIVE";
  }
  if (this.processing !== undefined) {
    this.isProcessing = this.processing;
  }
  if (this.isProcessing !== undefined && this.processing === undefined) {
    this.processing = this.isProcessing;
  }
});

markdownRuleSchema.index({
  shop: 1,
  variantId: 1,
  status: 1,
});

markdownRuleSchema.index({
  shop: 1,
  productId: 1,
  status: 1,
});

markdownRuleSchema.index({
  status: 1,
  nextEvaluationAt: 1,
});

markdownRuleSchema.index({
  active: 1,
  nextRunAt: 1,
});

module.exports = mongoose.model(
  "MarkdownRule",
  markdownRuleSchema,
  "tbl_markdownrules"
);

