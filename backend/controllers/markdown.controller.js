const {
    createMarkdownRule,
    pauseMarkdownRule,
    stopMarkdownRule,
    getMarkdownRules,
} = require("../services/markdown.service");

function getShopFromRequest(req) {
    // Change this according to your authentication middleware.
    //
    // Examples:
    // req.shop
    // req.user.shop
    // req.session.shop
    // req.shopDomain

    return (
        req.shop ||
        req.user?.shop ||
        req.session?.shop ||
        req.body.shop
    );
}

/**
 * POST /api/markdown-rules
 */
async function enableMarkdown(req, res) {
    try {
        const shop = getShopFromRequest(req);

        const {
            productId,
            variantId,
            startingDiscount = 10,
            increasePercent = 5,
            incrementPercent,
            decreasePercent = 5,
            minimumDiscount = 5,
            maximumDiscount = 50,
        } = req.body;

        if (!shop) {
            return res.status(400).json({
                success: false,
                message: "Shop is required",
            });
        }

        const ruleResult =
            await createMarkdownRule(shop, null, {
                productId,
                variantId,
                startingDiscount: Number(startingDiscount),
                increasePercent: Number(increasePercent ?? incrementPercent ?? 5),
                decreasePercent: Number(decreasePercent),
                minimumDiscount: Number(minimumDiscount),
                maximumDiscount: Number(maximumDiscount),
            });

        if (!ruleResult.success) {
            return res.status(400).json(ruleResult);
        }

        return res.status(201).json(ruleResult);
    } catch (error) {
        console.error(
            "Enable markdown error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * GET /api/markdown-rules
 */
async function listMarkdownRules(req, res) {
    try {
        const shop = getShopFromRequest(req);

        if (!shop) {
            return res.status(400).json({
                success: false,
                message: "Shop is required",
            });
        }

        const rules =
            await getMarkdownRules(shop);

        return res.json({
            success: true,
            rules,
        });
    } catch (error) {
        console.error(
            "List markdown rules error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * POST /api/markdown-rules/:id/pause
 */
async function pauseMarkdown(req, res) {
    try {
        const shop = getShopFromRequest(req);

        const rule =
            await pauseMarkdownRule({
                shop,
                ruleId: req.params.id,
            });

        return res.json({
            success: true,
            message:
                "Progressive markdown paused",
            rule,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * POST /api/markdown-rules/:id/stop
 */
async function stopMarkdown(req, res) {
    try {
        const shop = getShopFromRequest(req);

        const rule =
            await stopMarkdownRule({
                shop,
                ruleId: req.params.id,
            });

        return res.json({
            success: true,
            message:
                "Progressive markdown stopped and original price restored",
            rule,
        });
    } catch (error) {
        console.error(
            "Stop markdown error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports = {
    enableMarkdown,
    listMarkdownRules,
    pauseMarkdown,
    stopMarkdown,
};
