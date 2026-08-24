const mongoose = require("mongoose");

const HighDemandReorder = require(
  "../models/highDemandReorder"
);

// ==================================================
// HELPER
// ==================================================

function cleanShop(shop = "") {
  return String(shop || "")
    .trim()
    .toLowerCase();
}

function cleanVariantId(variantId = "") {
  const value = String(variantId || "").trim();

  if (!value) return "";

  // Accept both:
  // gid://shopify/ProductVariant/123
  // 123
  return value.replace(
    "gid://shopify/ProductVariant/",
    ""
  );
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

// ==================================================
// CREATE REORDER
// POST /api/high-demand/reorder
// ==================================================

exports.createReorder = async (req, res) => {
  try {
    const body = req.body || {};

    const shop = cleanShop(body.shop);

    const variantId = cleanVariantId(
      body.variantId
    );

    const productId = String(
      body.productId || ""
    ).trim();

    const productName = String(
      body.productName || ""
    ).trim();

    const variantTitle = String(
      body.variantTitle || ""
    ).trim();

    const sku = String(
      body.sku || ""
    ).trim();

    const currentStock = Math.max(
      0,
      toNumber(body.currentStock, 0)
    );

    const salesVelocity = Math.max(
      0,
      toNumber(body.salesVelocity, 0)
    );

    const daysUntilStockout =
      body.daysUntilStockout === null ||
        body.daysUntilStockout === undefined ||
        body.daysUntilStockout === ""
        ? null
        : toNumber(
          body.daysUntilStockout,
          null
        );

    const targetCoverageDays = Math.max(
      1,
      toNumber(
        body.targetCoverageDays,
        30
      )
    );

    // ------------------------------------------------
    // VALIDATION
    // ------------------------------------------------

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    // ------------------------------------------------
    // CALCULATE REORDER QUANTITY
    // ------------------------------------------------

    const requiredStock =
      salesVelocity *
      targetCoverageDays;

    const calculatedReorderQuantity =
      Math.max(
        0,
        Math.ceil(
          requiredStock - currentStock
        )
      );

    // ------------------------------------------------
    // REQUESTED QUANTITY
    // ------------------------------------------------

    const requestedQuantity = Math.max(
      0,
      toNumber(
        body.requestedQuantity,
        calculatedReorderQuantity
      )
    );

    // Cannot create a reorder for 0 quantity
    if (requestedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message:
          "Insufficient sales data to calculate a reorder quantity.",
        data: {
          currentStock,
          salesVelocity,
          targetCoverageDays,
          requiredStock,
          reorderQuantity:
            calculatedReorderQuantity,
        },
      });
    }

    // ------------------------------------------------
    // RISK LEVEL
    // ------------------------------------------------

    const allowedRiskLevels = [
      "SAFE",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ];

    const incomingRisk =
      String(
        body.riskLevel || "CRITICAL"
      ).toUpperCase();

    const riskLevel =
      allowedRiskLevels.includes(
        incomingRisk
      )
        ? incomingRisk
        : "CRITICAL";

    // ------------------------------------------------
    // PREVENT DUPLICATE PENDING REORDER
    // ------------------------------------------------

    const existingPending =
      await HighDemandReorder.findOne({
        shop,
        variantId,
        status: "PENDING",
      });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message:
          "A pending reorder already exists for this variant.",
        data: existingPending,
      });
    }

    // ------------------------------------------------
    // CREATE
    // ------------------------------------------------

    const reorder =
      await HighDemandReorder.create({
        shop,

        productId,

        variantId,

        productName,

        variantTitle,

        sku,

        currentStock,

        salesVelocity,

        daysUntilStockout,

        requestedQuantity,

        reorderQuantity:
          calculatedReorderQuantity,

        targetCoverageDays,

        reason:
          body.reason ||
          "HIGH_DEMAND_STOCKOUT_RISK",

        riskLevel,

        status: "PENDING",

        confirmedAt: null,

        cancelledAt: null,
      });

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------

    return res.status(201).json({
      success: true,
      message:
        "Reorder request created successfully.",
      data: reorder,
    });
  } catch (error) {
    console.error(
      "Create High Demand Reorder Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create reorder request.",
      error: error.message,
    });
  }
};

// ==================================================
// GET REORDERS
// GET /api/high-demand/reorders?shop=...&status=...
// ==================================================

exports.getReorders = async (req, res) => {
  try {
    const shop = cleanShop(
      req.query.shop
    );

    const status = String(
      req.query.status || ""
    )
      .trim()
      .toUpperCase();

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "shop is required",
      });
    }

    const query = {
      shop,
    };

    // ------------------------------------------------
    // OPTIONAL STATUS FILTER
    // ------------------------------------------------

    if (
      status &&
      ["PENDING", "CONFIRMED", "CANCELLED"].includes(
        status
      )
    ) {
      query.status = status;
    }

    const reorders =
      await HighDemandReorder.find(query)
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: reorders.length,
      data: reorders,
      reorders,
    });
  } catch (error) {
    console.error(
      "Get High Demand Reorders Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch reorder requests.",
      error: error.message,
    });
  }
};

// ==================================================
// CONFIRM REORDER
// PATCH /api/high-demand/reorder/:id/confirm
// ==================================================

exports.confirmReorder = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------
    // VALIDATE MONGODB ID
    // ------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid reorder ID.",
      });
    }

    // ------------------------------------------------
    // FIND PENDING REORDER
    // ------------------------------------------------

    const reorder =
      await HighDemandReorder.findById(id);

    if (!reorder) {
      return res.status(404).json({
        success: false,
        message:
          "Reorder request not found.",
      });
    }

    if (
      reorder.status === "CONFIRMED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Reorder is already confirmed.",
        data: reorder,
      });
    }

    if (
      reorder.status === "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Cancelled reorder cannot be confirmed.",
        data: reorder,
      });
    }

    // ------------------------------------------------
    // CONFIRM
    // ------------------------------------------------

    reorder.status = "CONFIRMED";

    reorder.confirmedAt =
      new Date();

    reorder.cancelledAt = null;

    await reorder.save();

    return res.status(200).json({
      success: true,
      message:
        "Reorder confirmed successfully.",
      data: reorder,
    });
  } catch (error) {
    console.error(
      "Confirm High Demand Reorder Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to confirm reorder.",
      error: error.message,
    });
  }
};

// ==================================================
// CANCEL REORDER
// PATCH /api/high-demand/reorder/:id/cancel
// ==================================================

exports.cancelReorder = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------
    // VALIDATE MONGODB ID
    // ------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid reorder ID.",
      });
    }

    // ------------------------------------------------
    // FIND REORDER
    // ------------------------------------------------

    const reorder =
      await HighDemandReorder.findById(id);

    if (!reorder) {
      return res.status(404).json({
        success: false,
        message:
          "Reorder request not found.",
      });
    }

    if (
      reorder.status === "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Reorder is already cancelled.",
        data: reorder,
      });
    }

    if (
      reorder.status === "CONFIRMED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Confirmed reorder cannot be cancelled.",
        data: reorder,
      });
    }

    // ------------------------------------------------
    // CANCEL
    // ------------------------------------------------

    reorder.status = "CANCELLED";

    reorder.cancelledAt =
      new Date();

    reorder.confirmedAt = null;

    await reorder.save();

    return res.status(200).json({
      success: true,
      message:
        "Reorder cancelled successfully.",
      data: reorder,
    });
  } catch (error) {
    console.error(
      "Cancel High Demand Reorder Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel reorder.",
      error: error.message,
    });
  }
};

// ==================================================
// GET REORDER BY ID
// GET /api/high-demand/reorder/:id
// ==================================================

exports.getReorderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reorder ID.",
      });
    }

    const reorder = await HighDemandReorder.findById(id).lean();

    if (!reorder) {
      return res.status(404).json({
        success: false,
        message: "Reorder request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: reorder,
    });
  } catch (error) {
    console.error("Get Reorder By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reorder.",
      error: error.message,
    });
  }
};