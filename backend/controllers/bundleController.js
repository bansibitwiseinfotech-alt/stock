const Bundle = require("../models/Bundle");
const {
    getProduct,
    createBundleProduct,
} = require("../services/shopifyBundleService");

/**
 * POST /api/bundles
 */
async function createBundle(req, res) {
    try {
        const {
            shop,
            bundleName,
            deadStockProductId,
            deadStockVariantId,
            companionProductId,
            companionVariantId,
            discountPercent,
        } = req.body;

        if (!shop) {
            return res.status(400).json({
                success: false,
                message: "Shop is required",
            });
        }

        if (!bundleName) {
            return res.status(400).json({
                success: false,
                message: "Bundle name is required",
            });
        }

        if (!deadStockProductId || !deadStockVariantId) {
            return res.status(400).json({
                success: false,
                message: "Dead stock product and variant are required",
            });
        }

        if (!companionProductId || !companionVariantId) {
            return res.status(400).json({
                success: false,
                message: "Companion product and variant are required",
            });
        }

        const discount = Number(discountPercent);

        if (!Number.isFinite(discount)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discount",
            });
        }

        if (discount < 0 || discount > 100) {
            return res.status(400).json({
                success: false,
                message: "Discount must be between 0 and 100",
            });
        }

        /**
         * IMPORTANT:
         * Replace this with your existing Shopify session/token lookup.
         */
        const accessToken = await getShopifyAccessToken(shop);

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Shopify access token not found",
            });
        }

        const deadStockProduct = await getProduct(
            shop,
            accessToken,
            deadStockProductId
        );

        const companionProduct = await getProduct(
            shop,
            accessToken,
            companionProductId
        );

        const deadStockVariant = deadStockProduct.variants.nodes.find(
            (variant) => variant.id === deadStockVariantId
        );

        const companionVariant = companionProduct.variants.nodes.find(
            (variant) => variant.id === companionVariantId
        );

        if (!deadStockVariant) {
            return res.status(400).json({
                success: false,
                message: "Dead stock variant not found",
            });
        }

        if (!companionVariant) {
            return res.status(400).json({
                success: false,
                message: "Companion variant not found",
            });
        }

        /**
         * Create actual Shopify product.
         */
        const shopifyBundle = await createBundleProduct({
            shop,
            accessToken,
            bundleName,
            deadStockProduct,
            deadStockVariant,
            companionProduct,
            companionVariant,
            discountPercent: discount,
        });

        /**
         * Save local database record.
         */
        const bundle = await Bundle.create({
            shop,
            bundleName,

            deadStockProductId,
            deadStockVariantId,

            companionProductId,
            companionVariantId,

            bundleProductId: shopifyBundle.productId,
            bundleVariantId: shopifyBundle.variantId,

            discountPercent: discount,

            originalPrice: shopifyBundle.originalPrice,
            bundlePrice: shopifyBundle.bundlePrice,

            status: "ACTIVE",
        });

        return res.status(201).json({
            success: true,
            message: "Bundle created successfully",

            bundle: {
                id: bundle._id,

                bundleName: bundle.bundleName,

                productId: bundle.bundleProductId,
                variantId: bundle.bundleVariantId,

                originalPrice: bundle.originalPrice,
                bundlePrice: bundle.bundlePrice,

                discountPercent: bundle.discountPercent,
            },
        });
    } catch (error) {
        console.error("CREATE BUNDLE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create bundle",
        });
    }
}

/**
 * GET /api/bundles
 */
async function getBundles(req, res) {
    try {
        const shop = req.query.shop;

        if (!shop) {
            return res.status(400).json({
                success: false,
                message: "Shop is required",
            });
        }

        const bundles = await Bundle.find({
            shop,
            status: "ACTIVE",
        }).sort({
            createdAt: -1,
        });

        return res.json({
            success: true,
            bundles,
        });
    } catch (error) {
        console.error("GET BUNDLES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * GET /api/bundles/:id
 */
async function getBundle(req, res) {
    try {
        const bundle = await Bundle.findById(req.params.id);

        if (!bundle) {
            return res.status(404).json({
                success: false,
                message: "Bundle not found",
            });
        }

        return res.json({
            success: true,
            bundle,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * Replace this with your actual session storage implementation.
 */
async function getShopifyAccessToken(shop) {
    /**
     * Example:
     *
     * const session = await Session.findOne({ shop });
     * return session?.accessToken;
     */

    if (global.shopifySessions?.[shop]) {
        return global.shopifySessions[shop].accessToken;
    }

    if (process.env.SHOPIFY_ACCESS_TOKEN) {
        return process.env.SHOPIFY_ACCESS_TOKEN;
    }

    return null;
}

module.exports = {
    createBundle,
    getBundles,
    getBundle,
};