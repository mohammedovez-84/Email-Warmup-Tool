//healthRoutes.js
const express = require("express");
const { runHealthCheck } = require("../../controllers/health/healthController");

const router = express.Router();

router.post("/health-check", runHealthCheck);

module.exports = router;
