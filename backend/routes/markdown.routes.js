const express = require("express");
const {
    enableMarkdown,
    listMarkdownRules,
    pauseMarkdown,
    stopMarkdown,
} = require("../controllers/markdown.controller");
const {
    checkPlanLimit,
} = require("../middleware/checkPlanLimit");

const router = express.Router();

router.post(
    "/",
    checkPlanLimit("progressiveMarkdown"),
    enableMarkdown
);

router.get(
    "/",
    listMarkdownRules
);

router.post(
    "/:id/pause",
    pauseMarkdown
);

router.post(
    "/:id/stop",
    stopMarkdown
);

module.exports = router;
