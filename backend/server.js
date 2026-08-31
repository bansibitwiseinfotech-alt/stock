const path = require("path");

// Suppress Node & Mongoose deprecation warnings from cluttering terminal log
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" ||
    warning.message?.includes("findOneAndUpdate") ||
    warning.message?.includes("findOneAndReplace")
  ) {
    return;
  }
});

// ==================================================
// ENVIRONMENT
// ==================================================

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

// ==================================================
// DEPENDENCIES
// ==================================================

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// ==================================================
// DATABASE
// ==================================================

const connectDB = require("./config/mongodb");

// ==================================================
// ROUTES
// ==================================================
const storefrontSaleRoutes = require(
  "./routes/storefrontSaleRoutes"
);

// ==================================================
// SERVICES / WORKERS & ROUTES
// ==================================================
const emailRoutes = require("./routes/emailRoutes");
const {
  processActiveMarkdownRules,
} = require(
  "./services/progressiveMarkdownService"
);
const smartBadgeRoutes = require("./routes/smartBadgeRoutes");
const {
  processClearanceSales,
} = require(
  "./services/clearanceExpirationService"
);
const subscriptionRoutes = require("./routes/subscriptionRoutes");
// ==================================================
// APP
// ==================================================

const app = express();

// ==================================================
// DATABASE CONNECTION
// ==================================================

connectDB()
  .then(async () => {
    console.log("MongoDB Ready ✅");

    // ----------------------------------------------
    // DEAD STOCK INDEXES
    // ----------------------------------------------

    try {
      const DeadStock =
        require("./models/DeadStock");

      await DeadStock.syncIndexes();

      console.log(
        "DeadStock indexes synced ✅"
      );
    } catch (error) {
      console.error(
        "Failed to sync DeadStock indexes:",
        error.message
      );
    }

    // ----------------------------------------------
    // HIGH DEMAND & REORDER INDEXES
    // ----------------------------------------------

    try {
      const HighDemand = require("./models/highDemand");
      await HighDemand.syncIndexes();
      console.log("HighDemand indexes synced ✅");
    } catch (error) {
      console.error("Failed to sync HighDemand indexes:", error.message);
    }

    try {
      const HighDemandReorder = require("./models/highDemandReorder");
      await HighDemandReorder.syncIndexes();
      console.log("HighDemandReorder indexes synced ✅");
    } catch (error) {
      console.error("Failed to sync HighDemandReorder indexes:", error.message);
    }

    try {
      const HighDemandStorefront = require("./models/HighDemandStorefront");
      await HighDemandStorefront.syncIndexes();
      console.log("HighDemandStorefront indexes synced ✅");
    } catch (error) {
      console.error("Failed to sync HighDemandStorefront indexes:", error.message);
    }

    // ----------------------------------------------
    // EMAIL SETTINGS & EMAIL LOG INDEXES
    // ----------------------------------------------

    try {
      const EmailSettings = require("./models/EmailSettings");
      await EmailSettings.syncIndexes();
      console.log("EmailSettings indexes synced ✅");
    } catch (error) {
      console.error("Failed to sync EmailSettings indexes:", error.message);
    }

    try {
      const EmailLog = require("./models/EmailLog");
      await EmailLog.syncIndexes();
      console.log("EmailLog indexes synced ✅");
    } catch (error) {
      console.error("Failed to sync EmailLog indexes:", error.message);
    }

    // ----------------------------------------------
    // WEEKLY EMAIL SCHEDULER
    // ----------------------------------------------

    try {
      const { startWeeklyEmailScheduler } = require("./jobs/weeklyEmailScheduler");
      startWeeklyEmailScheduler();
      console.log("Weekly email scheduler started ✅");
    } catch (cronErr) {
      console.error("Failed to start weekly email scheduler:", cronErr.message);
    }

    // ----------------------------------------------
    // PROGRESSIVE MARKDOWN WORKER
    // ----------------------------------------------

    setInterval(() => {
      processActiveMarkdownRules()
        .catch((err) => {
          console.error(
            "Progressive Markdown Worker Error:",
            err.message
          );
        });
    }, 5 * 60 * 1000);

    // ----------------------------------------------
    // CLEARANCE SALE WORKER
    // ----------------------------------------------

    setInterval(() => {
      processClearanceSales()
        .catch((err) => {
          console.error(
            "Clearance Sale Worker Error:",
            err.message
          );
        });
    }, 5 * 60 * 1000);

    // ----------------------------------------------
    // INITIAL WORKERS
    // ----------------------------------------------

    setTimeout(() => {
      processActiveMarkdownRules()
        .catch((err) => {
          console.error(
            "Initial Markdown Worker Error:",
            err.message
          );
        });

      processClearanceSales()
        .catch((err) => {
          console.error(
            "Initial Clearance Worker Error:",
            err.message
          );
        });
    }, 15000);
  })
  .catch((error) => {
    console.error(
      "MongoDB Error:",
      error.message
    );
  });

// ==================================================
// SECURITY
// ==================================================

app.use(
  helmet()
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  compression()
);

app.use(
  morgan("dev")
);

app.use(
  cookieParser()
);

// ==================================================
// BODY PARSER
// ==================================================

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// ==================================================
// RATE LIMIT
// ==================================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 10000,

  standardHeaders: true,

  legacyHeaders: false,

  skip: (req) => {
    const ip =
      req.ip ||
      req.connection?.remoteAddress ||
      "";

    return (
      ip.includes("127.0.0.1") ||
      ip.includes("::1") ||
      process.env.NODE_ENV !==
      "production"
    );
  },

  message: {
    success: false,
    message:
      "Too many requests. Try again later.",
  },
});

app.use(limiter);

// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,

    app: "Smart Stock Engine",

    message:
      "Backend API Running 🚀",

    version: "1.0.0",

    environment:
      process.env.NODE_ENV ||
      "development",
  });
});

// ==================================================
// BASIC API ROUTES
// ==================================================

app.use(
  "/api/stores",
  require("./routes/store")
);

app.use(
  "/auth",
  require("./routes/auth")
);

app.use(
  "/api/shopify",
  require("./routes/shopify")
);

app.use(
  "/api/products",
  require("./routes/products")
);

app.use(
  "/api/inventory",
  require("./routes/inventory")
);

app.use(
  "/api/orders",
  require("./routes/orders")
);
app.use("/api/subscription", subscriptionRoutes);
// ==================================================
// STOREFRONT ROUTES
// ==================================================

app.use(
  "/api/storefront-sale",
  storefrontSaleRoutes
);

app.use(
  "/api/storefront",
  require("./routes/storefrontRoutes")
);
// ==================================================
// DASHBOARD
// ==================================================

app.use(
  "/api/dashboard",
  require("./routes/dashboardRoutes")
);

// ==================================================
// DEAD STOCK
// ==================================================

app.use(
  "/api/dead-stock/bundles",
  require(
    "./routes/deadStockBundleRoutes"
  )
);

app.use(
  "/api/dead-stock",
  require("./routes/deadStock")
);

// ==================================================
// 🟢 MODULE B — HIGH DEMAND
// ==================================================
//
// GET
// /api/high-demand
//
// POST
// /api/high-demand/reorder
//
// Both are handled from highDemand.routes.js
// ==================================================

app.use(
  "/api/high-demand",
  require("./routes/highDemand.routes")
);

// ==================================================
// OTHER MODULES
// ==================================================

app.use(
  "/api/bundles",
  require("./routes/bundlesRoutes")
);

app.use(
  "/api/automations",
  require("./routes/automationsRoutes")
);

app.use(
  "/api/reports",
  require("./routes/reportsRoutes")
);

app.use(
  "/api/settings",
  require("./routes/settingsRoutes")
);

app.use(
  "/api/customization",
  require("./routes/customizationRoutes")
);

app.use(
  "/api/notifications",
  require("./routes/notificationRoutes")
);

app.use(
  "/api/pre-orders",
  require("./routes/preOrder.routes")
);

app.use(
  "/api/smart-badges",
  smartBadgeRoutes
);
// ==================================================
// EMAIL (single registration)
// ==================================================

app.use("/api/email", emailRoutes);

app.use(
  "/api/badge-settings",
  require("./routes/badgeSettingsRoutes")
);

// ==================================================
// 404
// ==================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,

    message:
      "API Route Not Found",

    path: req.originalUrl,
  });
});

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Unhandled Error:",
      err.stack
    );

    res.status(500).json({
      success: false,

      message:
        err.message ||
        "Internal Server Error",
    });
  }
);

// ==================================================
// BACKGROUND JOB
// ==================================================
const {
  startMarkdownJob,
} = require("./jobs/markdown.job");


// ==================================================
// PORT
// ==================================================

const PORT =
  process.env.PORT || 5000;

// ==================================================
// START SERVER
// ==================================================

// Weekly merchant email cron is started inside connectDB().then() after MongoDB is ready.

app.listen(
  PORT,
  () => {
    console.log(
      `🚀 Smart Stock Engine API running on port ${PORT}`
    );

    console.log(
      `🌐 http://localhost:${PORT}`
    );

    console.log(
      `🛡️ High-Demand API: http://localhost:${PORT}/api/high-demand`
    );

    console.log(
      `📦 Reorder API: POST http://localhost:${PORT}/api/high-demand/reorder`
    );

    try {
      startMarkdownJob();
    } catch (jobErr) {
      console.error(
        "Failed to initialize background jobs:",
        jobErr.message
      );
    }

    // Auto-sync real Shopify Pre-Orders & send confirmation emails on Pay Now
    try {
      const Store = require("./models/Store");
      const { syncShopifyPreOrders } = require("./controllers/preOrder.controller");

      setInterval(async () => {
        try {
          const stores = await Store.find({ accessToken: { $exists: true, $ne: "" } }).lean();
          for (const s of stores) {
            if (s.shop) {
              await syncShopifyPreOrders(s.shop).catch(() => { });
            }
          }
        } catch (syncErr) {
          // silent background worker
        }
      }, 25000);
      console.log("⚡ Real-time Pre-Order confirmation email worker started (25s interval)");
    } catch (workerErr) {
      console.error("Failed to start Pre-Order worker:", workerErr.message);
    }
  }
);