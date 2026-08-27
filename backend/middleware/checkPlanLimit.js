const Subscription = require("../models/Subscription");
const PLAN_LIMITS = require("../config/planLimits");

// =====================================================
// RESOLVE & NORMALIZE SHOP
// =====================================================

const resolveShop = (req) => {
    const shop =
        req.shop ||
        req.shopId ||
        req.query?.shop ||
        req.body?.shop ||
        req.headers?.["x-shopify-shop-domain"];

    return shop ? String(shop).trim().toLowerCase() : null;
};

// =====================================================
// GET OR CREATE SUBSCRIPTION
// =====================================================

const getOrCreateSubscription = async (shop) => {
    if (!shop) return null;
    const normalizedShop = String(shop).trim().toLowerCase();

    let subscription = await Subscription.findOne({ shop: normalizedShop });

    if (!subscription) {
        subscription = await Subscription.create({
            shop: normalizedShop,
            plan: "free",
            status: "active",
            usage: {
                clearanceSale: 0,
                deadStockBundle: 0,
                lowStockBadge: 0,
                progressiveMarkdown: 0,
                launchPreOrder: 0,
            },
        });
    }

    return subscription;
};

// =====================================================
// CHECK FEATURE USAGE LIMIT
// =====================================================

const checkPlanLimit = (feature) => {
    return async (req, res, next) => {
        try {
            const normalizedShop = resolveShop(req);

            if (!normalizedShop) {
                return res.status(400).json({
                    success: false,
                    message: "Shop domain is required",
                });
            }

            // Get merchant subscription
            const subscription = await getOrCreateSubscription(normalizedShop);

            // Check subscription status
            if (subscription.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "Subscription is not active",
                    subscriptionStatus: subscription.status,
                });
            }

            // Get current plan limits
            const planLimits = PLAN_LIMITS[subscription.plan];

            if (!planLimits) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subscription plan",
                });
            }

            // If this is a disable action (e.g. turning off a badge), allow it without limit checks
            if (
                req.body &&
                (req.body.enabled === false ||
                    req.body.enabled === "false" ||
                    req.body.enabled === 0 ||
                    req.body.action === "disable" ||
                    req.body.action === "stop")
            ) {
                req.subscription = subscription;
                req.planLimits = planLimits;
                req.feature = feature;
                return next();
            }

            // Get feature limit
            const limit = planLimits[feature];

            // Feature not available in plan
            if (limit === undefined || limit === 0 || limit === false) {
                return res.status(403).json({
                    success: false,
                    message: `This feature is not available in the ${planLimits.name} plan`,
                    feature,
                    currentPlan: subscription.plan,
                    limit: 0,
                    used: subscription.usage?.[feature] || 0,
                    remaining: 0,
                    upgradeRequired: true,
                });
            }

            // Unlimited feature
            if (limit === Infinity) {
                req.subscription = subscription;
                req.planLimits = planLimits;
                req.feature = feature;
                req.featureLimit = Infinity;
                req.currentUsage = subscription.usage?.[feature] || 0;

                return next();
            }

            // Get current usage
            const currentUsage = subscription.usage?.[feature] || 0;

            // Check usage limit
            if (currentUsage >= limit) {
                return res.status(403).json({
                    success: false,
                    message: "Plan limit reached",
                    feature,
                    currentPlan: subscription.plan,
                    limit,
                    used: currentUsage,
                    remaining: 0,
                    upgradeRequired: true,
                });
            }

            // Attach data for controller
            req.subscription = subscription;
            req.planLimits = planLimits;
            req.feature = feature;
            req.featureLimit = limit;
            req.currentUsage = currentUsage;

            return next();
        } catch (error) {
            console.error("Check plan limit error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Failed to check plan limit",
                error: error.message,
            });
        }
    };
};

// =====================================================
// CHECK CUSTOMIZATION PERMISSION
// =====================================================

const checkCustomizationPermission = (feature) => {
    return async (req, res, next) => {
        try {
            const normalizedShop = resolveShop(req);

            if (!normalizedShop) {
                return res.status(400).json({
                    success: false,
                    message: "Shop domain is required",
                });
            }

            const subscription = await getOrCreateSubscription(normalizedShop);

            if (subscription.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "Subscription is not active",
                    subscriptionStatus: subscription.status,
                });
            }

            const planLimits = PLAN_LIMITS[subscription.plan];

            if (!planLimits) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subscription plan",
                });
            }

            const isAllowed = Boolean(planLimits.customization?.[feature]);

            if (!isAllowed) {
                return res.status(403).json({
                    success: false,
                    message: "Customization is not available in your current plan",
                    feature,
                    currentPlan: subscription.plan,
                    upgradeRequired: true,
                });
            }

            req.subscription = subscription;
            req.planLimits = planLimits;

            return next();
        } catch (error) {
            console.error("Check customization permission error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify customization permissions",
                error: error.message,
            });
        }
    };
};

// =====================================================
// REQUIRE PREMIUM FEATURE
// =====================================================

const requirePremiumFeature = (feature) => {
    return async (req, res, next) => {
        try {
            const normalizedShop = resolveShop(req);

            if (!normalizedShop) {
                return res.status(400).json({
                    success: false,
                    message: "Shop domain is required",
                });
            }

            const subscription = await getOrCreateSubscription(normalizedShop);

            if (subscription.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "Subscription is not active",
                    subscriptionStatus: subscription.status,
                });
            }

            const planLimits = PLAN_LIMITS[subscription.plan];

            if (!planLimits) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subscription plan",
                });
            }

            const isAllowed =
                subscription.plan === "premium" ||
                planLimits[feature] === true ||
                planLimits[feature] === Infinity;

            if (!isAllowed) {
                return res.status(403).json({
                    success: false,
                    message: `This feature is not available in the ${planLimits.name} plan. Upgrade to Premium to access this feature.`,
                    feature,
                    currentPlan: subscription.plan,
                    upgradeRequired: true,
                });
            }

            req.subscription = subscription;
            req.planLimits = planLimits;

            return next();
        } catch (error) {
            console.error("Require premium feature error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify feature permissions",
                error: error.message,
            });
        }
    };
};

// =====================================================
// INCREMENT FEATURE USAGE (ATOMIC & RACE-CONDITION SAFE)
// =====================================================

const incrementFeatureUsage = async (subscriptionOrShop, feature) => {
    const shop =
        typeof subscriptionOrShop === "string"
            ? subscriptionOrShop.trim().toLowerCase()
            : subscriptionOrShop?.shop?.trim()?.toLowerCase();

    if (!shop) return null;

    const sub = await Subscription.findOne({ shop });
    if (!sub) return null;

    const planLimits = PLAN_LIMITS[sub.plan];
    const limit = planLimits?.[feature];

    // Premium unlimited usage does not need counting
    if (limit === Infinity) {
        return sub;
    }

    // Atomic update guarded by limit condition
    const updated = await Subscription.findOneAndUpdate(
        {
            shop,
            status: "active",
            [`usage.${feature}`]: { $lt: limit },
        },
        {
            $inc: { [`usage.${feature}`]: 1 },
        },
        { new: true }
    );

    if (updated && subscriptionOrShop && typeof subscriptionOrShop === "object") {
        if (subscriptionOrShop.usage) {
            subscriptionOrShop.usage[feature] = updated.usage[feature];
        }
    }

    return updated || sub;
};

module.exports = {
    resolveShop,
    getOrCreateSubscription,
    checkPlanLimit,
    checkCustomizationPermission,
    requirePremiumFeature,
    incrementFeatureUsage,
};