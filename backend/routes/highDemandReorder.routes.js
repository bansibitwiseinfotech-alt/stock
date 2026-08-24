const express = require("express");

const router = express.Router();

const {
    createReorder,
} = require(
    "../controllers/highDemandReorder.controller"
);

router.post(
    "/reorder",
    createReorder
);

module.exports = router;   