const mongoose = require("mongoose");

// =====================================================
// SMART STOCK - SUBSCRIPTION MODEL
// =====================================================

const subscriptionSchema = new mongoose.Schema(
    {
        // Shopify store domain
        shop: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            lowercase: true,
        },

        // Current billing plan
        plan: {
            type: String,
            enum: ["free", "basic", "pro", "premium"],
            default: "free",
            required: true,
        },

        // Subscription status
        status: {
            type: String,
            enum: ["active", "cancelled", "expired"],
            default: "active",
        },

        // Feature usage counters
        usage: {
            clearanceSale: {
                type: Number,
                default: 0,
                min: 0,
            },

            deadStockBundle: {
                type: Number,
                default: 0,
                min: 0,
            },

            lowStockBadge: {
                type: Number,
                default: 0,
                min: 0,
            },

            progressiveMarkdown: {
                type: Number,
                default: 0,
                min: 0,
            },

            launchPreOrder: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        // Real Shopify Billing Fields
        shopifySubscriptionId: {
            type: String,
            default: null,
        },

        pendingPlan: {
            type: String,
            enum: ["free", "basic", "pro", "premium", null],
            default: null,
        },

        pendingSubscriptionId: {
            type: String,
            default: null,
        },

        billingStatus: {
            type: String,
            enum: ["active", "pending", "declined", "cancelled", "expired"],
            default: "active",
        },

        billingCycle: {
            type: String,
            enum: ["monthly", "yearly"],
            default: "monthly",
        },

        billingStartedAt: {
            type: Date,
            default: null,
        },

        testMode: {
            type: Boolean,
            default: false,
        },

        // Subscription dates
        startedAt: {
            type: Date,
            default: Date.now,
        },

        expiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);