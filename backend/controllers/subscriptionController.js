const Subscription = require("../models/Subscription");
const PLAN_LIMITS = require("../config/planLimits");

// =====================================================
// HELPER: CALCULATE REMAINING USAGE
// =====================================================

const getRemainingUsage = (limit, used) => {
    if (limit === Infinity) {
        return "unlimited";
    }

    return Math.max(limit - used, 0);
};

const {
    getOrCreateSubscription,
    resolveShop,
} = require("../middleware/checkPlanLimit");

// =====================================================
// GET CURRENT SUBSCRIPTION
// GET /api/subscription?shop=store.myshopify.com
// =====================================================

const getSubscription = async (req, res) => {
    try {
        const normalizedShop = resolveShop(req);

        if (!normalizedShop) {
            return res.status(400).json({
                success: false,
                message: "Shop is required",
            });
        }

        // Get or automatically create subscription
        const subscription =
            await getOrCreateSubscription(normalizedShop);

        // Get plan configuration
        const planLimits = PLAN_LIMITS[subscription.plan];

        if (!planLimits) {
            return res.status(400).json({
                success: false,
                message: "Invalid subscription plan",
            });
        }

        // Prepare feature usage information
        const usage = {
            clearanceSale: {
                used: subscription.usage?.clearanceSale || 0,
                limit:
                    planLimits.clearanceSale === Infinity
                        ? "unlimited"
                        : planLimits.clearanceSale,
                remaining: getRemainingUsage(
                    planLimits.clearanceSale,
                    subscription.usage?.clearanceSale || 0
                ),
            },

            deadStockBundle: {
                used: subscription.usage?.deadStockBundle || 0,
                limit:
                    planLimits.deadStockBundle === Infinity
                        ? "unlimited"
                        : planLimits.deadStockBundle,
                remaining: getRemainingUsage(
                    planLimits.deadStockBundle,
                    subscription.usage?.deadStockBundle || 0
                ),
            },

            lowStockBadge: {
                used: subscription.usage?.lowStockBadge || 0,
                limit:
                    planLimits.lowStockBadge === Infinity
                        ? "unlimited"
                        : planLimits.lowStockBadge,
                remaining: getRemainingUsage(
                    planLimits.lowStockBadge,
                    subscription.usage?.lowStockBadge || 0
                ),
            },

            progressiveMarkdown: {
                used: subscription.usage?.progressiveMarkdown || 0,
                limit:
                    planLimits.progressiveMarkdown === Infinity
                        ? "unlimited"
                        : planLimits.progressiveMarkdown,
                remaining: getRemainingUsage(
                    planLimits.progressiveMarkdown,
                    subscription.usage?.progressiveMarkdown || 0
                ),
            },
        };

        return res.status(200).json({
            success: true,

            subscription: {
                shop: subscription.shop,
                plan: subscription.plan,
                planName: planLimits.name,
                status: subscription.status,

                productLimit:
                    planLimits.products === Infinity
                        ? "unlimited"
                        : planLimits.products,

                usage,

                features: {
                    progressiveMarkdown:
                        planLimits.progressiveMarkdown === Infinity ||
                        planLimits.progressiveMarkdown > 0,

                    launchPreOrder:
                        planLimits.launchPreOrder === Infinity ||
                        planLimits.launchPreOrder > 0,

                    collectionBulkSale:
                        Boolean(planLimits.collectionBulkSale),

                    emailSchedule:
                        Boolean(planLimits.emailSchedule),

                    smartBadges:
                        Boolean(planLimits.smartBadges),
                },

                customization: planLimits.customization,

                shopifySubscriptionId: subscription.shopifySubscriptionId,
                billingStatus: subscription.billingStatus,
                billingCycle: subscription.billingCycle || "monthly",
                pendingPlan: subscription.pendingPlan,

                startedAt: subscription.startedAt,
                expiresAt: subscription.expiresAt,
            },
        });
    } catch (error) {
        console.error(
            "Get subscription error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get subscription",
            error: error.message,
        });
    }
};

const Store = require("../models/Store");
const SHOPIFY_BILLING_PLANS = require("../config/shopifyBillingPlans");
const {
    createAppSubscription,
    getAppSubscription,
    cancelAppSubscription,
} = require("../services/shopifyBillingService");

// =====================================================
// UPGRADE SUBSCRIPTION (INITIATE SHOPIFY BILLING)
// POST /api/subscription/upgrade
// =====================================================

const upgradeSubscription = async (req, res) => {
    try {
        const normalizedShop = resolveShop(req);

        if (!normalizedShop) {
            return res.status(400).json({
                success: false,
                message: "Shop domain is required.",
            });
        }

        const { plan, billingCycle = "monthly" } = req.body || {};

        if (!plan || plan === "free" || !SHOPIFY_BILLING_PLANS[plan]) {
            return res.status(400).json({
                success: false,
                message: "Invalid or non-billable plan requested. Choose basic, pro, or premium.",
            });
        }

        if (billingCycle !== "monthly" && billingCycle !== "yearly") {
            return res.status(400).json({
                success: false,
                message: "Invalid billing cycle requested. Must be 'monthly' or 'yearly'.",
            });
        }

        // Get Store access token
        const store = await Store.findOne({
            $or: [
                { shop: normalizedShop },
                { shop: `https://${normalizedShop}` },
                { shop: new RegExp(`^${normalizedShop}$`, "i") },
            ],
        }).lean();

        const accessToken =
            req.headers?.["x-shopify-access-token"] ||
            req.body?.accessToken ||
            store?.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Shopify access token not found for this store. Please reinstall the app.",
            });
        }

        const subscription = await getOrCreateSubscription(normalizedShop);

        // Prevent subscribing to the identical active plan & cycle
        if (
            subscription.plan === plan &&
            subscription.billingStatus === "active" &&
            (subscription.billingCycle || "monthly") === billingCycle
        ) {
            return res.status(400).json({
                success: false,
                message: `You are already subscribed to the ${plan.toUpperCase()} plan on ${billingCycle} billing.`,
            });
        }

        // Generate return URL pointing to embedded app
        const apiKey = process.env.SHOPIFY_API_KEY || "";
        const returnUrl = `https://${normalizedShop}/admin/apps/${apiKey}/app/billing?billing=confirm&plan=${encodeURIComponent(
            plan
        )}&cycle=${encodeURIComponent(billingCycle)}`;

        // Test mode flag
        const testMode =
            String(
                process.env.SHOPIFY_BILLING_TEST_MODE ||
                    process.env.NODE_ENV !== "production"
            ).toLowerCase() === "true";

        // Create Shopify App Subscription via GraphQL
        const billingResult = await createAppSubscription({
            shop: normalizedShop,
            accessToken,
            plan,
            billingCycle,
            returnUrl,
            testMode,
        });

        // Store pending state in MongoDB (DO NOT mark active yet!)
        subscription.pendingPlan = plan;
        subscription.pendingSubscriptionId = billingResult.subscriptionId;
        subscription.billingStatus = "pending";
        subscription.billingCycle = billingCycle;
        subscription.testMode = testMode;
        await subscription.save();

        console.log(
            `[Billing] Created pending subscription for ${normalizedShop}: plan=${plan}, cycle=${billingCycle}, test=${testMode}`
        );

        return res.status(200).json({
            success: true,
            confirmationUrl: billingResult.confirmationUrl,
            plan,
            billingCycle,
            pendingSubscriptionId: billingResult.subscriptionId,
        });
    } catch (error) {
        console.error("[Billing Upgrade Error]:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create Shopify subscription checkout.",
        });
    }
};

// =====================================================
// CONFIRM SUBSCRIPTION (CALLBACK & VERIFICATION)
// GET /api/subscription/confirm
// =====================================================

const confirmSubscription = async (req, res) => {
    try {
        const normalizedShop = resolveShop(req);
        const chargeId =
            req.query.charge_id ||
            req.query.subscription_id ||
            req.query.id;

        if (!normalizedShop) {
            return res.status(400).send("Shop parameter missing.");
        }

        const store = await Store.findOne({
            $or: [
                { shop: normalizedShop },
                { shop: `https://${normalizedShop}` },
                { shop: new RegExp(`^${normalizedShop}$`, "i") },
            ],
        }).lean();

        const accessToken = store?.accessToken;
        const apiKey = process.env.SHOPIFY_API_KEY || "";

        const subscription = await getOrCreateSubscription(normalizedShop);

        const embeddedRedirectUrl = `https://${normalizedShop}/admin/apps/${apiKey}/app/billing`;

        if (!chargeId) {
            // User cancelled / declined
            subscription.pendingPlan = null;
            subscription.pendingSubscriptionId = null;
            subscription.billingStatus = "declined";
            await subscription.save();

            return res.redirect(`${embeddedRedirectUrl}?billing=cancelled`);
        }

        if (!accessToken) {
            return res.redirect(`${embeddedRedirectUrl}?billing=error&reason=no_token`);
        }

        // Query Shopify to inspect real status
        const appSub = await getAppSubscription({
            shop: normalizedShop,
            accessToken,
            subscriptionId: chargeId,
        });

        if (appSub && appSub.status === "ACTIVE") {
            const approvedPlan =
                req.query.plan || subscription.pendingPlan || "pro";
            const approvedCycle =
                req.query.cycle || subscription.billingCycle || "monthly";

            subscription.plan = approvedPlan;
            subscription.status = "active";
            subscription.billingStatus = "active";
            subscription.billingCycle = approvedCycle;
            subscription.shopifySubscriptionId = String(chargeId);
            subscription.pendingPlan = null;
            subscription.pendingSubscriptionId = null;
            subscription.billingStartedAt = new Date();
            await subscription.save();

            console.log(
                `[Billing] ✅ Activated ${approvedPlan} (${approvedCycle}) for ${normalizedShop} (Charge: ${chargeId})`
            );

            return res.redirect(
                `${embeddedRedirectUrl}?billing=success&plan=${encodeURIComponent(
                    approvedPlan
                )}&cycle=${encodeURIComponent(approvedCycle)}`
            );
        } else {
            console.warn(
                `[Billing] Subscription ${chargeId} status is ${appSub?.status || "UNKNOWN"}`
            );

            subscription.pendingPlan = null;
            subscription.pendingSubscriptionId = null;
            subscription.billingStatus = appSub?.status ? appSub.status.toLowerCase() : "declined";
            await subscription.save();

            return res.redirect(`${embeddedRedirectUrl}?billing=cancelled`);
        }
    } catch (error) {
        console.error("[Billing Confirmation Error]:", error);
        const apiKey = process.env.SHOPIFY_API_KEY || "";
        const shop = resolveShop(req) || "";
        return res.redirect(
            `https://${shop}/admin/apps/${apiKey}/app/billing?billing=error`
        );
    }
};

// =====================================================
// VERIFY SUBSCRIPTION (IN-APP FALLBACK & ACTIVATION)
// POST /api/subscription/verify
// =====================================================

const verifySubscription = async (req, res) => {
    try {
        const normalizedShop = resolveShop(req);

        if (!normalizedShop) {
            return res.status(400).json({
                success: false,
                message: "Shop domain is required.",
            });
        }

        const subscription = await getOrCreateSubscription(normalizedShop);
        const { charge_id, plan, billingCycle } = req.body || {};

        const targetChargeId =
            charge_id ||
            req.query.charge_id ||
            subscription.pendingSubscriptionId ||
            subscription.shopifySubscriptionId;

        const store = await Store.findOne({
            $or: [
                { shop: normalizedShop },
                { shop: `https://${normalizedShop}` },
                { shop: new RegExp(`^${normalizedShop}$`, "i") },
            ],
        }).lean();

        if (targetChargeId && store?.accessToken) {
            try {
                const appSub = await getAppSubscription({
                    shop: normalizedShop,
                    accessToken: store.accessToken,
                    subscriptionId: targetChargeId,
                });

                if (appSub && appSub.status === "ACTIVE") {
                    const approvedPlan =
                        plan || subscription.pendingPlan || "basic";
                    const approvedCycle =
                        billingCycle || subscription.billingCycle || "monthly";

                    subscription.plan = approvedPlan;
                    subscription.status = "active";
                    subscription.billingStatus = "active";
                    subscription.billingCycle = approvedCycle;
                    subscription.shopifySubscriptionId = String(targetChargeId);
                    subscription.pendingPlan = null;
                    subscription.pendingSubscriptionId = null;
                    subscription.billingStartedAt = new Date();
                    await subscription.save();

                    console.log(
                        `[Billing] ✅ Verified & activated ${approvedPlan} (${approvedCycle}) for ${normalizedShop} (Charge: ${targetChargeId})`
                    );
                }
            } catch (checkErr) {
                console.warn("[Billing] Verify check error:", checkErr.message);
            }
        }

        return getSubscription(req, res);
    } catch (error) {
        console.error("[Billing Verify Error]:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to verify subscription.",
        });
    }
};

// =====================================================
// SWITCH TO FREE PLAN (CANCEL PAID SHOPIFY SUBSCRIPTION)
// POST /api/subscription/switch-free
// =====================================================

const switchFree = async (req, res) => {
    try {
        const normalizedShop = resolveShop(req);

        if (!normalizedShop) {
            return res.status(400).json({
                success: false,
                message: "Shop domain is required.",
            });
        }

        const subscription = await getOrCreateSubscription(normalizedShop);

        if (subscription.plan === "free") {
            return res.status(200).json({
                success: true,
                message: "Store is already on the Free plan.",
                subscription,
            });
        }

        // If active Shopify AppSubscription exists, cancel it via GraphQL
        if (subscription.shopifySubscriptionId) {
            const store = await Store.findOne({
                $or: [
                    { shop: normalizedShop },
                    { shop: `https://${normalizedShop}` },
                    { shop: new RegExp(`^${normalizedShop}$`, "i") },
                ],
            }).lean();

            const accessToken =
                req.headers?.["x-shopify-access-token"] || store?.accessToken;

            if (accessToken) {
                try {
                    await cancelAppSubscription({
                        shop: normalizedShop,
                        accessToken,
                        subscriptionId: subscription.shopifySubscriptionId,
                    });
                    console.log(
                        `[Billing] Cancelled Shopify subscription ${subscription.shopifySubscriptionId} for ${normalizedShop}`
                    );
                } catch (cancelErr) {
                    console.warn(
                        `[Billing] Warning cancelling Shopify subscription:`,
                        cancelErr.message
                    );
                }
            }
        }

        // Safely reset plan to Free in MongoDB
        subscription.plan = "free";
        subscription.status = "active";
        subscription.billingStatus = "active";
        subscription.shopifySubscriptionId = null;
        subscription.pendingPlan = null;
        subscription.pendingSubscriptionId = null;
        subscription.billingCycle = "monthly";
        await subscription.save();

        console.log(`[Billing] Store ${normalizedShop} switched to Free plan ✅`);

        return res.status(200).json({
            success: true,
            message: "Successfully switched to Free Plan.",
            subscription,
        });
    } catch (error) {
        console.error("[Billing Switch Free Error]:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to switch to Free plan.",
        });
    }
};

module.exports = {
    getSubscription,
    getOrCreateSubscription,
    upgradeSubscription,
    confirmSubscription,
    verifySubscription,
    switchFree,
};