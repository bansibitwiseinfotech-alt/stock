// =====================================================
// SMART STOCK - BILLING PLAN LIMITS
// =====================================================

const PLAN_LIMITS = {
    free: {
        name: "Free",

        // Maximum products shown/fetched
        products: 10,

        // Feature usage limits
        clearanceSale: 3,
        deadStockBundle: 0,
        lowStockBadge: 0,
        progressiveMarkdown: 0,
        launchPreOrder: 0,

        // Premium features
        collectionBulkSale: false,
        emailSchedule: false,
        smartBadges: false,

        // Feature customization permissions
        customization: {
            clearanceSale: true,
            deadStockBundle: false,
            progressiveMarkdown: false,
            lowStockBadge: false,
            launchPreOrder: false,
        },
    },

    basic: {
        name: "Basic",

        products: 20,

        clearanceSale: 10,
        deadStockBundle: 10,
        lowStockBadge: 0,
        progressiveMarkdown: 10,
        launchPreOrder: 0,

        collectionBulkSale: false,
        emailSchedule: false,
        smartBadges: false,

        customization: {
            clearanceSale: true,
            deadStockBundle: true,
            progressiveMarkdown: true,
            lowStockBadge: false,
            launchPreOrder: false,
        },
    },

    pro: {
        name: "Pro",

        products: 500,

        clearanceSale: 15,
        deadStockBundle: 15,
        lowStockBadge: 15,
        progressiveMarkdown: 15,
        launchPreOrder: 0,

        collectionBulkSale: false,
        emailSchedule: false,
        smartBadges: false,

        customization: {
            clearanceSale: true,
            deadStockBundle: true,
            progressiveMarkdown: true,
            lowStockBadge: true,
            launchPreOrder: false,
        },
    },

    premium: {
        name: "Premium",

        products: 5000,
 
        clearanceSale: Infinity,
        deadStockBundle: Infinity,
        lowStockBadge: Infinity,
        progressiveMarkdown: Infinity,
        launchPreOrder: Infinity,

        collectionBulkSale: true,
        emailSchedule: true,
        smartBadges: true,

        customization: {
            clearanceSale: true,
            deadStockBundle: true,
            progressiveMarkdown: true,
            lowStockBadge: true,
            launchPreOrder: true,
        },
    },
};

module.exports = PLAN_LIMITS;


